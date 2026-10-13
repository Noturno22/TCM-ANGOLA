-- =====================================================================
-- Payments / ledger de dinheiro real (AOA) — Slice 0 (fundação)
-- Aplicar no SQL Editor do Supabase (Dashboard → SQL Editor → New query)
-- ou via Management API (POST /v1/projects/{ref}/database/query).
--
-- PRINCÍPIO DE SEGURANÇA (não violar):
--   * O saldo (accounts/ledger_entries) NUNCA é mutado pelo cliente.
--   * Só as funções public.ledger_credit / public.ledger_debit (SECURITY
--     DEFINER, EXECUTE apenas para service_role) escrevem no ledger.
--   * Clientes autenticados só podem LER os próprios dados (RLS).
--   * Montantes são inteiros em unidades menores (AOA centavos; 1 AOA = 100).
-- =====================================================================

-- ============================ Tabelas ================================

-- 1 conta por (utilizador, moeda)
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete restrict,
  currency    char(3) not null default 'AOA',
  status      text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, currency)
);

-- Livro-razão append-only, partidas dobradas. Immutável (sem UPDATE/DELETE).
create table if not exists public.ledger_entries (
  id               bigserial primary key,
  account_id       uuid not null references public.accounts (id) on delete restrict,
  entry_type       text not null check (entry_type in ('debit', 'credit')),
  amount_minor     bigint not null check (amount_minor > 0),
  balance_after    bigint not null check (balance_after >= 0),
  reference_type   text not null,       -- 'deposit','withdrawal','bet_stake','refund','fee','adjustment'
  reference_id     uuid not null,
  idempotency_key  text not null unique,
  description      text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_ledger_account_created
  on public.ledger_entries (account_id, created_at, id);

-- Intenções de depósito (uma por tentativa; idempotency_key do cliente)
create table if not exists public.payment_intents (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts (id) on delete restrict,
  provider        text not null,          -- 'mock','wipay','appypay','paypay','stripe'
  provider_ref    text,
  amount_minor    bigint not null check (amount_minor > 0),
  currency        char(3) not null default 'AOA',
  fx_rate_minor   bigint,                 -- AOA centavos por USD centavo (NULL se já em AOA)
  status          text not null default 'created'
                    check (status in ('created', 'pending', 'paid', 'failed', 'expired', 'refunded')),
  checkout_url    text,
  metadata        jsonb not null default '{}',
  idempotency_key text not null unique,
  expires_at      timestamptz not null,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_intents_provider_ref
  on public.payment_intents (provider, provider_ref);

-- Pedidos de levantamento (saque)
create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts (id) on delete restrict,
  provider        text not null,
  provider_ref    text,
  amount_minor    bigint not null check (amount_minor > 0),
  currency        char(3) not null default 'AOA',
  fx_rate_minor   bigint,
  status          text not null default 'requested'
                    check (status in ('requested', 'kyc_pending', 'approved', 'processing', 'paid', 'failed', 'rejected', 'cancelled')),
  destination     jsonb not null default '{}',
  idempotency_key text not null unique,
  approved_by     uuid references auth.users (id),
  approved_at     timestamptz,
  processed_at    timestamptz,
  failure_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Registo KYC (documentos em Supabase Storage privado; aqui só metadados)
create table if not exists public.kyc_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete restrict,
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'expired', 'requires_review')),
  document_type       text not null,       -- 'BI','passport','driver_license'
  document_number     text not null,
  document_front_url  text not null,
  document_back_url   text,
  selfie_url          text,
  liveness_check      boolean not null default false,
  address_proof_url   text,
  reviewed_by         uuid references auth.users (id),
  reviewed_at         timestamptz,
  rejection_reason    text,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Reservas (para apostas — esquema pronto, lógica adiada)
create table if not exists public.holds (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts (id) on delete restrict,
  amount_minor    bigint not null check (amount_minor > 0),
  currency        char(3) not null default 'AOA',
  reference_type  text not null,           -- 'bet_stake','tournament_entry'
  reference_id    uuid not null,
  status          text not null default 'active'
                    check (status in ('active', 'released', 'settled', 'expired')),
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  settled_at      timestamptz
);

-- Webhooks já processados (idempotência por evento do provider)
create table if not exists public.processed_webhooks (
  id                bigserial primary key,
  provider          text not null,
  provider_event_id text not null,
  event_type        text not null,
  payment_intent_id uuid references public.payment_intents (id),
  created_at        timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- =================== Conta automática por utilizador =================

create or replace function public.handle_new_user_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_id, currency)
  values (new.id, 'AOA')
  on conflict (user_id, currency) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function public.handle_new_user_account();

-- Backfill de contas para utilizadores já existentes.
insert into public.accounts (user_id, currency)
select id, 'AOA' from auth.users
on conflict (user_id, currency) do nothing;

-- ===================== RPCs de mutação do saldo ======================
-- ÚNICO caminho de escrita. Lock da linha de conta serializa por conta.

create or replace function public.ledger_credit(
  p_account_id     uuid,
  p_amount_minor   bigint,
  p_reference_type text,
  p_reference_id   uuid,
  p_idempotency_key text,
  p_description    text default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_entry   public.ledger_entries;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Serializa mutações concorrentes da mesma conta.
  perform 1 from public.accounts where id = p_account_id for update;

  select balance_after into v_balance
  from public.ledger_entries
  where account_id = p_account_id
  order by id desc
  limit 1;

  if v_balance is null then
    v_balance := 0;
  end if;

  insert into public.ledger_entries
    (account_id, entry_type, amount_minor, balance_after,
     reference_type, reference_id, idempotency_key, description)
  values
    (p_account_id, 'credit', p_amount_minor, v_balance + p_amount_minor,
     p_reference_type, p_reference_id, p_idempotency_key, p_description)
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.ledger_debit(
  p_account_id     uuid,
  p_amount_minor   bigint,
  p_reference_type text,
  p_reference_id   uuid,
  p_idempotency_key text,
  p_description    text default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_entry   public.ledger_entries;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  perform 1 from public.accounts where id = p_account_id for update;

  select balance_after into v_balance
  from public.ledger_entries
  where account_id = p_account_id
  order by id desc
  limit 1;

  if v_balance is null or v_balance < p_amount_minor then
    raise exception 'insufficient_funds' using errcode = 'P0001';
  end if;

  insert into public.ledger_entries
    (account_id, entry_type, amount_minor, balance_after,
     reference_type, reference_id, idempotency_key, description)
  values
    (p_account_id, 'debit', p_amount_minor, v_balance - p_amount_minor,
     p_reference_type, p_reference_id, p_idempotency_key, p_description)
  returning * into v_entry;

  return v_entry;
end;
$$;

-- Só o service_role (Edge Functions) pode executar as RPCs.
revoke execute on function public.ledger_credit(uuid, bigint, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.ledger_debit(uuid, bigint, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.ledger_credit(uuid, bigint, text, uuid, text, text) to service_role;
grant execute on function public.ledger_debit(uuid, bigint, text, uuid, text, text) to service_role;

-- ============================ RLS ====================================
-- Leitura do próprio; escrita só via RPC/Edge Functions (service_role).

-- accounts
alter table public.accounts enable row level security;
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own"
  on public.accounts for select to authenticated
  using (user_id = auth.uid());

-- ledger_entries
alter table public.ledger_entries enable row level security;
drop policy if exists "ledger_select_own" on public.ledger_entries;
create policy "ledger_select_own"
  on public.ledger_entries for select to authenticated
  using (account_id in (select id from public.accounts where user_id = auth.uid()));

-- payment_intents
alter table public.payment_intents enable row level security;
drop policy if exists "intents_select_own" on public.payment_intents;
create policy "intents_select_own"
  on public.payment_intents for select to authenticated
  using (account_id in (select id from public.accounts where user_id = auth.uid()));

-- payouts
alter table public.payouts enable row level security;
drop policy if exists "payouts_select_own" on public.payouts;
create policy "payouts_select_own"
  on public.payouts for select to authenticated
  using (account_id in (select id from public.accounts where user_id = auth.uid()));

-- kyc_records / holds / processed_webhooks: sem acesso de cliente (RLS ligado,
-- nenhuma policy → só service_role acede).
alter table public.kyc_records enable row level security;
alter table public.holds enable row level security;
alter table public.processed_webhooks enable row level security;

-- Grants de leitura explícitos (RLS restringe as linhas).
grant select on public.accounts        to authenticated;
grant select on public.ledger_entries  to authenticated;
grant select on public.payment_intents to authenticated;
grant select on public.payouts         to authenticated;

-- Nunca permitir escrita direta a partir de clientes.
revoke insert, update, delete on public.accounts, public.ledger_entries,
  public.payment_intents, public.payouts, public.kyc_records, public.holds,
  public.processed_webhooks from anon, authenticated;

-- O ledger é imutável mesmo para o service_role em UPDATE/DELETE
-- (a app nunca deve alterar entradas; correções fazem-se com novas entradas).
revoke update, delete on public.ledger_entries from anon, authenticated, service_role;
