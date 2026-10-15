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
