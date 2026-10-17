-- =====================================================================
-- Depósitos / levantamentos manuais (comprovativo + aprovação de admin)
-- Portado do sistema do TMT (payment_receipts / withdrawal_requests /
-- wallet_movements / admin_notifications + bucket payment-proofs).
--
-- Modelo (igual ao TMT):
--   * Utilizador escolhe método (binance | rodotpay | express), vê os dados
--     de pagamento, faz o pagamento e envia um COMPROVATIVO (foto).
--   * O comprovativo cria uma linha em `payment_receipts` (status pending).
--   * Um admin aprova/rejeita. A aprovação CREDITA a carteira real do
--     utilizador (ledger `accounts`/`ledger_entries`, via public.ledger_credit,
--     executada por service_role na Edge Function `admin-manage`).
--   * Levantamentos: `withdrawal_requests` (pending → approved → paid/rejected).
--     Marcar como pago DEBITA a carteira (public.ledger_debit).
--   * `wallet_movements` = histórico do utilizador, sincronizado por triggers.
--
-- Moedas nestas tabelas: minúsculas ('usd' | 'aoa') — igual ao TMT.
-- A carteira (ledger) usa maiúsculas ('USD' | 'AOA'); a conversão é feita na
-- Edge Function. Montantes aqui em unidades MAIORES (numeric(14,2)); o ledger
-- guarda unidades menores (×100).
--
-- PRINCÍPIO: o cliente só LÊ/INSERE as próprias linhas (RLS); a escrita de
-- estado (aprovar/rejeitar/pagar) e o crédito/débito do saldo são SÓ do
-- service_role (Edge Function).
-- =====================================================================

-- ============================ Tabelas ================================

-- 1. Comprovativos de depósito
create table if not exists public.payment_receipts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  user_email    text,
  proof_url     text not null,
  plan          text default 'wallet',      -- TCM: depósito de carteira ('wallet')
  method        text not null,
  amount        numeric(14, 2) not null default 0,
  currency      text not null default 'aoa',
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  referral_code text,
  duplicate_of  uuid references public.payment_receipts (id),
  reviewed_by   uuid references auth.users (id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists payment_receipts_user_idx
  on public.payment_receipts (user_id, created_at desc);
create index if not exists payment_receipts_status_idx
  on public.payment_receipts (status);

-- 2. Pedidos de levantamento
create table if not exists public.withdrawal_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  method      text not null,
  amount      numeric(14, 2) not null default 0,
  currency    text not null default 'aoa',
  details     text,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'paid')),
  notes       text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists withdrawal_requests_user_idx
  on public.withdrawal_requests (user_id, created_at desc);
create index if not exists withdrawal_requests_status_idx
  on public.withdrawal_requests (status);

-- 3. Histórico de movimentos (espelho do comprovativo/pedido para o utilizador)
create table if not exists public.wallet_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('deposit', 'withdrawal')),
  method      text not null,
  amount      numeric(14, 2) not null,
  currency    text not null default 'aoa',
  plan        text,
  status      text not null default 'pendente'
                check (status in ('pendente', 'concluido', 'recusado')),
  receipt_id  uuid references public.payment_receipts (id) on delete set null,
  request_id  uuid references public.withdrawal_requests (id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_wm_user on public.wallet_movements (user_id);
create index if not exists idx_wm_status on public.wallet_movements (status);
create index if not exists idx_wm_created on public.wallet_movements (created_at desc);
create index if not exists idx_wm_request on public.wallet_movements (request_id);

-- 4. Notificações do admin (sino) — escrita só por service_role/triggers
create table if not exists public.admin_notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null default 'system_error',
  title       text not null,
  message     text not null default '',
  entity_type text,
  entity_id   uuid,
  data        jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists admin_notifications_created_idx
  on public.admin_notifications (created_at desc);

-- ===================== Regra: 1 depósito pendente =====================
-- Um utilizador só pode ter UM comprovativo pendente (imposto na BD,
-- mesmo em corrida).
create unique index if not exists uq_payment_receipts_one_pending_per_user
  on public.payment_receipts (user_id)
  where status = 'pending';

-- ============================ Triggers ===============================

-- updated_at para wallet_movements / withdrawal_requests
create or replace function public.update_updated_at_generic()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wm_updated on public.wallet_movements;
create trigger trg_wm_updated
  before update on public.wallet_movements
  for each row execute function public.update_updated_at_generic();

drop trigger if exists trg_wr_updated on public.withdrawal_requests;
create trigger trg_wr_updated
  before update on public.withdrawal_requests
  for each row execute function public.update_updated_at_generic();

-- Notificação ao admin (comprovativo / levantamento)
create or replace function public.fn_notify_admin(
  p_type text, p_title text, p_message text,
  p_entity_type text default null, p_entity_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (type, title, message, entity_type, entity_id)
  values (p_type, p_title, p_message, p_entity_type, p_entity_id);
end $$;

create or replace function public.fn_trg_receipt_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fn_notify_admin(
    'receipt_pending', 'Novo comprovativo',
    coalesce(new.user_email, 'Utilizador') || ' | ' || coalesce(new.method, '?')
      || ' | ' || coalesce(new.amount::text, '') || ' ' || coalesce(new.currency, ''),
    'receipt', new.id
  );
  return new;
end $$;

drop trigger if exists trg_admin_receipt_notify on public.payment_receipts;
create trigger trg_admin_receipt_notify after insert on public.payment_receipts
  for each row execute function public.fn_trg_receipt_notify();

create or replace function public.fn_trg_withdrawal_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fn_notify_admin(
    'withdrawal_pending', 'Nova solicitacao de saque',
    coalesce(new.method, '?') || ' | ' || coalesce(new.amount::text, '')
      || ' ' || coalesce(new.currency, ''),
    'withdrawal', new.id
  );
  return new;
end $$;

drop trigger if exists trg_admin_withdrawal_notify on public.withdrawal_requests;
create trigger trg_admin_withdrawal_notify after insert on public.withdrawal_requests
  for each row execute function public.fn_trg_withdrawal_notify();

-- Deteção de comprovativos duplicados (mesmo ficheiro, ou mesmo
-- método/valor/moeda nos últimos 30 dias)
create or replace function public.flag_duplicate_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dup uuid;
begin
  select r.id into dup
  from public.payment_receipts r
  where r.user_id = new.user_id
    and r.proof_url = new.proof_url
    and r.id <> new.id
  order by r.created_at desc
  limit 1;

  if dup is null then
    select r.id into dup
    from public.payment_receipts r
    where r.user_id = new.user_id
      and r.id <> new.id
      and r.amount = new.amount
      and lower(r.method) = lower(new.method)
      and lower(coalesce(r.currency, '')) = lower(coalesce(new.currency, ''))
      and r.created_at > now() - interval '30 days'
    order by r.created_at desc
    limit 1;
  end if;

  new.duplicate_of := dup;
  return new;
end $$;

drop trigger if exists trg_flag_duplicate_receipt on public.payment_receipts;
create trigger trg_flag_duplicate_receipt
  before insert on public.payment_receipts
  for each row execute function public.flag_duplicate_receipt();

-- Sincroniza o estado do histórico (wallet_movements) com a decisão do admin.
create or replace function public.sync_wm_from_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  v_status := case new.status
    when 'approved' then 'concluido'
    when 'rejected' then 'recusado'
    else 'pendente'
  end;

  update public.wallet_movements wm
    set status = v_status, updated_at = now()
  where wm.type = 'deposit'
    and coalesce(wm.status, 'pendente') is distinct from v_status
    and (
      wm.receipt_id = new.id
      or (
        wm.receipt_id is null
        and wm.user_id = new.user_id
        and wm.status = 'pendente'
        and wm.amount = new.amount
        and lower(coalesce(wm.currency, '')) = lower(coalesce(new.currency, ''))
      )
    );

  return new;
end $$;

drop trigger if exists trg_sync_wm_receipt on public.payment_receipts;
create trigger trg_sync_wm_receipt
  after insert or update of status on public.payment_receipts
  for each row execute function public.sync_wm_from_receipt();

create or replace function public.sync_wm_from_withdrawal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  v_status := case new.status
    when 'rejected' then 'recusado'
    when 'approved' then 'concluido'
    when 'paid' then 'concluido'
    else 'pendente'
  end;

  update public.wallet_movements wm
    set status = v_status, updated_at = now()
  where wm.type = 'withdrawal'
    and coalesce(wm.status, 'pendente') is distinct from v_status
    and (
      wm.request_id = new.id
      or (
        wm.request_id is null
        and wm.user_id = new.user_id
        and wm.status = 'pendente'
        and wm.amount = new.amount
        and lower(coalesce(wm.currency, '')) = lower(coalesce(new.currency, ''))
      )
    );

  return new;
end $$;

drop trigger if exists trg_sync_wm_withdrawal on public.withdrawal_requests;
create trigger trg_sync_wm_withdrawal
  after insert or update of status on public.withdrawal_requests
  for each row execute function public.sync_wm_from_withdrawal();

-- ============================ RLS ====================================

alter table public.payment_receipts   enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.wallet_movements    enable row level security;
alter table public.admin_notifications enable row level security;

-- payment_receipts: próprio (select/insert) + delete enquanto pendente
do $$ begin
  drop policy if exists "receipts_select_own" on public.payment_receipts;
  create policy "receipts_select_own" on public.payment_receipts
    for select to authenticated using (user_id = auth.uid());
end $$;
do $$ begin
  drop policy if exists "receipts_insert_own" on public.payment_receipts;
  create policy "receipts_insert_own" on public.payment_receipts
    for insert to authenticated with check (user_id = auth.uid());
end $$;
do $$ begin
  drop policy if exists "receipts_delete_own_pending" on public.payment_receipts;
  create policy "receipts_delete_own_pending" on public.payment_receipts
    for delete to authenticated using (user_id = auth.uid() and status = 'pending');
end $$;
do $$ begin
  drop policy if exists "receipts_all_service" on public.payment_receipts;
  create policy "receipts_all_service" on public.payment_receipts
    for all to service_role using (true) with check (true);
end $$;

-- withdrawal_requests
do $$ begin
  drop policy if exists "wr_select_own" on public.withdrawal_requests;
  create policy "wr_select_own" on public.withdrawal_requests
    for select to authenticated using (user_id = auth.uid());
end $$;
do $$ begin
  drop policy if exists "wr_insert_own" on public.withdrawal_requests;
  create policy "wr_insert_own" on public.withdrawal_requests
    for insert to authenticated with check (user_id = auth.uid());
end $$;
do $$ begin
  drop policy if exists "wr_delete_own_pending" on public.withdrawal_requests;
  create policy "wr_delete_own_pending" on public.withdrawal_requests
    for delete to authenticated using (user_id = auth.uid() and status = 'pending');
end $$;
do $$ begin
  drop policy if exists "wr_all_service" on public.withdrawal_requests;
  create policy "wr_all_service" on public.withdrawal_requests
    for all to service_role using (true) with check (true);
end $$;

-- wallet_movements
do $$ begin
  drop policy if exists "wm_select_own" on public.wallet_movements;
  create policy "wm_select_own" on public.wallet_movements
    for select to authenticated using (user_id = auth.uid());
end $$;
do $$ begin
  drop policy if exists "wm_insert_own" on public.wallet_movements;
  create policy "wm_insert_own" on public.wallet_movements
    for insert to authenticated with check (user_id = auth.uid());
end $$;
do $$ begin
  drop policy if exists "wm_delete_own_pending" on public.wallet_movements;
  create policy "wm_delete_own_pending" on public.wallet_movements
    for delete to authenticated using (user_id = auth.uid() and status = 'pendente');
end $$;
do $$ begin
  drop policy if exists "wm_all_service" on public.wallet_movements;
  create policy "wm_all_service" on public.wallet_movements
    for all to service_role using (true) with check (true);
end $$;

-- admin_notifications: sem policies de cliente (só service_role), como no TMT.

grant select, insert, delete on public.payment_receipts   to authenticated;
grant select, insert, delete on public.withdrawal_requests to authenticated;
grant select, insert, delete on public.wallet_movements    to authenticated;

-- ==================== Storage: bucket payment-proofs ==================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies
                 where policyname = 'Public read payment-proofs' and tablename = 'objects') then
    create policy "Public read payment-proofs" on storage.objects
      for select using (bucket_id = 'payment-proofs');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies
                 where policyname = 'Authenticated upload own payment-proofs' and tablename = 'objects') then
    create policy "Authenticated upload own payment-proofs" on storage.objects
      for insert to authenticated with check (
        bucket_id = 'payment-proofs'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies
                 where policyname = 'Users delete own payment-proofs' and tablename = 'objects') then
    create policy "Users delete own payment-proofs" on storage.objects
      for delete using (
        bucket_id = 'payment-proofs'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ============================ Realtime ===============================
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'payment_receipts') then
    alter publication supabase_realtime add table public.payment_receipts;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'withdrawal_requests') then
    alter publication supabase_realtime add table public.withdrawal_requests;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'wallet_movements') then
    alter publication supabase_realtime add table public.wallet_movements;
  end if;
end $$;
