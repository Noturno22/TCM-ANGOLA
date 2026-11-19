/**
 * Home — port 1:1 do `HomeScreen` web: cabeçalho com sino/saldo, cartão do
 * utilizador, banner do torneio, CTAs online/offline, desafio diário,
 * atalhos, modos secundários, salas em destaque, estatísticas e tutorial.
 */
import { router } from 'expo-router';
import {
  Bell,
  Bot,
  Building2,
  Check,
  ChevronRight,
  Eye,
  Flag,
  Gamepad2,
  Mountain,
  Share2,
  ShoppingBag,
  Target,
  Trophy,
  UserPlus,
  Users,
  Waves,
  X,
  Zap,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { Pressable, Image, Text, View } from 'react-native';
import { AdSlot } from '@/components/game/AdSlot';
import {
  BalancePill,
  GameButton,
  GameCard,
  LevelAvatar,
  SectionTitle,
  XpBar,
} from '@/components/game/ui';
import { getTodayPuzzle } from '@/content';
import { useChallenge } from '@/store/challenge';
import { useNotifications } from '@/store/notifications';
import { useProfile } from '@/store/profile';
import { colors, radii, spacing, typography } from '@/theme';
import { TiraScreen } from '@/components/tira';

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface FeaturedRoom {
  name: string;
  players: string;
  stake: number;
  icon: IconType;
}

const FEATURED_ROOMS: FeaturedRoom[] = [
  { name: 'Luanda', players: '32/50', stake: 100, icon: Building2 },
  { name: 'Benguela', players: '18/40', stake: 50, icon: Waves },
  { name: 'Huambo', players: '12/30', stake: 25, icon: Mountain },
];

export default function HomeScreen() {
  const profile = useProfile();
  const unread = useNotifications((s) => s.unread);
  const [showTournamentBanner, setShowTournamentBanner] = useState(true);

  return (
    <TiraScreen
      style={{ gap: spacing[6] }}
      backgroundImage={require('@/assets/images/Background.png')}
    >
      {/* Cabeçalho com logo + saldo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
        <Image
          source={require('@/assets/images/logoh.png')}
          resizeMode="contain"
          accessibilityLabel="Tira o Coco do Meio"
          style={{ width: 138, height: 46 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.pill,
              backgroundColor: pressed ? colors.surface : colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Bell size={20} color={colors.text} />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: radii.pill,
                  backgroundColor: colors.p2,
                  borderWidth: 2,
                  borderColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 10,
                    fontWeight: typography.fontWeight.bold,
                    lineHeight: 12,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <BalancePill coins={profile.coins} onClick={() => router.push('/wallet')} />
        </View>
      </View>

      {/* Cartão do utilizador */}
      <GameCard glow="gold" style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
          <LevelAvatar name="Jogador" level={profile.level} size="md" online />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 18,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text,
                  fontFamily: typography.fontFamily.body,
                  flexShrink: 1,
                }}
              >
                Jogador
              </Text>
              <View
                style={{
                  paddingHorizontal: spacing[2],
                  paddingVertical: 2,
                  borderRadius: radii.md,
                  backgroundColor: alphaP1,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: typography.fontWeight.medium,
                    color: colors.p1,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  Online
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 13.5,
                color: colors.textMuted,
                marginBottom: 10,
                fontFamily: typography.fontFamily.body,
              }}
            >
              Nível {profile.level} · Elo {profile.elo}
            </Text>
            <XpBar xp={profile.xp} level={profile.level} />
          </View>
        </View>
      </GameCard>

      {/* Banner do torneio semanal */}
      {showTournamentBanner ? (
        <View
          style={{
            position: 'relative',
            borderRadius: radii.cardLg,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: alphaGold30,
            padding: spacing[4],
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar banner"
            onPress={() => setShowTournamentBanner(false)}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 48,
              height: 48,
              borderRadius: radii.pill,
              backgroundColor: alphaBg60,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <X size={16} color={colors.textMuted} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radii.xl,
                backgroundColor: alphaGold12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trophy size={24} color={colors.gold} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 11,
                  letterSpacing: 0.55,
                  textTransform: 'uppercase',
                  color: colors.gold,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily.body,
                }}
              >
                Torneio Semanal
              </Text>
              <Text
                style={{
                  fontFamily: typography.fontFamily.display,
                  fontSize: 27,
                  letterSpacing: 0.54,
                  lineHeight: 27,
                  marginTop: 4,
                  color: colors.text,
                }}
              >
                PRÉMIO: 50.000 KZ
              </Text>
              <Text
                style={{
                  fontSize: 13.5,
                  color: colors.textMuted,
                  marginTop: 4,
                  fontFamily: typography.fontFamily.body,
                }}
              >
                Inscrições abertas • Eliminatória simples
              </Text>
            </View>
          </View>
          <GameButton
            variant="primary"
            style={{ width: '100%', height: 48, marginTop: spacing[4] }}
            onPress={() => router.push('/rooms')}
          >
            Participar agora
          </GameButton>
        </View>
      ) : null}

      {/* Google Ads — banner topo */}
      <AdSlot format="banner-top" />

      {/* CTAs principais: JOGAR ONLINE / JOGAR OFFLINE */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <GameButton
          variant="primary"
          style={{
            flex: 1,
            height: 'auto',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            gap: spacing[3],
            padding: spacing[4],
          }}
          onPress={() => router.push('/rooms')}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.xl,
              backgroundColor: alphaBg20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={20} color={colors.primaryForeground} />
          </View>
          <View>
            <Text
              style={{
                fontFamily: typography.fontFamily.display,
                fontSize: 22.5,
                letterSpacing: 0.45,
                lineHeight: 22.5,
                color: colors.primaryForeground,
              }}
            >
              JOGAR ONLINE
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                marginTop: 4,
                color: colors.primaryForeground,
                opacity: 0.9,
                fontFamily: typography.fontFamily.body,
              }}
            >
              Jogadores em tempo real
            </Text>
          </View>
        </GameButton>

        <GameButton
          variant="outline"
          style={{
            flex: 1,
            height: 'auto',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            gap: spacing[3],
            padding: spacing[4],
          }}
          onPress={() => router.push('/offline')}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.xl,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={20} color={colors.gold} />
          </View>
          <View>
            <Text
              style={{
                fontFamily: typography.fontFamily.display,
                fontSize: 22.5,
                letterSpacing: 0.45,
                lineHeight: 22.5,
                color: colors.text,
              }}
            >
              JOGAR OFFLINE
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                marginTop: 4,
                color: colors.textMuted,
                fontFamily: typography.fontFamily.body,
              }}
            >
              Contra a IA ou um amigo
            </Text>
          </View>
        </GameButton>
      </View>

      {/* Desafio Diário */}
      <DailyChallengeCard />

      {/* Atalhos rápidos */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <Shortcut icon={Users} label="Salas" onClick={() => router.push('/rooms')} />
        <Shortcut icon={UserPlus} label="Amigos" onClick={() => router.push('/friends')} />
        <Shortcut icon={ShoppingBag} label="Loja" onClick={() => router.push('/shop')} />
        <Shortcut icon={Zap} label="Apostas" onClick={() => router.push('/wallet')} />
        <Shortcut icon={Share2} label="Partilhar" onClick={() => router.push('/share')} />
      </View>

      {/* Modos secundários */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <FeatureCard
          icon={Flag}
          eyebrow="Modo História"
          title="Campanha"
          description="8 níveis progressivos"
          onClick={() => router.push('/campaign')}
        />
        <FeatureCard
          icon={Eye}
          eyebrow="Modo Espetador"
          title="Assistir IA vs IA"
          description="Competição com comentário"
          onClick={() => router.push('/watch')}
        />
      </View>

      {/* Jogos em destaque */}
      <View>
        <SectionTitle
          title="Salas em destaque"
          action={
            <Pressable accessibilityRole="button" onPress={() => router.push('/rooms')}>
              <Text
                style={{
                  fontSize: 13.5,
                  color: colors.gold,
                  fontFamily: typography.fontFamily.body,
                }}
              >
                Ver todas
              </Text>
            </Pressable>
          }
        />
        <View style={{ gap: 10 }}>
          {FEATURED_ROOMS.map((room) => {
            const Icon = room.icon;
            return (
              <GameCard
                key={room.name}
                style={{
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.xl,
                    backgroundColor: colors.surfaceAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color={colors.gold} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 15.75,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.text,
                        fontFamily: typography.fontFamily.body,
                        flexShrink: 1,
                      }}
                    >
                      Sala {room.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        fontFamily: typography.fontFamily.body,
                      }}
                    >
                      {room.players}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 13.5,
                      color: colors.gold,
                      fontWeight: typography.fontWeight.medium,
                      marginTop: 2,
                      fontFamily: typography.fontFamily.body,
                    }}
                  >
                    Aposta: {room.stake} KZ
                  </Text>
                </View>
                <GameButton
                  variant="outline"
                  style={{ height: 48, paddingHorizontal: 14 }}
                  textStyle={{ fontSize: 13.5 }}
                  onPress={() => router.push('/rooms')}
                >
                  Entrar
                </GameButton>
              </GameCard>
            );
          })}
        </View>
      </View>

      {/* Estatísticas rápidas */}
      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle title="As tuas estatísticas" />
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Vitórias" value={profile.wins} color={colors.p1} />
          <Stat label="Derrotas" value={profile.losses} color={colors.p2} />
          <Stat label="Empates" value={profile.draws} color={colors.textMuted} />
        </View>
      </GameCard>

      {/* Botão de tutorial para novos */}
      {profile.totalMatches < 3 ? (
        <GameButton
          variant="outline"
          style={{ width: '100%' }}
          onPress={() => router.push('/tutorial')}
        >
          <Gamepad2 size={16} color={colors.text} style={{ marginRight: spacing[2] }} />
          <Text
            style={{
              fontSize: 15.75,
              fontWeight: typography.fontWeight.semibold,
              color: colors.text,
              fontFamily: typography.fontFamily.body,
            }}
          >
            Aprender a jogar (Tutorial)
          </Text>
        </GameButton>
      ) : null}
    </TiraScreen>
  );
}

const alphaP1 = 'rgba(16, 178, 90, 0.15)';
const alphaGold30 = 'rgba(242, 176, 30, 0.30)';
const alphaGold12 = 'rgba(242, 176, 30, 0.12)';
const alphaBg60 = 'rgba(5, 10, 8, 0.60)';
const alphaBg20 = 'rgba(5, 10, 8, 0.20)';

function Shortcut({
  icon: Icon,
  label,
  onClick,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onClick}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        padding: spacing[3],
        borderRadius: radii.cardLg,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 76,
      })}
    >
      <Icon size={20} color={colors.gold} />
      <Text
        style={{
          fontSize: 13.5,
          color: colors.textMuted,
          fontWeight: typography.fontWeight.medium,
          fontFamily: typography.fontFamily.body,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        style={{
          fontFamily: typography.fontFamily.display,
          fontSize: 33.75,
          letterSpacing: 0.675,
          lineHeight: 33.75,
          color,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 13.5,
          color: colors.textMuted,
          marginTop: 4,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function FeatureCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  onClick,
}: {
  icon: IconType;
  eyebrow: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onClick}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'flex-start',
        gap: spacing[3],
        borderRadius: radii.cardLg,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing[4],
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.xl,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={colors.gold} />
      </View>
      <View style={{ minWidth: 0 }}>
        <Text
          style={{
            fontSize: 11,
            letterSpacing: 0.55,
            textTransform: 'uppercase',
            color: colors.textMuted,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            fontFamily: typography.fontFamily.display,
            fontSize: 20.25,
            letterSpacing: 0.405,
            lineHeight: 25.31,
            marginTop: 2,
            color: colors.text,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13.5,
            color: colors.textMuted,
            marginTop: 4,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

function DailyChallengeCard() {
  const isSolved = useChallenge((s) => s.isSolved);
  const puzzle = getTodayPuzzle();
  const solved = isSolved(puzzle.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Desafio Diário"
      onPress={() => router.push('/challenge')}
      style={({ pressed }) => ({
        width: '100%',
        borderRadius: radii.cardLg,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderWidth: 1,
        borderColor: alphaGold30,
        padding: spacing[4],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radii.xl,
            backgroundColor: alphaGold12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Target size={24} color={colors.gold} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4 }}>
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 0.55,
                textTransform: 'uppercase',
                color: colors.gold,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily.body,
              }}
            >
              Desafio Diário
            </Text>
            {solved ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 2,
                  borderRadius: radii.md,
                  backgroundColor: 'rgba(16, 178, 90, 0.20)',
                }}
              >
                <Check size={12} color={colors.p1} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.p1,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  Resolvido
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{
              fontFamily: typography.fontFamily.display,
              fontSize: 22.5,
              letterSpacing: 0.45,
              lineHeight: 28.13,
              color: colors.text,
            }}
          >
            {puzzle.title}
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: colors.textMuted,
              marginTop: 2,
              fontFamily: typography.fontFamily.body,
            }}
          >
            {puzzle.difficulty} • +200 KZ • {solved ? 'Já resolvido' : 'Por resolver'}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.gold} />
      </View>
    </Pressable>
  );
}
