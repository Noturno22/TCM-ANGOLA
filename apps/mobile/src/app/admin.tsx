/**
 * Admin — port do AdminScreen web: gate de acesso, sessão de administrador e
 * abas de depósitos/levantamentos.
 *
 * O acesso é decidido no servidor (Edge Function `admin-manage`). Aqui só
 * usamos `EXPO_PUBLIC_ADMIN_EMAILS` para mostrar/ocultar a entrada — nunca
 * como fronteira de segurança.
 *
 * NOTA: a web delega os painéis em `ReceiptsPanel`/`WithdrawalsPanel` (que
 * falam com a Edge Function `admin-manage`). No mobile esses painéis/API não
 * existem, pelo que a área de conteúdo mostra um placeholder.
 */
import { router } from 'expo-router';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { GameButton, GameCard } from '@/components/game/ui';
import { SegmentedControl, TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { useAuth } from '@/store/auth';
import { colors, radii, spacing } from '@/theme';

const ADMIN_EMAILS = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type AdminTab = 'receipts' | 'withdrawals';

export default function AdminScreen() {
  const email = useAuth((s) => s.user?.email?.toLowerCase() ?? null);
  const isAdmin = email !== null && ADMIN_EMAILS.includes(email);
  const [tab, setTab] = useState<AdminTab>('receipts');

  return (
    <TiraScreen>
      <View>
        <TiraHeading level="display" style={{ letterSpacing: 0.844, lineHeight: 40.5 }}>ADMIN</TiraHeading>
        <TiraText size="sm" variant="muted" style={{ marginTop: spacing[1] }}>
          Aprovação de depósitos e levantamentos.
        </TiraText>
      </View>

      {!isAdmin ? (
        <GameCard style={{ padding: spacing[6], alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.p2, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Lock size={24} color={colors.p2} />
          </View>
          <TiraText size="sm" variant="muted" align="center">
            Sem acesso. Esta área é restrita a administradores.
          </TiraText>
          <GameButton variant="outline" style={{ alignSelf: 'center' }} onPress={() => router.push('/')}>
            Voltar
          </GameButton>
        </GameCard>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <ShieldCheck size={16} color={colors.gold} />
            <TiraText size="xs" variant="muted">{`Sessão de administrador · ${email}`}</TiraText>
          </View>

          <View style={{ gap: spacing[4] }}>
            <SegmentedControl<AdminTab>
              options={[
                { value: 'receipts', label: 'Depósitos' },
                { value: 'withdrawals', label: 'Levantamentos' },
              ]}
              value={tab}
              onChange={setTab}
              testID="admin-tabs"
            />
            <GameCard style={{ padding: spacing[6], alignItems: 'center', gap: spacing[2] }}>
              <TiraText size="sm" variant="muted" align="center">
                {tab === 'receipts'
                  ? 'Painel de depósitos indisponível no mobile.'
                  : 'Painel de levantamentos indisponível no mobile.'}
              </TiraText>
            </GameCard>
          </View>
        </>
      )}
    </TiraScreen>
  );
}
