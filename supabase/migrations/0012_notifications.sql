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
