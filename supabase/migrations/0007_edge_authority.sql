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
