/**
 * Wallet — port do WalletScreen web em modo offline: saldo em destaque,
 * bónus diário local (addCoins, sem rede), missões derivadas do perfil,
 * histórico de transações derivado das partidas e aviso de depósitos/
 * levantamentos online ("em breve"). SEM pagamentos — view-only.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Pill,
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { useProfile } from '@/store/profile';
import { colors, radii, spacing } from '@/theme';

type TxType = 'in' | 'out';

interface Transaction {
  id: string;
  label: string;
  amount: number;
  date: string;
  type: TxType;
}

interface Mission {
  id: string;
  emoji: string;
  labelKey: 'wallet.mission.play3' | 'wallet.mission.streak2' | 'wallet.mission.draw1';
  current: number;
  target: number;
  reward: number;
  color: 'p1' | 'p2' | 'gold' | 'orange';
}

const MISSION_COLOR_BG: Record<'p1' | 'p2' | 'gold' | 'orange', string> = {
  p1: alpha(colors.p1, 0.15),
  p2: alpha(colors.p2, 0.15),
  gold: alpha(colors.gold, 0.15),
  orange: alpha(colors.orange, 0.15),
};

export default function WalletScreen() {
  const { t } = useT();
  const profile = useProfile();
  const addCoins = useProfile((s) => s.addCoins);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  const missions: Mission[] = useMemo(
    () => [
      {
        id: 'play3',
        emoji: '🏆',
        labelKey: 'wallet.mission.play3',
        current: Math.min(profile.totalMatches, 3),
        target: 3,
        reward: 150,
        color: 'gold',
      },
      {
        id: 'streak2',
        emoji: '🔥',
        labelKey: 'wallet.mission.streak2',
        current: Math.min(profile.currentStreak, 2),
        target: 2,
        reward: 200,
        color: 'p2',
      },
      {
        id: 'draw1',
        emoji: '🤝',
        labelKey: 'wallet.mission.draw1',
        current: Math.min(profile.draws, 1),
        target: 1,
        reward: 50,
        color: 'orange',
      },
    ],
    [profile.totalMatches, profile.currentStreak, profile.draws],
  );

  const transactions: Transaction[] = useMemo(() => {
    const txs: Transaction[] = [
      { id: 'welcome', label: t('wallet.tx.welcome'), amount: 5000, date: '—', type: 'in' },
    ];
    for (const m of profile.matches.slice(0, 5)) {
      const won = Boolean(m.playerSide) && m.result === m.playerSide;
      const draw = m.result === 'DRAW';
      const amount = won ? 100 : draw ? 20 : 10;
      const label = won
        ? t('wallet.tx.win', { opponent: m.opponent })
        : draw
          ? t('wallet.tx.draw', { opponent: m.opponent })
          : t('wallet.tx.loss', { opponent: m.opponent });
      txs.push({
        id: m.id,
        label,
        amount,
        date: new Date(m.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
        type: 'in',
      });
    }
    return txs;
  }, [profile.matches, t]);

  const handleClaimBonus = () => {
    if (bonusClaimed) return;
    addCoins(500);
    setBonusClaimed(true);
  };

  return (
    <TiraScreen title={t('wallet.title')} showBack>
      {/* Saldo em destaque */}
      <TiraCard glow="gold" style={{ padding: spacing[6] }}>
        <TiraText
          size="xs"
          weight="bold"
          variant="gold"
          style={{ textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {`🪙 ${t('wallet.balance')}`}
        </TiraText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], marginTop: spacing[1] }}>
          <TiraHeading level="h1" color="gold">
            {profile.coins.toLocaleString('pt-PT')}
          </TiraHeading>
          <TiraHeading level="h3" color="gold">
            KZ
          </TiraHeading>
        </View>
        <TiraText size="xs" variant="muted" style={{ marginTop: spacing[2] }}>
          {t('wallet.virtual')}
        </TiraText>
      </TiraCard>

      {/* Bónus diário */}
      <TiraCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.xl,
              backgroundColor: bonusClaimed ? colors.surfaceAlt : alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TiraText style={{ fontSize: 24 }}>{bonusClaimed ? '🗓️' : '🎁'}</TiraText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <TiraText size="lg" weight="semibold">
              {t('wallet.bonus.title')}
            </TiraText>
            <TiraText size="xs" variant="muted">
              {bonusClaimed ? t('wallet.bonus.done') : t('wallet.bonus.desc')}
            </TiraText>
          </View>
          <TiraButton
            variant={bonusClaimed ? 'outline' : 'gold'}
            size="sm"
            disabled={bonusClaimed}
            onPress={handleClaimBonus}
            accessibilityLabel={t('wallet.bonus.claim')}
          >
            {bonusClaimed ? t('wallet.bonus.received') : t('wallet.bonus.claim')}
          </TiraButton>
        </View>
        {bonusClaimed ? (
          <TiraText size="xs" variant="p1" style={{ marginTop: spacing[2] }}>
            {t('wallet.bonus.success')}
          </TiraText>
        ) : null}
      </TiraCard>

      {/* Missões */}
      <View style={{ gap: spacing[2] }}>
        <TiraHeading level="h3">{t('wallet.missions')}</TiraHeading>
        {missions.map((m) => {
          const pct = (m.current / m.target) * 100;
          const done = m.current >= m.target;
          return (
            <TiraCard
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                padding: spacing[3],
                borderColor: done ? alpha(colors.p1, 0.4) : colors.border,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.lg,
                  backgroundColor: MISSION_COLOR_BG[m.color],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TiraText size="lg">{m.emoji}</TiraText>
              </View>
              <View style={{ flex: 1, gap: spacing[1] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  <TiraText size="sm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {t(m.labelKey)}
                  </TiraText>
                  <TiraText size="xs" weight="bold" variant={done ? 'p1' : 'gold'}>
                    {`🪙 +${m.reward}`}
                  </TiraText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <View
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: radii.pill,
                      backgroundColor: colors.surfaceAlt,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: radii.pill,
                        backgroundColor: done ? colors.p1 : colors.gold,
                      }}
                    />
                  </View>
                  <TiraText size="xs" variant="muted">
                    {`${m.current}/${m.target}`}
                  </TiraText>
                </View>
              </View>
            </TiraCard>
          );
        })}
      </View>

      {/* Histórico de transações */}
      <View style={{ gap: spacing[2] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TiraHeading level="h3">{t('wallet.history')}</TiraHeading>
          <TiraText size="xs" variant="muted">
            {t('wallet.movements', { n: transactions.length })}
          </TiraText>
        </View>
        <TiraCard padded={false}>
          {transactions.length === 0 ? (
            <TiraText size="sm" variant="muted" align="center" style={{ padding: spacing[6] }}>
              {t('wallet.no_tx')}
            </TiraText>
          ) : (
            transactions.map((tx, i) => (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                  padding: spacing[3],
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radii.lg,
                    backgroundColor:
                      tx.type === 'in' ? alpha(colors.p1, 0.15) : alpha(colors.p2, 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TiraText size="sm" variant={tx.type === 'in' ? 'p1' : 'p2'}>
                    {tx.type === 'in' ? '↓' : '↑'}
                  </TiraText>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <TiraText size="sm" weight="medium" numberOfLines={1}>
                    {tx.label}
                  </TiraText>
                  <TiraText size="xs" variant="muted">
                    {tx.date}
                  </TiraText>
                </View>
                <TiraText size="lg" weight="semibold" variant={tx.type === 'in' ? 'p1' : 'p2'}>
                  {`${tx.type === 'in' ? '+' : '−'}${tx.amount} KZ`}
                </TiraText>
              </View>
            ))
          )}
        </TiraCard>
      </View>

      {/* Depósito e Levantamento — online, em breve */}
      <View style={{ gap: spacing[2] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TiraHeading level="h3">{t('wallet.payments')}</TiraHeading>
          <Pill>{t('common.soon')}</Pill>
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: spacing[3],
            padding: spacing[3],
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: alpha(colors.orange, 0.3),
            backgroundColor: alpha(colors.orange, 0.1),
          }}
        >
          <TiraText size="sm" variant="orange">
            ℹ️
          </TiraText>
          <TiraText size="xs" variant="orange" style={{ flex: 1 }}>
            {t('wallet.payments.soon')}
          </TiraText>
        </View>
      </View>

      {/* Aviso de jogo responsável */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing[3],
          padding: spacing[3],
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <TiraText size="sm" variant="muted">
          ℹ️
        </TiraText>
        <View style={{ flex: 1, gap: 2 }}>
          <TiraText size="xs" weight="semibold">
            {t('wallet.responsible.title')}
          </TiraText>
          <TiraText size="xs" variant="muted">
            {t('wallet.responsible.desc')}
          </TiraText>
        </View>
      </View>
    </TiraScreen>
  );
}
