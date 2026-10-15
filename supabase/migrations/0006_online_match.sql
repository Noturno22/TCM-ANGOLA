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
