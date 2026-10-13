-- =====================================================================
-- KYC + Levantamentos (payouts) — Slice 2
-- Depende de 0002_payments.sql (tabelas kyc_records e payouts já existem).
--
-- Nota: o Levantamento real só deve ser ATIVO depois de resolvido o
-- enquadramento legal (licenciamento BNA, contrato PSP, política KYC/AML).
-- O botão é controlado pela flag de função PAYOUTS_ENABLED (default off).
-- =====================================================================

-- Bucket privado para documentos de KYC (imagens + PDF, máx 5MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents', 'kyc-documents', false, 5242880,
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do nothing;

-- Cada utilizador só acede à sua própria pasta: kyc-documents/<uid>/...
drop policy if exists "kyc_docs_insert_own" on storage.objects;
create policy "kyc_docs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_docs_select_own" on storage.objects;
create policy "kyc_docs_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_docs_update_own" on storage.objects;
create policy "kyc_docs_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Helper reutilizável: o utilizador tem KYC aprovado (e não expirado)?
create or replace function public.has_approved_kyc(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kyc_records
    where user_id = p_user_id
      and status = 'approved'
      and (expires_at is null or expires_at > now())
  );
$$;

revoke execute on function public.has_approved_kyc(uuid) from public, anon;
grant execute on function public.has_approved_kyc(uuid) to authenticated, service_role;
