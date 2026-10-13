// Helpers de KYC (Deno). Delega na RPC `has_approved_kyc` (SECURITY DEFINER),
// criada em 0003_kyc_payouts.sql.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function hasApprovedKyc(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc('has_approved_kyc', { p_user_id: userId });
  if (error) throw error;
  return Boolean(data);
}
