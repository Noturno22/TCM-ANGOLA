-- =====================================================================
-- Torneios online: editar/descrever (dono, torneio ainda aberto) e
-- convidar amigos por notificação.
--
-- O cliente continua sem escrever em `tournaments`: tudo via RPCs
-- SECURITY DEFINER, com os mesmos códigos de erro da Fase 3.
-- =====================================================================

-- 1) create_tournament passa a aceitar descrição.
--    ( assinatura nova — a antiga é removida para não criar overload. )
drop function if exists public.create_tournament(text, integer, integer, integer, text);

create or replace function public.create_tournament(
  p_name        text,
  p_entry_fee   integer default 0,
  p_prize       integer default 0,
  p_max_players integer default 8,
  p_room_id     text default 'global',
  p_description text default ''
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

  insert into public.tournaments (name, description, entry_fee, prize, max_players, room_id, created_by)
  values (trim(p_name), coalesce(p_description, ''), coalesce(p_entry_fee, 0),
          coalesce(p_prize, 0), coalesce(p_max_players, 8), p_room_id, v_uid)
  returning id into v_id;

  return jsonb_build_object('status', 'created', 'tournament_id', v_id);
end $$;

-- 2) Editar nome/descrição — só o criador e só enquanto aberto.
create or replace function public.update_tournament(
  p_tournament_id uuid,
  p_name          text,
  p_description   text default ''
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_t   public.tournaments;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if length(v_name) < 2 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'unknown_tournament' using errcode = '22023';
  end if;
  if v_t.created_by is distinct from v_uid then
    raise exception 'not_tournament_owner' using errcode = '28000';
  end if;
  if v_t.status <> 'open' then
    raise exception 'tournament_not_open' using errcode = '22023';
  end if;

  update public.tournaments
     set name = v_name,
         description = coalesce(p_description, ''),
         updated_at = now()
   where id = p_tournament_id;

  return jsonb_build_object('status', 'updated', 'tournament_id', p_tournament_id);
end $$;

-- 3) Convidar amigos — notificação a quem ainda não está inscrito.
--    Quem convida tem de ser o criador ou um inscrito.
create or replace function public.invite_to_tournament(
  p_tournament_id uuid,
  p_user_ids      uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_t     public.tournaments;
  v_name  text;
  v_count int := 0;
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_user_ids is null or coalesce(array_length(p_user_ids, 1), 0) = 0 then
    return jsonb_build_object('status', 'invited', 'count', 0);
  end if;
  if array_length(p_user_ids, 1) > 50 then
    raise exception 'too_many_invites' using errcode = '22023';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'unknown_tournament' using errcode = '22023';
  end if;
  if v_t.status <> 'open' then
    raise exception 'tournament_not_open' using errcode = '22023';
  end if;
  if v_t.created_by is distinct from v_uid
     and not exists (
       select 1 from public.tournament_entries e
        where e.tournament_id = p_tournament_id and e.user_id = v_uid
     ) then
    raise exception 'not_a_participant' using errcode = '28000';
  end if;

  select username into v_name from public.profiles where id = v_uid;

  foreach v_target in array p_user_ids loop
    continue when v_target is null or v_target = v_uid;
    -- Já inscrito? não vale a pena convidar.
    continue when exists (
      select 1 from public.tournament_entries e
       where e.tournament_id = p_tournament_id and e.user_id = v_target
    );

    perform public._notify(
      v_target,
      'tournament_invite',
      'Convite para um torneio',
      coalesce(v_name, 'Um jogador') || ' convidou-te para "' || v_t.name || '".',
      jsonb_build_object(
        'tournament_id', p_tournament_id,
        'user_id', v_uid,
        'tournament_name', v_t.name
      )
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('status', 'invited', 'count', v_count);
end $$;
