-- =====================================================================
-- KYC — leitura do próprio registo pelo cliente.
-- Em 0002 o RLS de kyc_records foi ligado sem qualquer policy (só service_role).
-- Aqui permitimos que o utilizador LEIA o seu próprio registo de KYC (para saber
-- o estado: pending/approved/rejected). Escrita continua exclusiva do servidor.
-- =====================================================================

alter table public.kyc_records enable row level security;

drop policy if exists "kyc_select_own" on public.kyc_records;
create policy "kyc_select_own"
  on public.kyc_records for select to authenticated
  using (user_id = auth.uid());

grant select on public.kyc_records to authenticated;
