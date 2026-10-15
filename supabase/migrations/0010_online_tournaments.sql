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
