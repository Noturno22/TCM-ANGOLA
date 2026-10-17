-- =====================================================================
-- SETUP COMPLETO (online) - Tira o Coco do Meio
--
-- Unico script com as migracoes 0001 a 0014, na ordem correta.
-- Idempotente: pode ser reexecutado sem efeitos secundarios.
--
-- COMO USAR:
--   1. Supabase Dashboard -> SQL Editor -> New query
--   2. Colar este ficheiro inteiro e carregar em Run
--
-- Depois de correr, publicar tambem a Edge Function:
--   supabase functions deploy submit-move --project-ref <REF>
--
-- NAO usar com a CLI (supabase db push): as migracoes individuais
-- em supabase/migrations/ continuam a ser a fonte de verdade.
--
-- Seccoes incluidas (nesta ordem):
--   0001_profiles.sql
--   0002_payments.sql
--   0003_kyc_payouts.sql
--   0004_kyc_read.sql
--   0005_online_rooms.sql
--   0006_online_match.sql
--   0007_edge_authority.sql
--   0008_rooms_international.sql
--   0009_friends.sql
--   0010_online_tournaments.sql
--   0011_virtual_bets.sql
--   0012_notifications.sql
--   0013_tournament_auto_advance.sql
--   0014_age_gate.sql
-- =====================================================================

-- =====================================================================
-- SECCAO: 0001_profiles.sql
-- =====================================================================
-- =====================================================================
-- Perfis de utilizador + Row Level Security (RLS)
-- Aplicar no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
-- =====================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text,
  avatar      text not null default '🦁',
  elo         integer not null default 1000,
  level       integer not null default 1,
  xp          integer not null default 0,
  wins        integer not null default 0,
  losses      integer not null default 0,
  draws       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Qualquer pessoa pode ver os perfis (rankings/leaderboards).
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Cada utilizador só cria o seu próprio perfil.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Cada utilizador só altera o seu próprio perfil.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Cria automaticamente um perfil quando nasce um utilizador.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =====================================================================
-- SECCAO: 0002_payments.sql
-- =====================================================================
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


-- =====================================================================
-- SECCAO: 0003_kyc_payouts.sql
-- =====================================================================
-- =====================================================================
-- KYC + Levantamentos (payouts) — Slice 2
-- Depende de 0002_payments.sql (tabelas kyc_records e payouts já existem).
--
-- Nota: o Levantamento real só deve ser ATIVO depois de resolvido o
-- enquadramento legal (licenciamento BNA, contrato PSP, política KYC/AML).
-- O botão é controlado pela flag de função PAYOUTS_ENABLED (default off).
-- =====================================================================

-- Bucket privado para documentos de KYC (imagens + PDF, máx 5MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents', 'kyc-documents', false, 5242880,
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do nothing;

-- Cada utilizador só acede à sua própria pasta: kyc-documents/<uid>/...
drop policy if exists "kyc_docs_insert_own" on storage.objects;
create policy "kyc_docs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_docs_select_own" on storage.objects;
create policy "kyc_docs_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_docs_update_own" on storage.objects;
create policy "kyc_docs_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Helper reutilizável: o utilizador tem KYC aprovado (e não expirado)?
create or replace function public.has_approved_kyc(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kyc_records
    where user_id = p_user_id
      and status = 'approved'
      and (expires_at is null or expires_at > now())
  );
$$;

revoke execute on function public.has_approved_kyc(uuid) from public, anon;
grant execute on function public.has_approved_kyc(uuid) to authenticated, service_role;


-- =====================================================================
-- SECCAO: 0004_kyc_read.sql
-- =====================================================================
-- =====================================================================
-- KYC — leitura do próprio registo pelo cliente.
-- Em 0002 o RLS de kyc_records foi ligado sem qualquer policy (só service_role).
-- Aqui permitimos que o utilizador LEIA o seu próprio registo de KYC (para saber
-- o estado: pending/approved/rejected). Escrita continua exclusiva do servidor.
-- =====================================================================

alter table public.kyc_records enable row level security;

drop policy if exists "kyc_select_own" on public.kyc_records;
create policy "kyc_select_own"
  on public.kyc_records for select to authenticated
  using (user_id = auth.uid());

grant select on public.kyc_records to authenticated;


-- =====================================================================
-- SECCAO: 0005_online_rooms.sql
-- =====================================================================
-- =====================================================================
-- Online — Fase 1: salas, ocupação e chat em tempo real
-- Aplicar no SQL Editor do Supabase (Dashboard → SQL Editor → New query)
-- ou via Management API (POST /v1/projects/{ref}/database/query).
--
-- PRINCÍPIO DE SEGURANÇA:
--   * `rooms` é catálogo (leitura pública, escrita só service_role).
--   * `messages` é append-only; o cliente só pode inserir mensagens em
--     seu nome e ler as mensagens das salas (RLS).
--   * A presença ("jogadores online") NÃO vive na base de dados — usa
--     Supabase Realtime Presence (canal efémero `room:{id}`), evitando
--     escrita de estado e linhas obsoletas.
--   * As apostas das salas são em moeda virtual (KZ), nunca dinheiro real.
-- =====================================================================

-- ============================ Catálogo ==============================

create table if not exists public.rooms (
  id          text primary key,                 -- 'angola','luanda',...
  name        text not null,
  capacity    integer not null default 50 check (capacity > 0),
  stake       integer not null default 0 check (stake >= 0),  -- KZ virtual
  is_featured boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Sementes do mockup (idempotente).
insert into public.rooms (id, name, capacity, stake, is_featured, sort_order) values
  ('angola',   'Angola',        50, 200, true,  0),
  ('luanda',   'Luanda',        50, 100, false, 1),
  ('benguela', 'Benguela',      40,  50, false, 2),
  ('huambo',   'Huambo',        30,  25, false, 3),
  ('cabinda',  'Cabinda',       20,  10, false, 4),
  ('global',   'Global (Free)', 100,  0, false, 5)
on conflict (id) do update set
  name = excluded.name,
  capacity = excluded.capacity,
  stake = excluded.stake,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order;

-- ============================== Chat =================================

create table if not exists public.messages (
  id         bigserial primary key,
  room_id    text not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 280),
  kind       text not null default 'user' check (kind in ('user', 'announcement')),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_room_created
  on public.messages (room_id, created_at desc, id desc);

-- ============================ RLS ====================================

alter table public.rooms enable row level security;
alter table public.messages enable row level security;

-- Catálogo: leitura para todos (mesmo anónimos), escrita bloqueada.
drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all"
  on public.rooms for select
  using (true);

-- Chat: leitura para autenticados; inserção apenas em nome próprio.
drop policy if exists "messages_select_authenticated" on public.messages;
create policy "messages_select_authenticated"
  on public.messages for select to authenticated
  using (true);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages for insert to authenticated
  with check (user_id = auth.uid() and kind = 'user');

grant select on public.rooms to anon, authenticated;
grant select, insert on public.messages to authenticated;

-- Nunca permitir UPDATE/DELETE de mensagens pelo cliente.
revoke update, delete on public.messages from anon, authenticated;

-- ======================= Realtime (chat) =============================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

-- ====================== RPC: enviar mensagem =========================
-- Evita depender de INSERT direto e valida/limita o conteúdo no servidor.

create or replace function public.send_message(
  p_room_id text,
  p_body    text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_msg  public.messages;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'invalid_message_length' using errcode = '22023';
  end if;
  if not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'unknown_room' using errcode = '22023';
  end if;

  insert into public.messages (room_id, user_id, body)
  values (p_room_id, auth.uid(), v_body)
  returning * into v_msg;

  return v_msg;
end;
$$;

grant execute on function public.send_message(text, text) to authenticated;


-- =====================================================================
-- SECCAO: 0006_online_match.sql
-- =====================================================================
-- =====================================================================
-- Online — Fase 2: matchmaking + partida autoritativa (Supabase)
-- Aplicar no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
--
-- PRINCÍPIO DE AUTORIDADE (não violar):
--   * O tabuleiro/turno/resultado vivem em `public.matches`. O cliente
--     NUNCA escreve diretamente nestas tabelas (RLS bloqueia INSERT/
--     UPDATE/DELETE); tudo passa por RPCs SECURITY DEFINER.
--   * As regras do motor (@tira/engine, modo 'adjacent-only') são
--     replicadas em PL/pgSQL para validação no servidor (D2: vitória só
--     para quem moveu; D3: empate à 3.ª repetição; D4: sem movimentos =
--     derrota). O cliente usa o motor para UI otimista, mas a verdade é
--     aqui.
--   * As apostas são em moeda virtual (KZ) — nunca dinheiro real.
--   * O relógio é do servidor (`turn_started_at` + `time_per_turn`).
-- =====================================================================

-- Moeda virtual no perfil (idempotente; perfis já existem em 0001).
alter table public.profiles add column if not exists coins integer not null default 0;

-- ============================ Tabelas ===============================

-- Fila de matchmaking: 1 entrada por utilizador.
create table if not exists public.match_queue (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  room_id    text not null references public.rooms (id) on delete cascade,
  stake      integer not null default 0 check (stake >= 0),
  elo        integer not null default 1000,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_match_queue_user on public.match_queue (user_id);
create index if not exists idx_match_queue_room on public.match_queue (room_id, created_at);

-- Partidas online. board: smallint[9] (1=P1, -1=P2, 0=vazio), índice = casa.
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  room_id         text not null references public.rooms (id) on delete cascade,
  stake           integer not null default 0 check (stake >= 0),
  status          text not null default 'active' check (status in ('active', 'finished', 'aborted')),
  p1_id           uuid not null references auth.users (id) on delete cascade,
  p2_id           uuid not null references auth.users (id) on delete cascade,
  turn            text not null default 'P1' check (turn in ('P1', 'P2')),
  board           smallint[] not null default '{1,1,1,0,0,0,-1,-1,-1}'::smallint[],
  move_count      integer not null default 0 check (move_count >= 0),
  pos_counts      jsonb not null default '{}'::jsonb,
  winner          text check (winner in ('P1', 'P2', 'draw')),
  win_line        smallint[],
  time_per_turn   integer not null default 45 check (time_per_turn >= 0),
  turn_started_at timestamptz not null default now(),
  settled         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (p1_id <> p2_id)
);

create index if not exists idx_matches_p1 on public.matches (p1_id, status);
create index if not exists idx_matches_p2 on public.matches (p2_id, status);

-- Auditoria de movimentos (append-only).
create table if not exists public.match_moves (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches (id) on delete cascade,
  seq         integer not null,
  player_id   uuid not null references auth.users (id) on delete cascade,
  side        text not null check (side in ('P1', 'P2')),
  from_square smallint not null check (from_square between 1 and 9),
  to_square   smallint not null check (to_square between 1 and 9),
  created_at  timestamptz not null default now(),
  unique (match_id, seq)
);

create index if not exists idx_match_moves_match on public.match_moves (match_id, seq);

-- ===================== Funções puras (regras) =======================
-- Prefidas por `_` (internas). Execute revogado do público.

create or replace function public._adjacent(a int, b int)
returns boolean language sql immutable as $$
  select a between 1 and 9 and b between 1 and 9 and a <> b
     and abs(((a - 1) % 3) - ((b - 1) % 3)) <= 1
     and abs(((a - 1) / 3) - ((b - 1) / 3)) <= 1;
$$;

create or replace function public._has_legal_move(b smallint[], p smallint)
returns boolean language plpgsql immutable as $$
declare s int; d int;
begin
  for s in 1..9 loop
    if b[s] = p then
      for d in 1..9 loop
        if b[d] = 0 and public._adjacent(s, d) then
          return true;
        end if;
      end loop;
    end if;
  end loop;
  return false;
end $$;

-- Vitória do jogador p. Ignora a linha de casa (D2, homeLineCounts=false).
create or replace function public._has_won(b smallint[], p smallint)
returns boolean language plpgsql immutable as $$
declare
  lines int[][] := array[
    array[1,2,3], array[4,5,6], array[7,8,9],
    array[1,4,7], array[2,5,8], array[3,6,9],
    array[1,5,9], array[3,5,7]
  ];
  ln int[];
begin
  for i in 1..array_length(lines, 1) loop
    ln := lines[i];
    if b[ln[1]] = p and b[ln[2]] = p and b[ln[3]] = p then
      if p = 1 and ln = array[1,2,3] then continue; end if;
      if p = -1 and ln = array[7,8,9] then continue; end if;
      return true;
    end if;
  end loop;
  return false;
end $$;

-- Devolve a linha vencedora (ou null), aplicando a regra da linha de casa.
create or replace function public._winning_line(b smallint[], p smallint)
returns smallint[] language plpgsql immutable as $$
declare
  lines int[][] := array[
    array[1,2,3], array[4,5,6], array[7,8,9],
    array[1,4,7], array[2,5,8], array[3,6,9],
    array[1,5,9], array[3,5,7]
  ];
  ln int[];
begin
  for i in 1..array_length(lines, 1) loop
    ln := lines[i];
    if b[ln[1]] = p and b[ln[2]] = p and b[ln[3]] = p then
      if p = 1 and ln = array[1,2,3] then continue; end if;
      if p = -1 and ln = array[7,8,9] then continue; end if;
      return ln::smallint[];
    end if;
  end loop;
  return null;
end $$;

-- Chave de posição (D3): "p1casas|p2casas|jogador_atual" (igual ao motor).
create or replace function public._position_key(b smallint[], cur text)
returns text language plpgsql immutable as $$
declare p1 int[] := '{}'; p2 int[] := '{}';
begin
  for s in 1..9 loop
    if b[s] = 1 then p1 := p1 || s;
    elsif b[s] = -1 then p2 := p2 || s;
    end if;
  end loop;
  return array_to_string(p1, ',') || '|' || array_to_string(p2, ',') || '|' || cur;
end $$;

-- Probabilidade esperada de vitória (Elo).
create or replace function public._expected(ra int, rb int)
returns numeric language sql immutable as $$
  select 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
$$;

-- ========================= Liquidação ===============================

create or replace function public._settle_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m       public.matches;
  v_elo1    int;
  v_elo2    int;
  v_delta   int;
  v_s1      numeric;
  v_xp1     int := 0;
  v_xp2     int := 0;
  v_coin1   int := 0;
  v_coin2   int := 0;
  k         constant int := 32;
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if not found then return; end if;
  if v_m.status <> 'finished' or v_m.winner is null or v_m.settled then return; end if;

  select coalesce(elo, 1000) into v_elo1 from public.profiles where id = v_m.p1_id;
  select coalesce(elo, 1000) into v_elo2 from public.profiles where id = v_m.p2_id;
  v_elo1 := coalesce(v_elo1, 1000);
  v_elo2 := coalesce(v_elo2, 1000);

  if v_m.winner = 'draw' then
    v_s1 := 0.5;
    v_xp1 := 15; v_xp2 := 15;
  elsif v_m.winner = 'P1' then
    v_s1 := 1.0;
    v_xp1 := 40; v_xp2 := 10;
    v_coin1 := v_m.stake; v_coin2 := 0;
  else
    v_s1 := 0.0;
    v_xp1 := 10; v_xp2 := 40;
    v_coin1 := 0; v_coin2 := v_m.stake;
  end if;

  v_delta := round(k * (v_s1 - public._expected(v_elo1, v_elo2)));

  update public.profiles set
    elo = greatest(100, elo + v_delta),
    xp = xp + v_xp1,
    level = 1 + ((xp + v_xp1) / 100),
    coins = coins + v_coin1,
    wins = wins + case when v_m.winner = 'P1' then 1 else 0 end,
    losses = losses + case when v_m.winner = 'P2' then 1 else 0 end,
    draws = draws + case when v_m.winner = 'draw' then 1 else 0 end,
    updated_at = now()
  where id = v_m.p1_id;

  update public.profiles set
    elo = greatest(100, elo - v_delta),
    xp = xp + v_xp2,
    level = 1 + ((xp + v_xp2) / 100),
    coins = coins + v_coin2,
    wins = wins + case when v_m.winner = 'P2' then 1 else 0 end,
    losses = losses + case when v_m.winner = 'P1' then 1 else 0 end,
    draws = draws + case when v_m.winner = 'draw' then 1 else 0 end,
    updated_at = now()
  where id = v_m.p2_id;

  update public.matches set settled = true, updated_at = now() where id = v_m.id;
end $$;

-- ============================ RPCs ==================================

-- Entra na fila da sala. Emparelha com o primeiro à espera (mesma sala),
-- criando uma partida; caso contrário fica em espera.
create or replace function public.join_matchmaking(p_room_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.rooms;
  v_opp   public.match_queue;
  v_match public.matches;
  v_board smallint[] := '{1,1,1,0,0,0,-1,-1,-1}'::smallint[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'unknown_room' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('mm:' || p_room_id));

  select * into v_opp from public.match_queue
    where room_id = p_room_id and user_id <> v_uid
    order by created_at asc
    limit 1
    for update skip locked;

  if found then
    insert into public.matches
      (room_id, stake, p1_id, p2_id, turn, board, pos_counts, turn_started_at)
    values
      (p_room_id, v_room.stake, v_opp.user_id, v_uid, 'P1', v_board,
       jsonb_build_object(public._position_key(v_board, 'P1'), 1), now())
    returning * into v_match;

    delete from public.match_queue where id = v_opp.id;
    delete from public.match_queue where user_id = v_uid;

    return jsonb_build_object('status', 'matched', 'match_id', v_match.id, 'side', 'P2');
  else
    delete from public.match_queue where user_id = v_uid;
    insert into public.match_queue (user_id, room_id, stake, elo)
    values (v_uid, p_room_id, v_room.stake,
            coalesce((select elo from public.profiles where id = v_uid), 1000));
    return jsonb_build_object('status', 'queued');
  end if;
end $$;

-- Sai da fila (idempotente).
create or replace function public.cancel_matchmaking()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.match_queue where user_id = auth.uid();
end $$;

-- Aplica um movimento de forma autoritativa e liquida se a partida terminar.
create or replace function public.submit_move(
  p_match_id uuid,
  p_from     int,
  p_to       int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_m       public.matches;
  v_side    text;
  v_side_v  smallint;
  v_opp     text;
  v_opp_v   smallint;
  v_board   smallint[];
  v_key     text;
  v_counts  jsonb;
  v_status  text;
  v_winner  text;
  v_line    smallint[];
  v_turn    text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'unknown_match' using errcode = '22023';
  end if;
  if v_m.status <> 'active' then
    raise exception 'match_not_active' using errcode = '22023';
  end if;

  if v_m.p1_id = v_uid then v_side := 'P1';
  elsif v_m.p2_id = v_uid then v_side := 'P2';
  else raise exception 'not_a_participant' using errcode = '28000';
  end if;

  if v_m.turn <> v_side then
    raise exception 'not_your_turn' using errcode = '22023';
  end if;

  if v_m.time_per_turn > 0
     and now() > v_m.turn_started_at + make_interval(secs => v_m.time_per_turn) then
    raise exception 'turn_expired' using errcode = '22023';
  end if;

  if p_from < 1 or p_from > 9 or p_to < 1 or p_to > 9 or p_from = p_to then
    raise exception 'invalid_square' using errcode = '22023';
  end if;

  v_side_v := case v_side when 'P1' then 1 else -1 end;
  v_opp := case v_side when 'P1' then 'P2' else 'P1' end;
  v_opp_v := case v_opp when 'P1' then 1 else -1 end;

  if v_m.board[p_from] <> v_side_v then
    raise exception 'not_your_piece' using errcode = '22023';
  end if;
  if v_m.board[p_to] <> 0 then
    raise exception 'destination_occupied' using errcode = '22023';
  end if;
  if not public._adjacent(p_from, p_to) then
    raise exception 'path_blocked' using errcode = '22023';
  end if;

  v_board := v_m.board;
  v_board[p_from] := 0;
  v_board[p_to] := v_side_v;

  v_key := public._position_key(v_board, v_opp);
  v_counts := v_m.pos_counts;
  v_counts := jsonb_set(
    v_counts, array[v_key],
    to_jsonb(coalesce((v_counts ->> v_key)::int, 0) + 1), true
  );

  if public._has_won(v_board, v_side_v) then
    v_status := 'finished';
    v_winner := v_side;
    v_line := public._winning_line(v_board, v_side_v);
    v_turn := v_side;
  elsif coalesce((v_counts ->> v_key)::int, 0) >= 3 then
    v_status := 'finished';
    v_winner := 'draw';
    v_turn := v_opp;
  elsif not public._has_legal_move(v_board, v_opp_v) then
    v_status := 'finished';
    v_winner := v_side;
    v_turn := v_side;
  else
    v_status := 'active';
    v_winner := null;
    v_turn := v_opp;
  end if;

  update public.matches set
    board = v_board,
    pos_counts = v_counts,
    move_count = v_m.move_count + 1,
    turn = v_turn,
    status = v_status,
    winner = v_winner,
    win_line = v_line,
    turn_started_at = now(),
    updated_at = now()
  where id = v_m.id
  returning * into v_m;

  insert into public.match_moves (match_id, seq, player_id, side, from_square, to_square)
  values (v_m.id, v_m.move_count - 1, v_uid, v_side, p_from, p_to);

  if v_status = 'finished' then
    perform public._settle_match(v_m.id);
  end if;

  return jsonb_build_object(
    'status', v_status,
    'winner', v_winner,
    'turn', v_turn,
    'move_count', v_m.move_count,
    'board', v_board
  );
end $$;

-- Desiste: o adversário vence.
create or replace function public.resign_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m   public.matches;
  v_win text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'unknown_match' using errcode = '22023';
  end if;
  if v_m.status = 'finished' then
    return jsonb_build_object('status', 'finished', 'winner', v_m.winner);
  end if;

  if v_m.p1_id = v_uid then v_win := 'P2';
  elsif v_m.p2_id = v_uid then v_win := 'P1';
  else raise exception 'not_a_participant' using errcode = '28000';
  end if;

  update public.matches set
    status = 'finished', winner = v_win, updated_at = now()
  where id = v_m.id;

  perform public._settle_match(v_m.id);
  return jsonb_build_object('status', 'finished', 'winner', v_win);
end $$;

-- Reclama vitória se o adversário deixou o relógio expirar.
create or replace function public.claim_timeout(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m   public.matches;
  v_my  text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'unknown_match' using errcode = '22023';
  end if;

  if v_m.p1_id = v_uid then v_my := 'P1';
  elsif v_m.p2_id = v_uid then v_my := 'P2';
  else raise exception 'not_a_participant' using errcode = '28000';
  end if;

  if v_m.status <> 'active' then
    return jsonb_build_object('claimed', false, 'status', v_m.status);
  end if;
  if v_m.turn = v_my then
    raise exception 'not_opponent_turn' using errcode = '22023';
  end if;
  if v_m.time_per_turn <= 0
     or now() <= v_m.turn_started_at + make_interval(secs => v_m.time_per_turn) then
    raise exception 'not_expired' using errcode = '22023';
  end if;

  update public.matches set
    status = 'finished', winner = v_my, updated_at = now()
  where id = v_m.id;

  perform public._settle_match(v_m.id);
  return jsonb_build_object('claimed', true, 'status', 'finished', 'winner', v_my);
end $$;

-- ============================= RLS ==================================

alter table public.match_queue enable row level security;
alter table public.matches enable row level security;
alter table public.match_moves enable row level security;

-- Fila: cada um vê apenas a sua entrada; sem escrita direta.
drop policy if exists "match_queue_select_own" on public.match_queue;
create policy "match_queue_select_own"
  on public.match_queue for select to authenticated
  using (user_id = auth.uid());

-- Partidas: só os participantes veem.
drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_participant"
  on public.matches for select to authenticated
  using (p1_id = auth.uid() or p2_id = auth.uid());

-- Movimentos: só os participantes da partida veem.
drop policy if exists "match_moves_select_participant" on public.match_moves;
create policy "match_moves_select_participant"
  on public.match_moves for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_moves.match_id
        and (m.p1_id = auth.uid() or m.p2_id = auth.uid())
    )
  );

-- Leitura apenas; toda a escrita é feita por RPCs SECURITY DEFINER.
grant select on public.match_queue to authenticated;
grant select on public.matches to authenticated;
grant select on public.match_moves to authenticated;

revoke insert, update, delete on public.match_queue from anon, authenticated;
revoke insert, update, delete on public.matches from anon, authenticated;
revoke insert, update, delete on public.match_moves from anon, authenticated;

grant execute on function public.join_matchmaking(text) to authenticated;
grant execute on function public.cancel_matchmaking() to authenticated;
grant execute on function public.submit_move(uuid, int, int) to authenticated;
grant execute on function public.resign_match(uuid) to authenticated;
grant execute on function public.claim_timeout(uuid) to authenticated;

-- As funções internas não são expostas ao cliente.
revoke execute on function public._adjacent(int, int) from public;
revoke execute on function public._has_legal_move(smallint[], smallint) from public;
revoke execute on function public._has_won(smallint[], smallint) from public;
revoke execute on function public._winning_line(smallint[], smallint) from public;
revoke execute on function public._position_key(smallint[], text) from public;
revoke execute on function public._expected(int, int) from public;
revoke execute on function public._settle_match(uuid) from public;

-- ======================= Realtime (partidas) ========================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_moves'
  ) then
    alter publication supabase_realtime add table public.match_moves;
  end if;
end
$$;


-- =====================================================================
-- SECCAO: 0007_edge_authority.sql
-- =====================================================================
-- 0007_edge_authority.sql
--
-- Autoridade das jogadas movida para a Edge Function `submit-move`, que usa o
-- motor real (`@tira/engine`) para validar/aplicar o movimento e só depois
-- persiste com a service role. Esta migração dá à service_role os privilégios
-- mínimos de que a função precisa.
--
-- Aplicar via Supabase SQL Editor (dashboard → SQL Editor → New query).

-- Persistência da partida (escrita só pela service_role / RPCs).
grant select, insert, update on public.matches to service_role;
grant select, insert on public.match_moves to service_role;

-- Liquidação (Elo/XP/moedas/estatísticas) chamada pela Edge Function.
grant execute on function public._settle_match(uuid) to service_role;

-- NOTA (endurecimento opcional): quando a Edge Function estiver publicada e
-- validada, a RPC `submit_move` deixa de ser necessária como fallback e pode
-- ser revogada para tornar a função a única autoridade:
--
--   revoke execute on function public.submit_move(uuid, int, int) from authenticated;


-- =====================================================================
-- SECCAO: 0008_rooms_international.sql
-- =====================================================================
-- 0008_rooms_international.sql
--
-- Salas nacionais (Angola) e internacionais. Adiciona a coluna `region` ao
-- catálogo e semeia salas internacionais (lusófonas e globais).
--
-- Aplicar via Supabase SQL Editor. Idempotente (on conflict / add column if
-- not exists), pelo que pode correr depois da 0005 sem problemas.

alter table public.rooms
  add column if not exists region text not null default 'national'
    check (region in ('national', 'international'));

-- Salas nacionais já existentes.
update public.rooms set region = 'national'
  where id in ('angola', 'luanda', 'benguela', 'huambo', 'cabinda');

-- 'global' passa a ser a sala internacional gratuita.
update public.rooms set region = 'international' where id = 'global';

-- Salas internacionais.
insert into public.rooms (id, name, region, capacity, stake, is_featured, sort_order) values
  ('portugal',   'Portugal',          'international',  50, 100, false, 10),
  ('brasil',     'Brasil',            'international',  60, 100, false, 11),
  ('mocambique', 'Moçambique',        'international',  40,  50, false, 12),
  ('caboverde',  'Cabo Verde',        'international',  30,  50, false, 13),
  ('africa',     'África Lusófona',   'international',  80,  50, false, 14),
  ('europa',     'Europa',            'international',  80, 100, false, 15),
  ('america',    'América',           'international',  80, 100, false, 16),
  ('mundo',      'Mundo',             'international', 100,   0, false, 17)
on conflict (id) do update set
  name        = excluded.name,
  region      = excluded.region,
  capacity    = excluded.capacity,
  stake       = excluded.stake,
  is_featured = excluded.is_featured,
  sort_order  = excluded.sort_order;

-- =====================================================================
-- SECCAO: 0009_friends.sql
-- =====================================================================
-- =====================================================================
-- Online — Fase 3: amizades (Supabase)
--
-- PRINCÍPIO DE AUTORIDADE:
--   * O cliente NUNCA escreve em `public.friendships` (RLS bloqueia
--     INSERT/UPDATE/DELETE); tudo passa por RPCs SECURITY DEFINER.
--   * Um pedido de amizade é uma linha `pending`; ao aceitar passa a
--     `accepted`; ao recusar/remover a linha é apagada.
--   * Um par (A,B) tem no máximo UMA linha, em qualquer direção.
-- =====================================================================

-- ============================ Tabela ================================

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

-- Um pedido/amizade por par, em qualquer direção.
create unique index if not exists uq_friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists idx_friendships_requester on public.friendships (requester_id, status);
create index if not exists idx_friendships_addressee on public.friendships (addressee_id, status);

-- ============================ RPCs ==================================

-- Envia um pedido de amizade a outro utilizador.
--   * Se já forem amigos → 'already_friends'.
--   * Se já houver pedido (na direção A→B) → 'already_requested'.
--   * Se houver pedido pendente de B→A → aceita automaticamente.
--   * Caso contrário cria um pedido pendente.
create or replace function public.send_friend_request(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.friendships;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_user_id is null then
    raise exception 'unknown_user' using errcode = '22023';
  end if;
  if p_user_id = v_uid then
    raise exception 'cannot_add_self' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'unknown_user' using errcode = '22023';
  end if;

  select * into v_existing from public.friendships
    where (requester_id = v_uid and addressee_id = p_user_id)
       or (requester_id = p_user_id and addressee_id = v_uid)
    limit 1;

  if found then
    if v_existing.status = 'accepted' then
      return jsonb_build_object('status', 'already_friends');
    end if;
    if v_existing.requester_id = v_uid then
      return jsonb_build_object('status', 'already_requested');
    end if;
    -- Pedido pendente de p_user_id para mim → aceita.
    update public.friendships
      set status = 'accepted', updated_at = now()
      where id = v_existing.id;
    return jsonb_build_object('status', 'accepted');
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (v_uid, p_user_id);
  return jsonb_build_object('status', 'requested');
end $$;

-- Aceita ou recusa um pedido recebido. Só o destinatário pode responder.
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_f   public.friendships;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_f from public.friendships where id = p_id for update;
  if not found then
    raise exception 'unknown_request' using errcode = '22023';
  end if;
  if v_f.addressee_id <> v_uid then
    raise exception 'not_a_participant' using errcode = '28000';
  end if;

  if p_accept then
    update public.friendships set status = 'accepted', updated_at = now() where id = p_id;
    return jsonb_build_object('status', 'accepted');
  else
    delete from public.friendships where id = p_id;
    return jsonb_build_object('status', 'declined');
  end if;
end $$;

-- Remove uma amizade existente (ou cancela um pedido feito por mim).
create or replace function public.remove_friend(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.friendships
    where (requester_id = v_uid and addressee_id = p_user_id)
       or (requester_id = p_user_id and addressee_id = v_uid);

  return jsonb_build_object('status', 'removed');
end $$;

-- ============================= RLS ==================================

alter table public.friendships enable row level security;

-- Só as partes veem uma amizade.
drop policy if exists "friendships_select_party" on public.friendships;
create policy "friendships_select_party"
  on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Leitura apenas; toda a escrita é feita por RPCs SECURITY DEFINER.
grant select on public.friendships to authenticated;
revoke insert, update, delete on public.friendships from anon, authenticated;

grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ======================= Realtime (amizades) ========================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end
$$;

-- =====================================================================
-- SECCAO: 0010_online_tournaments.sql
-- =====================================================================
-- =====================================================================
-- Online — Fase 3: torneios online (Supabase)
--
-- PRINCÍPIO DE AUTORIDADE:
--   * O cliente NUNCA escreve em `tournaments`, `tournament_entries` ou
--     `tournament_matches` (RLS bloqueia); tudo passa por RPCs.
--   * As jogas de um torneio são linhas normais em `public.matches` (a
--     mesma autoridade/liquidação da Fase 2). O bracket apenas os referencia.
--   * O bracket é resolvido pela função interna `_propagate_tournament`,
--     que é idempotente: recalcula p1/p2 a partir dos vencedores já
--     decididos e fecha BYEs automaticamente.
--   * Em caso de empate no jogo, o vencedor decide-se por maior Elo e,
--     em igualdade, por ordem crescente de uuid (determinístico).
-- =====================================================================

-- ============================ Tabelas ================================

create table if not exists public.tournaments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 60),
  description   text not null default '',
  format        text not null default 'single_elim' check (format in ('single_elim')),
  max_players   integer not null default 8 check (max_players between 2 and 64),
  entry_fee     integer not null default 0 check (entry_fee >= 0),
  prize         integer not null default 0 check (prize >= 0),
  pot           integer not null default 0 check (pot >= 0),
  room_id       text not null default 'global' references public.rooms (id) on delete cascade,
  time_per_turn integer not null default 45 check (time_per_turn >= 0),
  status        text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  champion_id   uuid,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_tournaments_status on public.tournaments (status, created_at desc);

create table if not exists public.tournament_entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'active' check (status in ('active', 'eliminated')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tournament_id, user_id)
);

-- Compatibilidade com instalações anteriores (a coluna foi adicionada depois).
alter table public.tournament_entries
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_tournament_entries_tournament on public.tournament_entries (tournament_id, created_at);

-- Uma partida do bracket. `p1_id`/`p2_id`/`winner_id` são uuid soltos
-- (sem FK) para que eliminar um utilizador não destrua a chave.
create table if not exists public.tournament_matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round         integer not null check (round >= 1),
  slot          integer not null check (slot >= 1),
  p1_id         uuid,
  p2_id         uuid,
  winner_id     uuid,
  match_id      uuid references public.matches (id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'ready', 'playing', 'finished', 'bye')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tournament_id, round, slot)
);

create index if not exists idx_tournament_matches_round
  on public.tournament_matches (tournament_id, round, slot);

-- Inscrição semanal gratuita (seed do catálogo online). Idempotente: só
-- insere se ainda não existir um torneio com o mesmo nome.
insert into public.tournaments (id, name, description, entry_fee, prize, max_players, room_id, status)
select
  '00000000-0000-4000-8000-000000000010',
  'Torneio Global',
  'Eliminatória simples, 8 jogadores. Inscrições abertas.',
  0, 1000, 8, 'global', 'open'
where not exists (select 1 from public.tournaments where name = 'Torneio Global');

-- ===================== Função interna ================================

-- Propaga o bracket: preenche p1/p2, fecha BYEs, marca jogos prontos e,
-- quando todos os jogos estão decididos, termina o torneio e paga o prémio.
-- Idempotente (pode ser chamada quantas vezes for preciso).
create or replace function public._propagate_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t          public.tournaments;
  v_n          int;
  v_round      int;
  v_count      int;
  v_prev_count int;
  v_m          public.tournament_matches;
  v_p1         uuid;
  v_p2         uuid;
  v_opp_exists boolean;
  v_total      int;
  v_decided    int;
  v_champ      uuid;
begin
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then return; end if;
  if v_t.status = 'completed' or v_t.status = 'cancelled' then return; end if;

  select coalesce(count(*), 0) into v_n from public.tournament_entries
    where tournament_id = p_tournament_id;
  if v_n < 1 then return; end if;

  select coalesce(max(round), 1) into v_round from public.tournament_matches
    where tournament_id = p_tournament_id;

  for r in 1..v_round loop
    -- Contagem de jogos nesta ronda e na anterior.
    select coalesce(count(*), 0) into v_count from public.tournament_matches
      where tournament_id = p_tournament_id and round = r;
    if v_count = 0 then continue; end if;

    if r = 1 then
      v_prev_count := v_n;
    else
      select coalesce(count(*), 0) into v_prev_count from public.tournament_matches
        where tournament_id = p_tournament_id and round = r - 1;
    end if;

    -- Preenche os lados de cada jogo desta ronda.
    for v_m in
      select * from public.tournament_matches
      where tournament_id = p_tournament_id and round = r
      order by slot
    loop
      if r = 1 then
        -- Ordem fixa (created_at, user_id) para a chave nunca mudar.
        select user_id into v_p1 from public.tournament_entries
          where tournament_id = p_tournament_id
          order by created_at, user_id
          offset (2 * v_m.slot - 2) limit 1;

        if 2 * v_m.slot <= v_n then
          select user_id into v_p2 from public.tournament_entries
            where tournament_id = p_tournament_id
            order by created_at, user_id
            offset (2 * v_m.slot - 1) limit 1;
        else
          v_p2 := null;
        end if;

        update public.tournament_matches set p1_id = v_p1, p2_id = v_p2 where id = v_m.id;
        v_m.p1_id := v_p1;
        v_m.p2_id := v_p2;
      else
        -- Vencedores da ronda anterior (slot 2s-1 → p1, slot 2s → p2).
        select winner_id into v_p1 from public.tournament_matches
          where tournament_id = p_tournament_id and round = r - 1 and slot = 2 * v_m.slot - 1;

        if 2 * v_m.slot <= v_prev_count then
          select winner_id into v_p2 from public.tournament_matches
            where tournament_id = p_tournament_id and round = r - 1 and slot = 2 * v_m.slot;
        else
          v_p2 := null;
        end if;

        update public.tournament_matches set p1_id = v_p1, p2_id = v_p2
          where id = v_m.id and (p1_id is distinct from v_p1 or p2_id is distinct from v_p2);
        v_m.p1_id := v_p1;
        v_m.p2_id := v_p2;
      end if;
    end loop;

    -- Resolve jogos desta ronda (BYE / pronto / pendente).
    for v_m in
      select * from public.tournament_matches
      where tournament_id = p_tournament_id and round = r and winner_id is null
      order by slot
    loop
      if 2 * v_m.slot > v_prev_count then
        v_opp_exists := false;
      else
        v_opp_exists := true;
      end if;

      if v_m.p1_id is not null and v_m.p2_id is not null then
        -- Pronto a jogar (ou jogo já em curso/terminado — não regride).
        if v_m.status = 'pending' or v_m.status = 'bye' then
          update public.tournament_matches set status = 'ready' where id = v_m.id;
        elsif v_m.status = 'playing' and v_m.match_id is null then
          update public.tournament_matches set status = 'ready' where id = v_m.id;
        end if;
      elsif v_m.p1_id is not null and not v_opp_exists then
        -- BYE: o par avança diretamente sem jogo.
        update public.tournament_matches set
          winner_id = v_m.p1_id,
          status = 'bye',
          updated_at = now()
        where id = v_m.id;
      elsif v_m.p2_id is not null and not v_opp_exists then
        update public.tournament_matches set
          winner_id = v_m.p2_id,
          status = 'bye',
          updated_at = now()
        where id = v_m.id;
      else
        if v_m.status = 'ready' or v_m.status = 'bye' then
          update public.tournament_matches set status = 'pending' where id = v_m.id;
        end if;
      end if;
    end loop;
  end loop;

  -- Termino: todos os jogos decididos → campeão + prémio.
  select coalesce(count(*), 0) into v_total from public.tournament_matches
    where tournament_id = p_tournament_id;
  select coalesce(count(*), 0) into v_decided from public.tournament_matches
    where tournament_id = p_tournament_id and winner_id is not null;

  if v_total > 0 and v_decided = v_total then
    select winner_id into v_champ from public.tournament_matches
      where tournament_id = p_tournament_id
      order by round desc, slot
      limit 1;

    if v_champ is not null then
      update public.tournaments set status = 'completed', champion_id = v_champ, updated_at = now()
        where id = p_tournament_id and status <> 'completed';

      if found then
        update public.profiles set coins = coins + v_t.pot, updated_at = now()
          where id = v_champ;
      end if;
    end if;
  end if;
end $$;

revoke execute on function public._propagate_tournament(uuid) from public;

-- ============================ RPCs ====================================

-- Cria um torneio aberto.
create or replace function public.create_tournament(
  p_name        text,
  p_entry_fee   integer default 0,
  p_prize       integer default 0,
  p_max_players integer default 8,
  p_room_id     text default 'global'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'unknown_room' using errcode = '22023';
  end if;

  insert into public.tournaments (name, entry_fee, prize, max_players, room_id, created_by)
  values (trim(p_name), coalesce(p_entry_fee, 0), coalesce(p_prize, 0),
          coalesce(p_max_players, 8), p_room_id, v_uid)
  returning id into v_id;

  return jsonb_build_object('status', 'created', 'tournament_id', v_id);
end $$;

-- Inscreve um jogador (desconta a inscrição).
create or replace function public.join_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_t       public.tournaments;
  v_count   int;
  v_coins   int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'unknown_tournament' using errcode = '22023';
  end if;
  if v_t.status <> 'open' then
    raise exception 'tournament_not_open' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('tor:' || p_tournament_id::text));

  select coalesce(count(*), 0) into v_count from public.tournament_entries
    where tournament_id = p_tournament_id;
  if v_count >= v_t.max_players then
    raise exception 'tournament_full' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournament_entries
             where tournament_id = p_tournament_id and user_id = v_uid) then
    return jsonb_build_object('status', 'already_joined');
  end if;

  select coalesce(coins, 0) into v_coins from public.profiles where id = v_uid;
  v_coins := coalesce(v_coins, 0);
  if v_t.entry_fee > 0 and v_coins < v_t.entry_fee then
    raise exception 'not_enough_coins' using errcode = '22023';
  end if;

  if v_t.entry_fee > 0 then
    update public.profiles set coins = coins - v_t.entry_fee, updated_at = now() where id = v_uid;
  end if;

  insert into public.tournament_entries (tournament_id, user_id)
  values (p_tournament_id, v_uid);

  select coalesce(count(*), 0) into v_count from public.tournament_entries
    where tournament_id = p_tournament_id;

  return jsonb_build_object('status', 'joined', 'count', v_count);
end $$;

-- Desinscreve (reembolso) enquanto o torneio ainda está aberto.
create or replace function public.leave_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_t   public.tournaments;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'unknown_tournament' using errcode = '22023';
  end if;
  if v_t.status <> 'open' then
    raise exception 'tournament_already_started' using errcode = '22023';
  end if;

  delete from public.tournament_entries
    where tournament_id = p_tournament_id and user_id = v_uid;

  if v_t.entry_fee > 0 then
    update public.profiles set coins = coins + v_t.entry_fee, updated_at = now() where id = v_uid;
  end if;

  return jsonb_build_object('status', 'left');
end $$;

-- Inicia o torneio (só o criador) e gera a chave.
create or replace function public.start_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_t       public.tournaments;
  v_n       int;
  v_round   int := 1;
  v_count   int;
  v_slot    int;
  v_p1      uuid;
  v_p2      uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'unknown_tournament' using errcode = '22023';
  end if;
  if v_t.status <> 'open' then
    raise exception 'tournament_already_started' using errcode = '22023';
  end if;
  if v_t.created_by is distinct from v_uid then
    raise exception 'not_tournament_owner' using errcode = '28000';
  end if;

  select coalesce(count(*), 0) into v_n from public.tournament_entries
    where tournament_id = p_tournament_id;
  if v_n < 2 then
    raise exception 'not_enough_players' using errcode = '22023';
  end if;

  update public.tournaments set
    status = 'in_progress',
    pot = (entry_fee * v_n) + prize,
    updated_at = now()
  where id = p_tournament_id;

  -- Ronda 1: pares consecutivos (o último, com número ímpar, fica em BYE).
  v_count := (v_n + 1) / 2;
  for v_slot in 1..v_count loop
    select user_id into v_p1 from public.tournament_entries
      where tournament_id = p_tournament_id
      order by created_at, user_id offset (2 * v_slot - 2) limit 1;

    if 2 * v_slot <= v_n then
      select user_id into v_p2 from public.tournament_entries
        where tournament_id = p_tournament_id
        order by created_at, user_id offset (2 * v_slot - 1) limit 1;
    else
      v_p2 := null;
    end if;

    insert into public.tournament_matches (tournament_id, round, slot, p1_id, p2_id, status)
    values (p_tournament_id, v_round, v_slot, v_p1, v_p2,
            case when v_p2 is null then 'bye' else 'ready' end);
  end loop;

  -- Precria as rondas seguintes (slot counts = ceil do anterior / 2).
  while v_count > 1 loop
    v_count := (v_count + 1) / 2;
    v_round := v_round + 1;
    for v_slot in 1..v_count loop
      insert into public.tournament_matches (tournament_id, round, slot, status)
      values (p_tournament_id, v_round, v_slot, 'pending')
      on conflict do nothing;
    end loop;
  end loop;

  perform public._propagate_tournament(p_tournament_id);

  return jsonb_build_object('status', 'started', 'players', v_n);
end $$;

-- Abre o jogo online de um par já emparelhado no bracket.
create or replace function public.start_tournament_match(p_tournament_match_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tm  public.tournament_matches;
  v_t   public.tournaments;
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_tm from public.tournament_matches where id = p_tournament_match_id for update;
  if not found then
    raise exception 'unknown_bracket_match' using errcode = '22023';
  end if;
  select * into v_t from public.tournaments where id = v_tm.tournament_id for update;
  if v_t.status <> 'in_progress' then
    raise exception 'tournament_not_active' using errcode = '22023';
  end if;
  if v_tm.p1_id is null or v_tm.p2_id is null then
    raise exception 'match_not_ready' using errcode = '22023';
  end if;
  if v_uid <> v_tm.p1_id and v_uid <> v_tm.p2_id then
    raise exception 'not_a_participant' using errcode = '28000';
  end if;

  if v_tm.match_id is not null then
    return jsonb_build_object('status', 'playing', 'match_id', v_tm.match_id);
  end if;

  insert into public.matches
    (room_id, stake, p1_id, p2_id, turn, board, pos_counts, time_per_turn, turn_started_at)
  values
    (v_t.room_id, 0, v_tm.p1_id, v_tm.p2_id, 'P1', '{1,1,1,0,0,0,-1,-1,-1}'::smallint[],
     jsonb_build_object(public._position_key('{1,1,1,0,0,0,-1,-1,-1}'::smallint[], 'P1'), 1),
     v_t.time_per_turn, now())
  returning id into v_id;

  update public.tournament_matches set
    match_id = v_id, status = 'playing', updated_at = now()
  where id = v_tm.id;

  return jsonb_build_object('status', 'playing', 'match_id', v_id);
end $$;

-- Regista o resultado de um jogo do bracket e avança o vencedor.
create or replace function public.report_tournament_result(p_tournament_match_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_tm    public.tournament_matches;
  v_match public.matches;
  v_win   uuid;
  v_lose  uuid;
  v_elo1  int;
  v_elo2  int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_tm from public.tournament_matches where id = p_tournament_match_id for update;
  if not found then
    raise exception 'unknown_bracket_match' using errcode = '22023';
  end if;
  if v_uid <> v_tm.p1_id and v_uid <> v_tm.p2_id then
    raise exception 'not_a_participant' using errcode = '28000';
  end if;
  if v_tm.match_id is null then
    raise exception 'match_not_started' using errcode = '22023';
  end if;
  if v_tm.winner_id is not null then
    return jsonb_build_object('status', 'already_reported', 'winner_id', v_tm.winner_id);
  end if;

  select * into v_match from public.matches where id = v_tm.match_id;
  if not found or v_match.status <> 'finished' then
    raise exception 'match_not_finished' using errcode = '22023';
  end if;

  if v_match.winner = 'P1' then
    v_win := v_tm.p1_id;
    v_lose := v_tm.p2_id;
  elsif v_match.winner = 'P2' then
    v_win := v_tm.p2_id;
    v_lose := v_tm.p1_id;
  else
    -- Empate: desempate por Elo (empate por ordem crescente de uuid).
    select coalesce(elo, 1000) into v_elo1 from public.profiles where id = v_tm.p1_id;
    select coalesce(elo, 1000) into v_elo2 from public.profiles where id = v_tm.p2_id;
    if coalesce(v_elo1, 1000) > coalesce(v_elo2, 1000) then
      v_win := v_tm.p1_id; v_lose := v_tm.p2_id;
    elsif coalesce(v_elo2, 1000) > coalesce(v_elo1, 1000) then
      v_win := v_tm.p2_id; v_lose := v_tm.p1_id;
    elsif v_tm.p1_id::text < v_tm.p2_id::text then
      v_win := v_tm.p1_id; v_lose := v_tm.p2_id;
    else
      v_win := v_tm.p2_id; v_lose := v_tm.p1_id;
    end if;
  end if;

  update public.tournament_matches set
    winner_id = v_win, status = 'finished', updated_at = now()
  where id = v_tm.id;

  update public.tournament_entries set status = 'eliminated', updated_at = now()
    where tournament_id = v_tm.tournament_id and user_id = v_lose;

  perform public._propagate_tournament(v_tm.tournament_id);

  return jsonb_build_object('status', 'finished', 'winner_id', v_win);
end $$;

-- ============================= RLS ====================================

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_matches enable row level security;

-- Catálogo público (qualquer jogador autenticado pode ver torneios).
drop policy if exists "tournaments_select_authenticated" on public.tournaments;
create policy "tournaments_select_authenticated"
  on public.tournaments for select to authenticated
  using (true);

drop policy if exists "tournament_entries_select_authenticated" on public.tournament_entries;
create policy "tournament_entries_select_authenticated"
  on public.tournament_entries for select to authenticated
  using (true);

drop policy if exists "tournament_matches_select_authenticated" on public.tournament_matches;
create policy "tournament_matches_select_authenticated"
  on public.tournament_matches for select to authenticated
  using (true);

grant select on public.tournaments to authenticated;
grant select on public.tournament_entries to authenticated;
grant select on public.tournament_matches to authenticated;

revoke insert, update, delete on public.tournaments from anon, authenticated;
revoke insert, update, delete on public.tournament_entries from anon, authenticated;
revoke insert, update, delete on public.tournament_matches from anon, authenticated;

grant execute on function public.create_tournament(text, integer, integer, integer, text) to authenticated;
grant execute on function public.join_tournament(uuid) to authenticated;
grant execute on function public.leave_tournament(uuid) to authenticated;
grant execute on function public.start_tournament(uuid) to authenticated;
grant execute on function public.start_tournament_match(uuid) to authenticated;
grant execute on function public.report_tournament_result(uuid) to authenticated;

-- ======================= Realtime =====================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournaments'
  ) then
    alter publication supabase_realtime add table public.tournaments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_entries'
  ) then
    alter publication supabase_realtime add table public.tournament_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_matches'
  ) then
    alter publication supabase_realtime add table public.tournament_matches;
  end if;
end
$$;

-- =====================================================================
-- SECCAO: 0011_virtual_bets.sql
-- =====================================================================
-- =====================================================================
-- Online — Fase 3: apostas virtuais (economia correta das apostas)
-- Aplicar no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
--
-- PROBLEMA RESOLVIDO:
--   Na Fase 2, `join_matchmaking` criava a partida com `stake` mas nunca
--   debitava ninguém; `_settle_match` pagava `stake` ao vencedor. Resultado:
--   as moedas eram criadas do nada (inflação). Faltava também verificar saldo.
--
-- MODELO (zero-sum):
--   * Ao ENTRAR NA FILA de uma sala com aposta, a aposta é RETIDA (escrow):
--     `coins = coins - stake`. Se não houver saldo → `not_enough_coins`.
--   * SAIR DA FILA (cancelar) reembolsa a aposta.
--   * Quando dois jogadores emparelham, as duas apostas (já retidas) formam o
--     POT. `stakes_held = true` marca a partida.
--   * Liquidação: vencedor recebe `stake * 2` (o pot); empate reembolsa `stake`
--     a cada um. Net: vencedor +stake, perdedor -stake, empate 0.
--
-- MOEDA VIRTUAL (KZ) — nunca dinheiro real (spec §23). Não afeta as salas
-- gratuitas (stake = 0) nem os jogos de torneio (stake = 0).
-- =====================================================================

-- Marca partidas cujas apostas já foram retidas (para a liquidação saber se
-- deve pagar o pot ou manter o comportamento legado).
alter table public.matches add column if not exists stakes_held boolean not null default false;

-- Bónus de boas-vindas server-side: sem saldo não há apostas possíveis.
-- (Espelha os 5000 KZ iniciais do perfil local — spec §7.2.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, coins) values (new.id, 5000)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ========================= Liquidação (zero-sum) =====================

create or replace function public._settle_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m       public.matches;
  v_elo1    int;
  v_elo2    int;
  v_delta   int;
  v_s1      numeric;
  v_xp1     int := 0;
  v_xp2     int := 0;
  v_coin1   int := 0;
  v_coin2   int := 0;
  k         constant int := 32;
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if not found then return; end if;
  if v_m.status <> 'finished' or v_m.winner is null or v_m.settled then return; end if;

  select coalesce(elo, 1000) into v_elo1 from public.profiles where id = v_m.p1_id;
  select coalesce(elo, 1000) into v_elo2 from public.profiles where id = v_m.p2_id;
  v_elo1 := coalesce(v_elo1, 1000);
  v_elo2 := coalesce(v_elo2, 1000);

  -- Quando as apostas foram retidas, o vencedor leva o pot (2×stake) e o
  -- empate reembolsa a aposta a cada jogador. Sem retenção (partidas legadas
  -- ou de torneio com stake = 0), mantém-se o pagamento direto do stake.
  if v_m.winner = 'draw' then
    v_s1 := 0.5;
    v_xp1 := 15; v_xp2 := 15;
    if v_m.stakes_held then
      v_coin1 := v_m.stake; v_coin2 := v_m.stake;
    end if;
  elsif v_m.winner = 'P1' then
    v_s1 := 1.0;
    v_xp1 := 40; v_xp2 := 10;
    v_coin1 := case when v_m.stakes_held then v_m.stake * 2 else v_m.stake end;
    v_coin2 := 0;
  else
    v_s1 := 0.0;
    v_xp1 := 10; v_xp2 := 40;
    v_coin1 := 0;
    v_coin2 := case when v_m.stakes_held then v_m.stake * 2 else v_m.stake end;
  end if;

  v_delta := round(k * (v_s1 - public._expected(v_elo1, v_elo2)));

  update public.profiles set
    elo = greatest(100, elo + v_delta),
    xp = xp + v_xp1,
    level = 1 + ((xp + v_xp1) / 100),
    coins = coins + v_coin1,
    wins = wins + case when v_m.winner = 'P1' then 1 else 0 end,
    losses = losses + case when v_m.winner = 'P2' then 1 else 0 end,
    draws = draws + case when v_m.winner = 'draw' then 1 else 0 end,
    updated_at = now()
  where id = v_m.p1_id;

  update public.profiles set
    elo = greatest(100, elo - v_delta),
    xp = xp + v_xp2,
    level = 1 + ((xp + v_xp2) / 100),
    coins = coins + v_coin2,
    wins = wins + case when v_m.winner = 'P2' then 1 else 0 end,
    losses = losses + case when v_m.winner = 'P1' then 1 else 0 end,
    draws = draws + case when v_m.winner = 'draw' then 1 else 0 end,
    updated_at = now()
  where id = v_m.p2_id;

  update public.matches set settled = true, updated_at = now() where id = v_m.id;
end $$;

-- ===================== Matchmaking com retenção =====================

create or replace function public.join_matchmaking(p_room_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.rooms;
  v_opp   public.match_queue;
  v_match public.matches;
  v_prev  public.match_queue;
  v_board smallint[] := '{1,1,1,0,0,0,-1,-1,-1}'::smallint[];
  v_coins int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'unknown_room' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('mm:' || p_room_id));

  -- Se já estava na fila, reembolsa a aposta retida e remove a entrada.
  select * into v_prev from public.match_queue where user_id = v_uid for update;
  if found then
    if v_prev.stake > 0 then
      update public.profiles set coins = coins + v_prev.stake, updated_at = now()
        where id = v_uid;
    end if;
    delete from public.match_queue where id = v_prev.id;
  end if;

  -- Salas com aposta exigem saldo; a aposta é retida já (escrow).
  if v_room.stake > 0 then
    select coalesce(coins, 0) into v_coins from public.profiles where id = v_uid;
    if coalesce(v_coins, 0) < v_room.stake then
      raise exception 'not_enough_coins' using errcode = '22023';
    end if;
    update public.profiles set coins = coins - v_room.stake, updated_at = now()
      where id = v_uid;
  end if;

  select * into v_opp from public.match_queue
    where room_id = p_room_id and user_id <> v_uid
    order by created_at asc
    limit 1
    for update skip locked;

  if found then
    -- As apostas de ambos já estão retidas: a do adversário ao entrar na
    -- fila, a nossa acima. Não há reembolso aqui — as apostas passam a pot.
    insert into public.matches
      (room_id, stake, stakes_held, p1_id, p2_id, turn, board, pos_counts, turn_started_at)
    values
      (p_room_id, v_room.stake, v_room.stake > 0, v_opp.user_id, v_uid, 'P1', v_board,
       jsonb_build_object(public._position_key(v_board, 'P1'), 1), now())
    returning * into v_match;

    delete from public.match_queue where id = v_opp.id;
    delete from public.match_queue where user_id = v_uid;

    return jsonb_build_object('status', 'matched', 'match_id', v_match.id, 'side', 'P2');
  else
    insert into public.match_queue (user_id, room_id, stake, elo)
    values (v_uid, p_room_id, v_room.stake,
            coalesce((select elo from public.profiles where id = v_uid), 1000));
    return jsonb_build_object('status', 'queued');
  end if;
end $$;

-- Sai da fila e reembolsa a aposta retida (idempotente).
create or replace function public.cancel_matchmaking()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_stake int;
begin
  if v_uid is null then return; end if;

  delete from public.match_queue where user_id = v_uid returning stake into v_stake;
  if coalesce(v_stake, 0) > 0 then
    update public.profiles set coins = coins + v_stake, updated_at = now()
      where id = v_uid;
  end if;
end $$;

-- Reforço de privilégios (create or replace preserva-os, mas reafirmamos).
revoke execute on function public._settle_match(uuid) from public;
grant execute on function public.join_matchmaking(text) to authenticated;
grant execute on function public.cancel_matchmaking() to authenticated;

-- =====================================================================
-- SECCAO: 0012_notifications.sql
-- =====================================================================
-- =====================================================================
-- Online — Fase 3: notificações (Supabase)
--
-- PRINCÍPIO DE AUTORIDADE:
--   * O cliente NUNCA escreve em `public.notifications` (RLS bloqueia
--     INSERT/UPDATE/DELETE); só marca como lida / apaga as suas via RPCs.
--   * As notificações são criadas pelo SERVIDOR através de TRIGGERS nas
--     tabelas de eventos (amizades, partidas, torneios). Assim não é
--     preciso reescrever as RPCs de negócio existentes.
--   * Feedback em tempo real via Realtime (só as linhas do próprio).
-- =====================================================================

-- ============================ Tabela ================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_user
  on public.notifications (user_id, read, created_at desc);

-- ======================= Inserção interna ===========================

-- Helper interno usado pelos triggers. Execute revogado do público.
create or replace function public._notify(
  p_user  uuid,
  p_kind  text,
  p_title text,
  p_body  text,
  p_data  jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb));
end $$;

revoke execute on function public._notify(uuid, text, text, text, jsonb) from public;

-- ================== Triggers (criação de notificações) ==============

-- Amizades: pedido recebido e pedido aceite.
create or replace function public._notify_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if TG_OP = 'INSERT' then
    if new.status = 'pending' then
      select username into v_name from public.profiles where id = new.requester_id;
      perform public._notify(new.addressee_id, 'friend_request', 'Novo pedido de amizade',
        coalesce(v_name, 'Um jogador') || ' quer ser teu amigo.',
        jsonb_build_object('friendship_id', new.id, 'user_id', new.requester_id));
    elsif new.status = 'accepted' then
      select username into v_name from public.profiles where id = new.addressee_id;
      perform public._notify(new.requester_id, 'friend_accepted', 'Pedido aceite',
        coalesce(v_name, 'O jogador') || ' aceitou o teu pedido de amizade.',
        jsonb_build_object('friendship_id', new.id, 'user_id', new.addressee_id));
    end if;
    return new;
  end if;

  if TG_OP = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    select username into v_name from public.profiles where id = new.addressee_id;
    perform public._notify(new.requester_id, 'friend_accepted', 'Pedido aceite',
      coalesce(v_name, 'O jogador') || ' aceitou o teu pedido de amizade.',
      jsonb_build_object('friendship_id', new.id, 'user_id', new.addressee_id));
  end if;
  return new;
end $$;

-- Partidas normais: resultado para ambos (os jogos de torneio têm as suas
-- próprias notificações no bracket, por isso são ignorados aqui).
create or replace function public._notify_match_result()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_stake int := coalesce(new.stake, 0);
  v_held  boolean := coalesce(new.stakes_held, false);
  v_room  text := new.room_id;
  v_n1    text;
  v_n2    text;
  v_extra text;
begin
  if not (new.status = 'finished' and old.status is distinct from 'finished') then
    return new;
  end if;
  if exists (select 1 from public.tournament_matches tm where tm.match_id = new.id) then
    return new;
  end if;

  select coalesce(username, 'Adversário') into v_n1 from public.profiles where id = new.p1_id;
  select coalesce(username, 'Adversário') into v_n2 from public.profiles where id = new.p2_id;
  v_extra := case when v_held and v_stake > 0 then ' (' || v_stake || ' KZ)' else '' end;

  if new.winner = 'P1' then
    perform public._notify(new.p1_id, 'match_win', 'Vitória!',
      'Ganhaste a ' || v_n2 || ' em ' || v_room || v_extra || '.',
      jsonb_build_object('match_id', new.id, 'room_id', v_room, 'result', 'win'));
    perform public._notify(new.p2_id, 'match_loss', 'Derrota',
      'Perdeste com ' || v_n1 || ' em ' || v_room || v_extra || '.',
      jsonb_build_object('match_id', new.id, 'room_id', v_room, 'result', 'loss'));
  elsif new.winner = 'P2' then
    perform public._notify(new.p2_id, 'match_win', 'Vitória!',
      'Ganhaste a ' || v_n1 || ' em ' || v_room || v_extra || '.',
      jsonb_build_object('match_id', new.id, 'room_id', v_room, 'result', 'win'));
    perform public._notify(new.p1_id, 'match_loss', 'Derrota',
      'Perdeste com ' || v_n2 || ' em ' || v_room || v_extra || '.',
      jsonb_build_object('match_id', new.id, 'room_id', v_room, 'result', 'loss'));
  elsif new.winner = 'draw' then
    perform public._notify(new.p1_id, 'match_draw', 'Empate',
      'Empataste com ' || v_n2 || ' em ' || v_room ||
      case when v_held and v_stake > 0 then ' (aposta devolvida).' else '.' end,
      jsonb_build_object('match_id', new.id, 'room_id', v_room, 'result', 'draw'));
    perform public._notify(new.p2_id, 'match_draw', 'Empate',
      'Empataste com ' || v_n1 || ' em ' || v_room ||
      case when v_held and v_stake > 0 then ' (aposta devolvida).' else '.' end,
      jsonb_build_object('match_id', new.id, 'room_id', v_room, 'result', 'draw'));
  end if;
  return new;
end $$;

-- Bracket: vencedor avança, perdedor é eliminado (ignora BYEs).
create or replace function public._notify_bracket_result()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lose  uuid;
  v_tname text;
begin
  if not (new.status = 'finished' and old.winner_id is null and new.winner_id is not null) then
    return new;
  end if;

  v_lose := case when new.winner_id = new.p1_id then new.p2_id else new.p1_id end;
  select name into v_tname from public.tournaments where id = new.tournament_id;

  perform public._notify(new.winner_id, 'tournament_advance', 'Avançaste no torneio',
    'Ganhaste o teu jogo da ronda ' || new.round || ' do torneio "' || coalesce(v_tname, '') || '".',
    jsonb_build_object('tournament_id', new.tournament_id, 'round', new.round));

  if v_lose is not null then
    perform public._notify(v_lose, 'tournament_eliminated', 'Eliminado do torneio',
      'Foste eliminado do torneio "' || coalesce(v_tname, '') || '".',
      jsonb_build_object('tournament_id', new.tournament_id));
  end if;
  return new;
end $$;

-- Torneio: começou (todos os inscritos) e campeão (prémio).
create or replace function public._notify_tournament_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare e record;
begin
  if new.status = 'in_progress' and old.status is distinct from 'in_progress' then
    for e in select user_id from public.tournament_entries
             where tournament_id = new.id and status = 'active' loop
      perform public._notify(e.user_id, 'tournament_started', 'O torneio começou',
        'O torneio "' || new.name || '" começou. Vai jogar!',
        jsonb_build_object('tournament_id', new.id));
    end loop;
  end if;

  if new.champion_id is not null and old.champion_id is distinct from new.champion_id then
    perform public._notify(new.champion_id, 'tournament_champion', 'Campeão!',
      'Ganhaste o torneio "' || new.name || '"! Prémio: ' || new.prize || ' KZ.',
      jsonb_build_object('tournament_id', new.id, 'prize', new.prize));
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_friendship on public.friendships;
create trigger trg_notify_friendship
  after insert or update on public.friendships
  for each row execute function public._notify_friendship();

drop trigger if exists trg_notify_match_result on public.matches;
create trigger trg_notify_match_result
  after update on public.matches
  for each row execute function public._notify_match_result();

drop trigger if exists trg_notify_bracket_result on public.tournament_matches;
create trigger trg_notify_bracket_result
  after update on public.tournament_matches
  for each row execute function public._notify_bracket_result();

drop trigger if exists trg_notify_tournament_change on public.tournaments;
create trigger trg_notify_tournament_change
  after update on public.tournaments
  for each row execute function public._notify_tournament_change();

-- =================== Bónus de boas-vindas (notificação) =============
-- Mantém o bónus de 5000 KZ de 0011 e acrescenta uma notificação inicial.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, coins) values (new.id, 5000)
  on conflict (id) do nothing;
  insert into public.notifications (user_id, kind, title, body)
  values (new.id, 'welcome', 'Bem-vindo ao Tira o Cocó do Meio!',
          'Recebeste 5000 KZ virtuais para começares a jogar. Boa sorte!');
  return new;
end;
$$;

-- ============================ RPCs ==================================

-- Marca uma notificação como lida.
create or replace function public.mark_notification_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.notifications set read = true, updated_at = now()
    where id = p_id and user_id = auth.uid();
end $$;

-- Marca todas as notificações do utilizador como lidas.
create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.notifications set read = true, updated_at = now()
    where user_id = auth.uid() and not read;
end $$;

-- Apaga uma notificação do utilizador.
create or replace function public.delete_notification(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.notifications where id = p_id and user_id = auth.uid();
end $$;

-- ============================= RLS ==================================

alter table public.notifications enable row level security;

-- Cada utilizador vê apenas as suas notificações.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Leitura apenas; toda a escrita é feita por triggers/RPCs SECURITY DEFINER.
grant select on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.delete_notification(uuid) to authenticated;

-- ====================== Realtime (notificações) =====================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- =====================================================================
-- SECCAO: 0013_tournament_auto_advance.sql
-- =====================================================================
-- =====================================================================
-- Online — Torneios: auto-avanço do bracket no fim do jogo (Supabase)
--
-- PROBLEMA: o bracket só avançava se alguém chamasse
-- `report_tournament_result`, e isso só acontecia ao abrir o ecrã do
-- torneio (`syncResults` no cliente). O jogo ficava "preso" em `playing`
-- e o torneio não terminava até o adversário abrir a página.
--
-- CORREÇÃO (mesmo princípio da Fase 3): um trigger em `matches` faz no
-- servidor o mesmo que a RPC, logo quando o jogo termina. A RPC mantém-se
-- como caminho manual/idempotente (`already_reported`).
-- =====================================================================

-- Regista o resultado de um jogo do bracket (internamente, idempotente).
create or replace function public._report_tournament_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tm    public.tournament_matches;
  v_match public.matches;
  v_win   uuid;
  v_lose  uuid;
  v_elo1  int;
  v_elo2  int;
begin
  select * into v_tm from public.tournament_matches
    where match_id = p_match_id for update;
  if not found then return; end if;
  if v_tm.winner_id is not null then return; end if;
  if v_tm.p1_id is null or v_tm.p2_id is null then return; end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found or v_match.status <> 'finished' then return; end if;

  if v_match.winner = 'P1' then
    v_win := v_tm.p1_id;
    v_lose := v_tm.p2_id;
  elsif v_match.winner = 'P2' then
    v_win := v_tm.p2_id;
    v_lose := v_tm.p1_id;
  else
    -- Empate: desempate por Elo (empate por ordem crescente de uuid).
    select coalesce(elo, 1000) into v_elo1 from public.profiles where id = v_tm.p1_id;
    select coalesce(elo, 1000) into v_elo2 from public.profiles where id = v_tm.p2_id;
    if coalesce(v_elo1, 1000) > coalesce(v_elo2, 1000) then
      v_win := v_tm.p1_id; v_lose := v_tm.p2_id;
    elsif coalesce(v_elo2, 1000) > coalesce(v_elo1, 1000) then
      v_win := v_tm.p2_id; v_lose := v_tm.p1_id;
    elsif v_tm.p1_id::text < v_tm.p2_id::text then
      v_win := v_tm.p1_id; v_lose := v_tm.p2_id;
    else
      v_win := v_tm.p2_id; v_lose := v_tm.p1_id;
    end if;
  end if;

  update public.tournament_matches set
    winner_id = v_win, status = 'finished', updated_at = now()
  where id = v_tm.id;

  update public.tournament_entries set status = 'eliminated', updated_at = now()
    where tournament_id = v_tm.tournament_id and user_id = v_lose;

  perform public._propagate_tournament(v_tm.tournament_id);
end $$;

revoke execute on function public._report_tournament_match(uuid) from public;

-- Gatilho: assim que um jogo termina, o bracket avança sozinho.
create or replace function public._on_match_finished()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    perform public._report_tournament_match(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_tournament_auto_advance on public.matches;
create trigger trg_tournament_auto_advance
  after update on public.matches
  for each row execute function public._on_match_finished();


-- =====================================================================
-- SECCAO: 0014_age_gate.sql
-- =====================================================================
-- =====================================================================
-- Online — Fase 3: gate 18+ nas salas/torneios com aposta (moeda virtual)
-- Aplicar no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
--
-- REQUISITO (Bloco 11 B): "gate 18+ nas salas com aposta".
--
-- MODELO:
--   * A data de nascimento é PII: NUNCA fica em `public.profiles` (que é
--     legível por todos, `using (true)`). Fica em `public.profile_private`,
--     com RLS ligado e SEM policies → inacessível ao cliente.
--   * O cliente só ESCREVE via RPC `set_birthdate(date)` (SECURITY DEFINER)
--     e só LÊ o resultado derivado (nunca terceiros) via `my_age_gate()`.
--   * `join_matchmaking` exige adulto (18+) quando `stake > 0`.
--   * `join_tournament` exige adulto (18+) quando `entry_fee > 0`.
--   * Sem data de nascimento = não adulto (bloqueado até definir).
--
-- MOEDA VIRTUAL (KZ) — nunca dinheiro real (spec §23). O gate é de idade,
-- não de pagamento.
-- =====================================================================

-- ====================== Tabela privada de idade ======================

create table if not exists public.profile_private (
  id          uuid primary key references auth.users (id) on delete cascade,
  birthdate   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profile_private enable row level security;
-- Sem policies: nenhum cliente (anon/authenticated) lê ou escreve diretamente.
revoke all on public.profile_private from anon, authenticated;

-- ============================ Helpers ================================

-- Adulto = tem data de nascimento e já fez 18 anos.
create or replace function public._is_adult(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile_private
    where id = p_user
      and birthdate is not null
      and birthdate <= (current_date - interval '18 years')
  );
$$;

revoke execute on function public._is_adult(uuid) from public, anon, authenticated;

-- ============================= RPCs ==================================

-- Define/atualiza a data de nascimento do próprio. Validação mínima.
create or replace function public.set_birthdate(p_birthdate date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_adult boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_birthdate is null then
    raise exception 'invalid_birthdate' using errcode = '22023';
  end if;
  if p_birthdate > current_date then
    raise exception 'invalid_birthdate' using errcode = '22023';
  end if;
  if p_birthdate < (current_date - interval '120 years') then
    raise exception 'invalid_birthdate' using errcode = '22023';
  end if;

  insert into public.profile_private (id, birthdate)
  values (v_uid, p_birthdate)
  on conflict (id) do update
    set birthdate = excluded.birthdate, updated_at = now();

  v_adult := public._is_adult(v_uid);
  return jsonb_build_object(
    'status',     'saved',
    'birthdate',  p_birthdate,
    'is_adult',   v_adult
  );
end $$;

grant execute on function public.set_birthdate(date) to authenticated;

-- Estado do gate do PRÓPRIO (nunca expõe a data a terceiros).
create or replace function public.my_age_gate()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_birth date;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select birthdate into v_birth from public.profile_private where id = v_uid;
  return jsonb_build_object(
    'has_birthdate', v_birth is not null,
    'birthdate',     v_birth,
    'is_adult',      public._is_adult(v_uid)
  );
end $$;

grant execute on function public.my_age_gate() to authenticated;

-- ================= Matchmaking com gate de idade =====================
-- (Reedição de 0011 apenas para acrescentar o gate 18+ quando stake > 0.)

create or replace function public.join_matchmaking(p_room_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.rooms;
  v_opp   public.match_queue;
  v_match public.matches;
  v_prev  public.match_queue;
  v_board smallint[] := '{1,1,1,0,0,0,-1,-1,-1}'::smallint[];
  v_coins int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'unknown_room' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('mm:' || p_room_id));

  -- Se já estava na fila, reembolsa a aposta retida e remove a entrada.
  select * into v_prev from public.match_queue where user_id = v_uid for update;
  if found then
    if v_prev.stake > 0 then
      update public.profiles set coins = coins + v_prev.stake, updated_at = now()
        where id = v_uid;
    end if;
    delete from public.match_queue where id = v_prev.id;
  end if;

  -- Salas com aposta: exigem 18+ e saldo; a aposta é retida já (escrow).
  if v_room.stake > 0 then
    if not public._is_adult(v_uid) then
      raise exception 'age_restricted' using errcode = '22023';
    end if;

    select coalesce(coins, 0) into v_coins from public.profiles where id = v_uid;
    if coalesce(v_coins, 0) < v_room.stake then
      raise exception 'not_enough_coins' using errcode = '22023';
    end if;
    update public.profiles set coins = coins - v_room.stake, updated_at = now()
      where id = v_uid;
  end if;

  select * into v_opp from public.match_queue
    where room_id = p_room_id and user_id <> v_uid
    order by created_at asc
    limit 1
    for update skip locked;

  if found then
    insert into public.matches
      (room_id, stake, stakes_held, p1_id, p2_id, turn, board, pos_counts, turn_started_at)
    values
      (p_room_id, v_room.stake, v_room.stake > 0, v_opp.user_id, v_uid, 'P1', v_board,
       jsonb_build_object(public._position_key(v_board, 'P1'), 1), now())
    returning * into v_match;

    delete from public.match_queue where id = v_opp.id;
    delete from public.match_queue where user_id = v_uid;

    return jsonb_build_object('status', 'matched', 'match_id', v_match.id, 'side', 'P2');
  else
    insert into public.match_queue (user_id, room_id, stake, elo)
    values (v_uid, p_room_id, v_room.stake,
            coalesce((select elo from public.profiles where id = v_uid), 1000));
    return jsonb_build_object('status', 'queued');
  end if;
end $$;

grant execute on function public.join_matchmaking(text) to authenticated;

-- ============== Torneios com gate de idade (entry_fee > 0) =============
-- (Reedição de 0010 apenas para acrescentar o gate 18+ quando há taxa.)

create or replace function public.join_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_t       public.tournaments;
  v_count   int;
  v_coins   int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'unknown_tournament' using errcode = '22023';
  end if;
  if v_t.status <> 'open' then
    raise exception 'tournament_not_open' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('tor:' || p_tournament_id::text));

  select coalesce(count(*), 0) into v_count from public.tournament_entries
    where tournament_id = p_tournament_id;
  if v_count >= v_t.max_players then
    raise exception 'tournament_full' using errcode = '22023';
  end if;
  if exists (select 1 from public.tournament_entries
             where tournament_id = p_tournament_id and user_id = v_uid) then
    return jsonb_build_object('status', 'already_joined');
  end if;

  -- Torneios com taxa de inscrição: exigem 18+.
  if v_t.entry_fee > 0 and not public._is_adult(v_uid) then
    raise exception 'age_restricted' using errcode = '22023';
  end if;

  select coalesce(coins, 0) into v_coins from public.profiles where id = v_uid;
  v_coins := coalesce(v_coins, 0);
  if v_t.entry_fee > 0 and v_coins < v_t.entry_fee then
    raise exception 'not_enough_coins' using errcode = '22023';
  end if;

  if v_t.entry_fee > 0 then
    update public.profiles set coins = coins - v_t.entry_fee, updated_at = now() where id = v_uid;
  end if;

  insert into public.tournament_entries (tournament_id, user_id)
  values (p_tournament_id, v_uid);

  select coalesce(count(*), 0) into v_count from public.tournament_entries
    where tournament_id = p_tournament_id;

  return jsonb_build_object('status', 'joined', 'count', v_count);
end $$;

grant execute on function public.join_tournament(uuid) to authenticated;

-- =====================================================================
-- SECCAO: 0015_manual_payments.sql
-- =====================================================================
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

