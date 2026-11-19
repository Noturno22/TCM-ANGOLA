import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  Coins,
  Flame,
  Gift,
  Handshake,
  Info,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Defs, Path, Pattern, Rect, Svg } from 'react-native-svg';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { alpha, TiraScreen, TiraText } from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { toast } from '@/lib/toast';
import { useProfile } from '@/store/profile';
import { colors, radii, spacing, typography, type ColorToken } from '@/theme';

interface Mission {
  id: string;
  labelKey: 'wallet.mission.play3' | 'wallet.mission.streak2' | 'wallet.mission.draw1';
  icon: LucideIcon;
  current: number;
  target: number;
  reward: number;
  color: ColorToken;
}

interface Transaction {
  id: string;
  label: string;
  amount: number;
  date: string;
  type: 'in' | 'out';
}

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

export default function WalletScreen() {
  const { t } = useT();
  const profile = useProfile();
  const addCoins = useProfile((s) => s.addCoins);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  const missions: Mission[] = useMemo(
    () => [
      {
        id: 'play3',
        labelKey: 'wallet.mission.play3',
        icon: Trophy,
        current: Math.min(profile.totalMatches, 3),
        target: 3,
        reward: 150,
        color: 'gold',
      },
      {
        id: 'streak2',
        labelKey: 'wallet.mission.streak2',
        icon: Flame,
        current: Math.min(profile.currentStreak, 2),
        target: 2,
        reward: 200,
        color: 'p2',
      },
      {
        id: 'draw1',
        labelKey: 'wallet.mission.draw1',
        icon: Handshake,
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
      {
        id: 'welcome',
        label: t('wallet.tx.welcome'),
        amount: 5000,
        date: 'Início',
        type: 'in',
      },
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
        date: new Date(m.date).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
        }),
        type: 'in',
      });
    }
    return txs;
  }, [profile.matches, t]);

  const handleClaimBonus = () => {
    if (bonusClaimed) return;
    addCoins(500);
    setBonusClaimed(true);
    toast('Bónus diário recebido!', {
      description: '+500 KZ virtuais adicionados à tua carteira de jogo.',
    });
  };

  return (
    <TiraScreen>
      <GameCard glow="gold" style={{ padding: spacing[6] }}>
        <AngolanDiamond />
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Coins size={14} color={colors.gold} />
            <Text
              style={{
                fontFamily: BODY,
                fontSize: 11,
                fontWeight: typography.fontWeight.semibold,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: colors.gold,
              }}
            >
              Saldo de jogo (virtual)
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: spacing[2],
              marginTop: spacing[1],
            }}
          >
            <Text
              style={{
                fontFamily: DISPLAY,
                fontSize: typography.fontSize['6xl'],
                letterSpacing: 3.6,
                color: colors.gold,
                lineHeight: 62,
                textShadowColor: 'rgba(242, 176, 30, 0.35)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 12,
              }}
            >
              {profile.coins.toLocaleString('pt-PT')}
            </Text>
            <Text
              style={{
                fontFamily: DISPLAY,
                fontSize: typography.fontSize['2xl'],
                letterSpacing: 0.54,
                color: colors.gold,
              }}
            >
              KZ
            </Text>
          </View>
          <TiraText size="xs" variant="muted" style={{ marginTop: spacing[2] }}>
            Moeda virtual · Sem valor real
          </TiraText>
        </View>
      </GameCard>

      <GameCard glow="gold" style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Banknote size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: DISPLAY,
                fontSize: typography.fontSize.lg,
                letterSpacing: 0.506,
                color: colors.text,
              }}
            >
              Dinheiro real
            </Text>
            <Text
              style={{
                fontFamily: BODY,
                fontSize: typography.fontSize.xs,
                color: colors.textMuted,
              }}
            >
              Depósitos e levantamentos manuais com comprovativo, aprovados por um administrador.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
          <GameButton
            variant="gold"
            style={{ flex: 1 }}
            accessibilityLabel="Depositar dinheiro real"
            onPress={() => router.push('/deposit?tab=deposit')}
          >
            <ArrowDownLeft size={16} color={colors.primaryForeground} />
            <Text
              style={{
                fontFamily: BODY,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.primaryForeground,
              }}
            >
              Depositar
            </Text>
          </GameButton>
          <GameButton
            variant="outline"
            style={{ flex: 1 }}
            accessibilityLabel="Levantar dinheiro real"
            onPress={() => router.push('/deposit?tab=withdraw')}
          >
            <ArrowUpRight size={16} color={colors.text} />
            <Text
              style={{
                fontFamily: BODY,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.text,
              }}
            >
              Levantar
            </Text>
          </GameButton>
        </View>
      </GameCard>

      <GameCard style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.xl,
              backgroundColor: bonusClaimed
                ? colors.surfaceAlt
                : alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {bonusClaimed ? (
              <CalendarCheck size={24} color={colors.textMuted} />
            ) : (
              <Gift size={24} color={colors.gold} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: DISPLAY,
                fontSize: typography.fontSize.lg,
                letterSpacing: 0.506,
                color: colors.text,
              }}
            >
              {t('wallet.bonus.title')}
            </Text>
            <Text
              style={{
                fontFamily: BODY,
                fontSize: typography.fontSize.xs,
                color: colors.textMuted,
              }}
            >
              {bonusClaimed
                ? t('wallet.bonus.done')
                : 'Recebe 500 KZ virtuais grátis. Disponível uma vez por dia.'}
            </Text>
          </View>
          <GameButton
            variant={bonusClaimed ? 'outline' : 'gold'}
            disabled={bonusClaimed}
            onPress={handleClaimBonus}
            accessibilityLabel="Receber bónus diário"
          >
            {bonusClaimed ? (
              <Text
                style={{
                  fontFamily: BODY,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text,
                }}
              >
                {t('wallet.bonus.received')}
              </Text>
            ) : (
              <>
                <Gift size={14} color={colors.primaryForeground} />
                <Text
                  style={{
                    fontFamily: BODY,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.primaryForeground,
                  }}
                >
                  {t('wallet.bonus.claim')}
                </Text>
              </>
            )}
          </GameButton>
        </View>
      </GameCard>

      <View>
        <SectionTitle title={t('wallet.missions')} />
        <View style={{ gap: spacing[2] }}>
          {missions.map((m) => {
            const pct = (m.current / m.target) * 100;
            const done = m.current >= m.target;
            const Icon = m.icon;
            return (
              <GameCard
                key={m.id}
                style={{
                  padding: spacing[3],
                  borderColor: done ? alpha(colors.p1, 0.4) : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radii.lg,
                      backgroundColor: alpha(colors[m.color], 0.15),
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} color={colors[m.color]} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: spacing[2],
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          flexShrink: 1,
                          fontFamily: BODY,
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.text,
                        }}
                      >
                        {t(m.labelKey)}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 2,
                          flexShrink: 0,
                        }}
                      >
                        <Coins size={12} color={done ? colors.p1 : colors.gold} />
                        <Text
                          style={{
                            fontFamily: BODY,
                            fontSize: 11,
                            fontWeight: typography.fontWeight.bold,
                            color: done ? colors.p1 : colors.gold,
                          }}
                        >
                          {`+${m.reward}`}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing[2],
                        marginTop: 6,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: radii.pill,
                          backgroundColor: alpha(colors.p1, 0.2),
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: radii.pill,
                            backgroundColor: colors.p1,
                          }}
                        />
                      </View>
                      <Text
                        style={{
                          fontFamily: BODY,
                          fontSize: typography.fontSize.xs,
                          color: colors.textMuted,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {`${m.current}/${m.target}`}
                      </Text>
                    </View>
                  </View>
                </View>
              </GameCard>
            );
          })}
        </View>
      </View>

      <View>
        <SectionTitle title="Carteira (AOA)" />
        <GameCard style={{ padding: spacing[5], alignItems: 'center', gap: spacing[3] }}>
          <Banknote size={32} color={colors.textMuted} />
          <TiraText size="sm" variant="muted" align="center">
            Em breve. O Tira o Cocó do Meio só usa moeda virtual e ainda não movimenta dinheiro
            real.
          </TiraText>
        </GameCard>
      </View>

      <View>
        <SectionTitle
          title="Histórico do jogo"
          action={
            <Text
              style={{
                fontFamily: BODY,
                fontSize: typography.fontSize.xs,
                color: colors.textMuted,
              }}
            >
              {t('wallet.movements', { n: transactions.length })}
            </Text>
          }
        />
        <GameCard>
          {transactions.length === 0 ? (
            <Text
              style={{
                padding: spacing[6],
                textAlign: 'center',
                fontFamily: BODY,
                fontSize: typography.fontSize.sm,
                color: colors.textMuted,
              }}
            >
              {t('wallet.no_tx')}
            </Text>
          ) : (
            transactions.map((tx, i) => (
              <View
                key={tx.id}
                style={{
                  padding: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: alpha(colors.text, 0.1),
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
                    flexShrink: 0,
                  }}
                >
                  {tx.type === 'in' ? (
                    <ArrowDownLeft size={16} color={colors.p1} />
                  ) : (
                    <ArrowUpRight size={16} color={colors.p2} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: BODY,
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.text,
                    }}
                  >
                    {tx.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: BODY,
                      fontSize: typography.fontSize.xs,
                      color: colors.textMuted,
                    }}
                  >
                    {tx.date}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: typography.fontSize.base,
                    letterSpacing: 0.36,
                    color: tx.type === 'in' ? colors.p1 : colors.p2,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {`${tx.type === 'in' ? '+' : '−'}${tx.amount} KZ`}
                </Text>
              </View>
            ))
          )}
        </GameCard>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[3],
          borderRadius: radii.xl,
          backgroundColor: alpha(colors.surface, 0.6),
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Info size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
        <Text
          style={{
            flex: 1,
            fontFamily: BODY,
            fontSize: typography.fontSize.xs,
            lineHeight: 19,
            color: colors.textMuted,
          }}
        >
          <Text style={{ fontWeight: typography.fontWeight.semibold, color: colors.text }}>
            Joga com responsabilidade.
          </Text>{' '}
          As moedas do jogo são virtuais e sem valor monetário. O jogo ainda não movimenta dinheiro
          real.
        </Text>
      </View>
    </TiraScreen>
  );
}

function AngolanDiamond() {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: -24, right: -24, width: 128, height: 128 }}
    >
      <Svg width={128} height={128} opacity={0.2}>
        <Defs>
          <Pattern id="wallet-diamond" width={24} height={24} patternUnits="userSpaceOnUse">
            <Path
              d="M12 0 L24 12 L12 24 L0 12 Z"
              stroke={colors.gold}
              strokeWidth={1}
              fill="none"
            />
          </Pattern>
        </Defs>
        <Rect width={128} height={128} fill="url(#wallet-diamond)" />
      </Svg>
    </View>
  );
}
