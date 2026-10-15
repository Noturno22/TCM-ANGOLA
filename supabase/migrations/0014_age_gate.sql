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
