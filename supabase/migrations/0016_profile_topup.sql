-- =====================================================================
-- Top-up de moeda virtual (contas antigas com 0 KZ) + fecho da RLS
-- de `profiles` (o cliente nunca escreve nesta tabela).
-- =====================================================================

-- 1) Backfill único: contas antigas criadas antes do bónus de boas-vindas
--    (`handle_new_user` passou a creditar 5000 KZ) ficaram com 0 KZ e não
--    conseguiam entrar em salas com stake. Só toca a quem está exatamente a 0.
update public.profiles
   set coins = 5000, updated_at = now()
 where coins = 0;

-- 2) Escrito apenas pelo servidor: o cliente só lê perfis (rankings). Como
--    existia política de UPDATE própria, qualquer utilizador podia fazer
--    `update profiles set coins = 999999` e invalidar toda a economia
--    virtual. Revogamos e voltamos a dar só as colunas editáveis por si.
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar, updated_at) on public.profiles to authenticated;

-- A política de UPDATE de 0001 continua a aplicar-se por cima do grant
-- (só altera a própria linha); o grant coluna-a-coluna é que passa a
-- impedir alterar `coins`, `elo`, `xp`, `level`, `wins`, `losses`, `draws`.
