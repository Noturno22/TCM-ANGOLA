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
