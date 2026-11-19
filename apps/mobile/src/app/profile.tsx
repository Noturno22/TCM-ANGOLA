/**
 * Profile — port 1:1 do ProfileScreen web: identidade (avatar/nível/Elo/XP),
 * estatísticas, sequências, progressão de dificuldades, histórico de partidas,
 * conquistas e amigos. Reset de progresso com confirmação — tudo local.
 */
import { useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import {
  Award,
  BarChart3,
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Gem,
  History,
  Lock,
  LogOut,
  Play,
  Share2,
  Smile,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import type { Difficulty } from '@tira/ai';
import { AchievementIcon } from '@/components/game/achievement-icon';
import {
  FilterChip,
  GameButton,
  GameCard,
  LevelAvatar,
  ResultBadge,
  SectionTitle,
  XpBar,
} from '@/components/game/ui';
import { TiraScreen, alpha } from '@/components/tira';
import { useAuth } from '@/store/auth';
import { useProfile, type MatchRecord } from '@/store/profile';
import { getUnlockRequirement, useProgression } from '@/store/progression';
import { colors, radii, spacing, typography } from '@/theme';

type Tab = 'history' | 'achievements' | 'friends';

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

const HEADER_NAME: TextStyle = {
  fontFamily: DISPLAY,
  fontSize: 27,
  letterSpacing: 0.675,
  color: colors.text,
};
const HEADER_ACCOUNT: TextStyle = {
  fontSize: 13.5,
  color: colors.textMuted,
  fontFamily: BODY,
};
const TINY_UPPER: TextStyle = {
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: colors.textMuted,
  fontFamily: BODY,
};
const BUTTON_LABEL: TextStyle = {
  fontSize: 15.75,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: BODY,
};

const DIFF_META: { id: Difficulty; label: string; color: string; Icon: LucideIcon }[] = [
  { id: 'easy', label: 'Fácil', color: colors.p1, Icon: Smile },
  { id: 'medium', label: 'Médio', color: colors.gold, Icon: Brain },
  { id: 'hard', label: 'Difícil', color: colors.orange, Icon: Gem },
  { id: 'perfect', label: 'Perfeito', color: colors.p2, Icon: Crown },
];

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
  perfect: 'Perfeito',
};

export default function ProfileScreen() {
  const profile = useProfile();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const signingOut = useAuth((s) => s.pending);
  const [tab, setTab] = useState<Tab>('history');

  const winRate =
    profile.totalMatches > 0
      ? Math.round((profile.wins / profile.totalMatches) * 100)
      : 0;

  const unlockedAchievements = profile.achievements.filter((a) => a.unlockedAt);

  // Nome/identificador a mostrar: Google (nome) > email > telefone > genérico.
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const displayName =
    meta.full_name?.trim() ||
    meta.name?.trim() ||
    user?.email?.split('@')[0] ||
    user?.phone ||
    'Jogador';
  const accountLine =
    user?.email || user?.phone || `Nível ${profile.level} • Elo ${profile.elo}`;

  const handleReplay = (matchId: string) => {
    router.push({ pathname: '/replay', params: { matchId } });
  };

  const handleShare = (matchId: string) => {
    router.push({ pathname: '/share', params: { matchId } });
  };

  const confirmReset = () => {
    Alert.alert('Reiniciar progresso', 'Reiniciar todo o progresso? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reiniciar progresso',
        style: 'destructive',
        onPress: () => useProfile.getState().resetProfile(),
      },
    ]);
  };

  return (
    <TiraScreen>
      {/* Cabeçalho do perfil */}
      <GameCard glow="gold" style={{ padding: spacing[5] }}>
        <View style={{ alignItems: 'center', gap: spacing[3] }}>
          <LevelAvatar
            name={displayName}
            level={profile.level}
            size="lg"
            isTop={profile.elo > 1500}
            online
          />
          <View style={{ alignItems: 'center' }}>
            <Text numberOfLines={1} style={HEADER_NAME}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={HEADER_ACCOUNT}>
              {accountLine}
            </Text>
          </View>
          <View style={{ width: '100%', maxWidth: 320 }}>
            <XpBar xp={profile.xp} level={profile.level} />
          </View>
        </View>
      </GameCard>

      {/* Estatísticas */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <StatCard
          icon={<Trophy size={16} color={colors.p1} />}
          value={profile.wins}
          label="Vitórias"
          color={colors.p1}
        />
        <StatCard
          icon={<TrendingUp size={16} color={colors.p2} />}
          value={profile.losses}
          label="Derrotas"
          color={colors.p2}
        />
        <StatCard
          icon={<Award size={16} color={colors.textMuted} />}
          value={profile.draws}
          label="Empates"
          color={colors.textMuted}
        />
        <StatCard
          icon={<Crown size={16} color={colors.gold} />}
          value={`${winRate}%`}
          label="Vitória"
          color={colors.gold}
        />
      </View>

      {/* Sequência */}
      <GameCard style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <StreakCol label="Sequência atual" value={profile.currentStreak} color={colors.p1} />
          <Divider />
          <StreakCol label="Melhor sequência" value={profile.bestStreak} color={colors.gold} />
          <Divider />
          <StreakCol label="Partidas" value={profile.totalMatches} color={colors.text} />
        </View>
      </GameCard>

      {/* Progressão de dificuldades */}
      <ProgressionPanel />

      {/* Botão de estatísticas detalhadas */}
      <GameButton variant="gold" style={{ width: '100%' }} onPress={() => router.push('/stats')}>
        <BarChart3 size={16} color={colors.primaryForeground} />
        <Text style={[BUTTON_LABEL, { color: colors.primaryForeground }]}>
          Ver estatísticas detalhadas e gráficos
        </Text>
      </GameButton>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[1] }}
      >
        <FilterChip active={tab === 'history'} onClick={() => setTab('history')}>
          Histórico
        </FilterChip>
        <FilterChip active={tab === 'achievements'} onClick={() => setTab('achievements')}>
          {`Conquistas (${unlockedAchievements.length})`}
        </FilterChip>
        <FilterChip active={tab === 'friends'} onClick={() => setTab('friends')}>
          Amigos
        </FilterChip>
      </ScrollView>

      {/* Conteúdo da tab */}
      {tab === 'history' ? (
        <View style={{ gap: spacing[2] }}>
          {profile.matches.length === 0 ? (
            <GameCard style={{ padding: spacing[8], alignItems: 'center' }}>
              <View style={{ marginBottom: spacing[3] }}>
                <History size={40} color={colors.textMuted} />
              </View>
              <Text
                style={{
                  fontSize: 15.75,
                  color: colors.textMuted,
                  fontFamily: BODY,
                  textAlign: 'center',
                  marginBottom: spacing[4],
                }}
              >
                Ainda não jogaste nenhuma partida.
              </Text>
              <GameButton variant="p1" onPress={() => router.push('/offline')}>
                Jogar agora
              </GameButton>
            </GameCard>
          ) : (
            <>
              {profile.matches.slice(0, 20).map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  onShare={() => handleShare(m.id)}
                  onReplay={() => handleReplay(m.id)}
                />
              ))}
              {profile.matches.length > 20 ? (
                <Text
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: colors.textMuted,
                    fontFamily: BODY,
                    paddingVertical: spacing[2],
                  }}
                >
                  {`Mostrando as 20 partidas mais recentes de ${profile.matches.length}.`}
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {tab === 'achievements' ? (
        <View style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {profile.achievements.map((a) => (
              <GameCard
                key={a.id}
                glow={a.unlockedAt ? 'gold' : null}
                style={{
                  width: '48%',
                  padding: spacing[3],
                  opacity: a.unlockedAt ? 1 : 0.5,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.lg,
                      backgroundColor: a.unlockedAt ? alpha(colors.gold, 0.15) : colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AchievementIcon
                      icon={a.icon}
                      size={20}
                      color={a.unlockedAt ? colors.gold : colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 13.5,
                        fontWeight: typography.fontWeight.semibold,
                        lineHeight: 14,
                        color: colors.text,
                        fontFamily: BODY,
                      }}
                    >
                      {a.title}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 10,
                        lineHeight: 12,
                        color: colors.textMuted,
                        fontFamily: BODY,
                      }}
                    >
                      {a.description}
                    </Text>
                    {a.unlockedAt ? (
                      <Text
                        style={{
                          marginTop: spacing[1],
                          fontSize: 9,
                          color: colors.gold,
                          fontFamily: BODY,
                        }}
                      >
                        {formatDate(a.unlockedAt)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </GameCard>
            ))}
          </View>
          <GameButton
            variant="outline"
            style={{ width: '100%' }}
            onPress={() => router.push('/achievements')}
          >
            <Text style={BUTTON_LABEL}>Ver todas as conquistas</Text>
            <ChevronRight size={16} color={colors.text} />
          </GameButton>
        </View>
      ) : null}

      {tab === 'friends' ? (
        <GameCard style={{ padding: spacing[8], alignItems: 'center' }}>
          <View style={{ marginBottom: spacing[3] }}>
            <Users size={40} color={colors.textMuted} />
          </View>
          <Text
            style={{
              fontSize: 15.75,
              color: colors.textMuted,
              fontFamily: BODY,
              textAlign: 'center',
              marginBottom: spacing[1],
            }}
          >
            Sem amigos ainda
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: colors.textMuted,
              fontFamily: BODY,
              textAlign: 'center',
              marginBottom: spacing[4],
            }}
          >
            O modo online com amigos chega em breve. Por enquanto, desafia a IA!
          </Text>
          <GameButton variant="p1" onPress={() => router.push('/offline')}>
            Jogar contra a IA
          </GameButton>
        </GameCard>
      ) : null}

      {/* Sessão / conta */}
      {user ? (
        <GameButton
          variant="outline"
          style={{ width: '100%' }}
          disabled={signingOut}
          onPress={() => void signOut()}
        >
          <LogOut size={16} color={colors.text} />
          <Text style={BUTTON_LABEL}>{signingOut ? 'A sair…' : 'Sair da conta'}</Text>
        </GameButton>
      ) : null}

      {/* Botão de reset (discreto) */}
      {profile.totalMatches > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={confirmReset}
          style={({ pressed }) => ({
            width: '100%',
            paddingVertical: spacing[2],
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: colors.textMuted,
              fontFamily: BODY,
            }}
          >
            Reiniciar progresso
          </Text>
        </Pressable>
      ) : null}
    </TiraScreen>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <GameCard style={{ flex: 1, padding: spacing[3], alignItems: 'center' }}>
      <View style={{ marginBottom: spacing[1] }}>{icon}</View>
      <Text
        style={{
          fontFamily: DISPLAY,
          fontSize: 22.5,
          letterSpacing: 0.45,
          lineHeight: 22.5,
          color,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 9,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: colors.textMuted,
          fontFamily: BODY,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </GameCard>
  );
}

function StreakCol({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'flex-start' }}>
      <Text style={TINY_UPPER}>{label}</Text>
      <Text style={{ fontFamily: DISPLAY, fontSize: 27, letterSpacing: 0.54, color }}>{value}</Text>
    </View>
  );
}

function Divider() {
  return (
    <View
      style={{
        width: 1,
        height: 40,
        backgroundColor: alpha(colors.white, 0.04),
      }}
    />
  );
}

function MatchRow({
  match,
  onShare,
  onReplay,
}: {
  match: MatchRecord;
  onShare: () => void;
  onReplay: () => void;
}) {
  return (
    <GameCard style={{ padding: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <ResultBadge result={match.result} playerSide={match.playerSide} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 15.75,
              fontWeight: typography.fontWeight.medium,
              color: colors.text,
              fontFamily: BODY,
            }}
          >
            {`vs ${match.opponent}`}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
              marginTop: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
              <Calendar size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: BODY }}>
                {formatDate(match.date)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: BODY }}>
                {`${match.durationSec}s`}
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: BODY }}>
              {`${match.moveCount} jogadas`}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Partilhar partida"
            onPress={onShare}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.lg,
              backgroundColor: pressed ? alpha(colors.gold, 0.2) : colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Share2 size={14} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver replay"
            onPress={onReplay}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.lg,
              backgroundColor: pressed ? alpha(colors.gold, 0.2) : colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Play size={14} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </GameCard>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

// ============ Painel de progressão de dificuldades ============
function ProgressionPanel() {
  const wins = useProgression((s) => s.winsByDifficulty);
  const unlocked = useProgression((s) => s.unlocked);

  return (
    <GameCard style={{ padding: spacing[4] }}>
      <SectionTitle title="Níveis de IA" />
      <View style={{ gap: 10 }}>
        {DIFF_META.map((d) => {
          const isUnlocked = unlocked[d.id];
          const req = getUnlockRequirement(d.id);
          const currentWins = req ? wins[req.difficulty] : 0;
          const pct = req && req.wins > 0 ? Math.min(100, (currentWins / req.wins) * 100) : 100;

          return (
            <View
              key={d.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                opacity: isUnlocked ? 1 : 0.6,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.lg,
                  backgroundColor: isUnlocked ? colors.surfaceAlt : alpha(colors.surfaceAlt, 0.5),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isUnlocked ? (
                  <d.Icon size={20} color={d.color} />
                ) : (
                  <Lock size={16} color={colors.textMuted} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: spacing[1],
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: typography.fontWeight.semibold,
                      color: isUnlocked ? d.color : colors.textMuted,
                      fontFamily: BODY,
                    }}
                  >
                    {d.label}
                  </Text>
                  {isUnlocked ? (
                    <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: BODY }}>
                      {`${wins[d.id]} vitórias`}
                    </Text>
                  ) : req ? (
                    <Text style={{ fontSize: 10, color: colors.gold, fontFamily: BODY }}>
                      {`${currentWins}/${req.wins} no ${DIFF_LABEL[req.difficulty]}`}
                    </Text>
                  ) : null}
                </View>
                {!isUnlocked && req ? (
                  <View
                    style={{
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
                        backgroundColor: colors.p1,
                      }}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </GameCard>
  );
}
