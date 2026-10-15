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
