import { router } from 'expo-router';
import {
  BookOpen,
  Bot,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Cpu,
  Crown,
  Gem,
  HelpCircle,
  Info,
  Lock,
  Smile,
  Sparkles,
  TimerOff,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import type { Difficulty } from '@tira/ai';
import type { PlayerId } from '@tira/engine';
import { GameButton, GameCard } from '@/components/game/ui';
import { alpha, TiraHeading, TiraScreen, TiraText } from '@/components/tira';
import { useGame } from '@/game/useGame';
import { useT } from '@/lib/i18n/hook';
import { getUnlockRequirement, getUnlockText, useProgression } from '@/store/progression';
import { colors, radii, spacing, typography } from '@/theme';

type OfflineMode = 'pvp' | 'pve' | 'cvc' | 'practice';
type TimeMode = 'normal' | 'quick' | 'none';
type ModeVariant = 'p1' | 'orange' | 'gold';
type DiffColor = 'p1' | 'gold' | 'orange' | 'p2';

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

interface ModeMeta {
  id: OfflineMode;
  icon: LucideIcon;
  variant: ModeVariant;
  titleKey: 'mode.pvp' | 'mode.pve' | 'mode.cvc' | 'mode.practice';
  descKey: 'mode.pvp.desc' | 'mode.pve.desc' | 'mode.cvc.desc' | 'mode.practice.desc';
}

const MODES: ModeMeta[] = [
  {
    id: 'pvp',
    icon: Users,
    variant: 'p1',
    titleKey: 'mode.pvp',
    descKey: 'mode.pvp.desc',
  },
  {
    id: 'pve',
    icon: Bot,
    variant: 'orange',
    titleKey: 'mode.pve',
    descKey: 'mode.pve.desc',
  },
  {
    id: 'cvc',
    icon: Cpu,
    variant: 'gold',
    titleKey: 'mode.cvc',
    descKey: 'mode.cvc.desc',
  },
  {
    id: 'practice',
    icon: Sparkles,
    variant: 'gold',
    titleKey: 'mode.practice',
    descKey: 'mode.practice.desc',
  },
];

interface DifficultyMeta {
  id: Difficulty;
  icon: LucideIcon;
  color: DiffColor;
  labelKey: 'diff.easy' | 'diff.medium' | 'diff.hard' | 'diff.perfect';
  descKey: 'diff.easy.desc' | 'diff.medium.desc' | 'diff.hard.desc' | 'diff.perfect.desc';
}

const DIFFICULTIES: DifficultyMeta[] = [
  { id: 'easy', icon: Smile, color: 'p1', labelKey: 'diff.easy', descKey: 'diff.easy.desc' },
  { id: 'medium', icon: Brain, color: 'gold', labelKey: 'diff.medium', descKey: 'diff.medium.desc' },
  { id: 'hard', icon: Gem, color: 'orange', labelKey: 'diff.hard', descKey: 'diff.hard.desc' },
  { id: 'perfect', icon: Crown, color: 'p2', labelKey: 'diff.perfect', descKey: 'diff.perfect.desc' },
];

interface TimeMeta {
  id: TimeMode;
  icon: LucideIcon;
  labelKey: 'mode.time.normal' | 'mode.time.quick' | 'mode.time.none';
  descKey: 'mode.time.normal.desc' | 'mode.time.quick.desc' | 'mode.time.none.desc';
  seconds: number;
}

const TIME_OPTIONS: TimeMeta[] = [
  {
    id: 'normal',
    icon: Clock,
    labelKey: 'mode.time.normal',
    descKey: 'mode.time.normal.desc',
    seconds: 45,
  },
  {
    id: 'quick',
    icon: Zap,
    labelKey: 'mode.time.quick',
    descKey: 'mode.time.quick.desc',
    seconds: 15,
  },
  {
    id: 'none',
    icon: TimerOff,
    labelKey: 'mode.time.none',
    descKey: 'mode.time.none.desc',
    seconds: 0,
  },
];

export default function OfflineScreen() {
  const { t } = useT();
  const { startGame } = useGame();
  const isUnlocked = useProgression((s) => s.isUnlocked);
  const unlocked = useProgression((s) => s.unlocked);

  const [mode, setMode] = useState<OfflineMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [side, setSide] = useState<PlayerId>('P1');
  const [showThreats, setShowThreats] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>('normal');

  const [prevUnlocked, setPrevUnlocked] = useState(unlocked);
  if (prevUnlocked !== unlocked) {
    setPrevUnlocked(unlocked);
    if (unlocked.hard && difficulty !== 'hard') setDifficulty('hard');
    else if (!unlocked.hard && unlocked.medium && difficulty === 'hard') setDifficulty('medium');
    else if (!unlocked.medium && difficulty === 'medium') setDifficulty('easy');
    else if (!isUnlocked(difficulty)) setDifficulty('easy');
  }

  const handleStart = () => {
    if (!mode) return;
    const timePerTurn = TIME_OPTIONS.find((opt) => opt.id === timeMode)?.seconds ?? 45;
    if (mode === 'pvp') {
      startGame({ mode: 'pvp', showThreats, timePerTurn });
    } else if (mode === 'pve') {
      startGame({ mode: 'pve', difficulty, humanSide: side, showThreats, timePerTurn });
    } else if (mode === 'cvc') {
      startGame({ mode: 'cvc', difficulty, humanSide: 'P1', showThreats: false, timePerTurn });
    } else {
      startGame({ mode: 'practice', difficulty, humanSide: side, showThreats, timePerTurn: 0 });
    }
    router.push('/game');
  };

  return (
    <TiraScreen>
      <View style={{ gap: spacing[1] }}>
        <TiraHeading level="display" style={{ letterSpacing: 0.844, lineHeight: 40.5 }}>{t('mode.title')}</TiraHeading>
        <TiraText size="sm" variant="muted">
          {t('mode.subtitle')}
        </TiraText>
      </View>

      <View style={{ gap: 10 }}>
        {MODES.map((m) => (
          <ModeOption
            key={m.id}
            icon={m.icon}
            variant={m.variant}
            title={t(m.titleKey)}
            desc={t(m.descKey)}
            active={mode === m.id}
            onPress={() => setMode(m.id)}
          />
        ))}
      </View>

      {mode === 'pve' ? (
        <View style={{ gap: spacing[4] }}>
          <GameCard style={{ padding: spacing[4] }}>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3], lineHeight: 31.5 }}>
              {t('mode.difficulty')}
            </TiraHeading>
            <DifficultyGrid value={difficulty} onChange={setDifficulty} respectLocks />
          </GameCard>
          <GameCard style={{ padding: spacing[4] }}>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3], lineHeight: 31.5 }}>
              {t('mode.side')}
            </TiraHeading>
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <SideOption
                label={t('mode.side.p1')}
                desc={t('mode.side.p1.desc')}
                active={side === 'P1'}
                onPress={() => setSide('P1')}
              />
              <SideOption
                label={t('mode.side.p2')}
                desc={t('mode.side.p2.desc')}
                active={side === 'P2'}
                onPress={() => setSide('P2')}
              />
            </View>
          </GameCard>
        </View>
      ) : null}

      {mode === 'cvc' ? (
        <View style={{ gap: spacing[4] }}>
          <GameCard style={{ padding: spacing[4] }}>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3], lineHeight: 31.5 }}>
              Dificuldade (IA vs IA)
            </TiraHeading>
            <DifficultyGrid value={difficulty} onChange={setDifficulty} respectLocks={false} />
          </GameCard>
        </View>
      ) : null}

      {mode === 'practice' ? (
        <View style={{ gap: spacing[4] }}>
          <GameCard style={{ padding: spacing[4] }}>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3], lineHeight: 31.5 }}>
              {t('mode.difficulty')}
            </TiraHeading>
            <DifficultyGrid
              value={difficulty}
              onChange={setDifficulty}
              respectLocks={false}
            />
          </GameCard>
          <GameCard style={{ padding: spacing[4] }}>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3], lineHeight: 31.5 }}>
              Que lado treinamos?
            </TiraHeading>
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <SideOption
                label={t('mode.side.p1')}
                desc={t('mode.side.p1.desc')}
                active={side === 'P1'}
                onPress={() => setSide('P1')}
              />
              <SideOption
                label={t('mode.side.p2')}
                desc={t('mode.side.p2.desc')}
                active={side === 'P2'}
                onPress={() => setSide('P2')}
              />
            </View>
          </GameCard>
          <GameCard
            style={{
              padding: spacing[4],
              backgroundColor: alpha(colors.gold, 0.05),
              borderColor: alpha(colors.gold, 0.3),
            }}
          >
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <Sparkles size={20} color={colors.gold} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: BODY,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.text,
                    marginBottom: spacing[1],
                  }}
                >
                  Modo Treino Livre
                </Text>
                <Text
                  style={{
                    fontFamily: BODY,
                    fontSize: 11,
                    lineHeight: 18,
                    color: colors.textMuted,
                  }}
                >
                  {t('mode.practice.info.desc')}
                </Text>
              </View>
            </View>
          </GameCard>
        </View>
      ) : null}

      {mode && mode !== 'cvc' ? (
        <GameCard style={{ padding: spacing[4] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[3],
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: BODY,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text,
                }}
              >
                {t('mode.tutorial')}
              </Text>
              <Text
                style={{
                  fontFamily: BODY,
                  fontSize: 11,
                  color: colors.textMuted,
                }}
              >
                {t('mode.tutorial.desc')}
              </Text>
            </View>
            <Switch
              value={showThreats}
              onValueChange={setShowThreats}
              trackColor={{ false: colors.surfaceAlt, true: colors.gold }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.surfaceAlt}
            />
          </View>
        </GameCard>
      ) : null}

      {mode && mode !== 'cvc' ? (
        <GameCard style={{ padding: spacing[4] }}>
          <TiraHeading level="h3" style={{ marginBottom: spacing[3], lineHeight: 31.5 }}>
            Tempo por jogada
          </TiraHeading>
          <TimeSelector value={timeMode} onChange={setTimeMode} />
        </GameCard>
      ) : null}

      {mode ? (
        <GameButton variant="p1" style={{ width: '100%' }} onPress={handleStart}>
          <Text
            style={{
              fontFamily: BODY,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.white,
            }}
          >
            {t('mode.start')}
          </Text>
          <ChevronRight size={16} color={colors.white} />
        </GameButton>
      ) : null}

      <View
        style={{
          paddingTop: spacing[4],
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: spacing[2],
        }}
      >
        <InfoLink
          icon={<BookOpen size={16} color={colors.textMuted} />}
          label="Tutorial (10 passos)"
          onPress={() => router.push('/tutorial')}
        />
        <InfoLink
          icon={<HelpCircle size={16} color={colors.textMuted} />}
          label="Como jogar"
          onPress={() => router.push('/how-to-play')}
        />
        <InfoLink
          icon={<Info size={16} color={colors.textMuted} />}
          label="Sobre o jogo"
          onPress={() => router.push('/about')}
        />
      </View>
    </TiraScreen>
  );
}

function ModeOption({
  icon,
  title,
  desc,
  active,
  onPress,
  variant,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  active: boolean;
  onPress: () => void;
  variant: ModeVariant;
}) {
  const Icon = icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        padding: spacing[4],
        borderRadius: radii.cardLg,
        borderWidth: 2,
        borderColor: active ? alpha(colors[variant], 0.5) : colors.border,
        backgroundColor: active ? alpha(colors[variant], 0.05) : alpha(colors.surface, 0.4),
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[4],
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.xl,
          backgroundColor: active ? alpha(colors.bg, 0.3) : colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: DISPLAY,
            fontSize: typography.fontSize.lg,
            letterSpacing: 0.405,
            lineHeight: 25.31,
            color: colors.text,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: BODY,
            fontSize: 11,
            color: colors.textMuted,
          }}
        >
          {desc}
        </Text>
      </View>
      {active ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: radii.pill,
            backgroundColor: colors.gold,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function DifficultyGrid({
  value,
  onChange,
  respectLocks,
}: {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
  respectLocks: boolean;
}) {
  const { t } = useT();
  const isUnlocked = useProgression((s) => s.isUnlocked);
  const winsByDifficulty = useProgression((s) => s.winsByDifficulty);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
      {DIFFICULTIES.map((d) => {
        const locked = respectLocks && !isUnlocked(d.id);
        const wins = winsByDifficulty[d.id];
        const active = value === d.id;
        const req = getUnlockRequirement(d.id);
        const Icon = d.icon;
        const unlockText = req
          ? `${getUnlockText(d.id)}${wins > 0 ? ` (${wins}/${req.wins})` : ''}`
          : '';

        return (
          <Pressable
            key={d.id}
            disabled={locked}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: locked }}
            onPress={() => {
              if (!locked) onChange(d.id);
            }}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: '47%',
              padding: spacing[3],
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: active ? colors.gold : colors.border,
              backgroundColor: active
                ? alpha(colors.gold, 0.1)
                : locked
                  ? alpha(colors.surface, 0.2)
                  : alpha(colors.surface, 0.4),
              opacity: locked ? 0.6 : pressed ? 0.85 : 1,
              position: 'relative',
            })}
          >
            {respectLocks && wins > 0 && !locked ? (
              <View
                style={{
                  position: 'absolute',
                  top: spacing[1],
                  right: spacing[1],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: BODY,
                    fontSize: 9,
                    color: colors.textMuted,
                  }}
                >
                  {wins}
                </Text>
                <Check size={12} color={colors.textMuted} />
              </View>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
                marginBottom: spacing[1],
              }}
            >
              {locked ? (
                <Lock size={16} color={colors.textMuted} />
              ) : (
                <Icon size={20} color={colors[d.color]} />
              )}
              <TiraText size="sm" weight="semibold" variant={locked ? 'muted' : d.color}>
                {t(d.labelKey)}
              </TiraText>
            </View>
            {locked ? (
              <Text
                style={{
                  fontFamily: BODY,
                  fontSize: 10,
                  lineHeight: 13,
                  color: colors.gold,
                }}
              >
                {unlockText}
              </Text>
            ) : (
              <Text
                style={{
                  fontFamily: BODY,
                  fontSize: 10,
                  lineHeight: 13,
                  color: colors.textMuted,
                }}
              >
                {t(d.descKey)}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function SideOption({
  label,
  desc,
  active,
  onPress,
}: {
  label: string;
  desc: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: spacing[3],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: active ? colors.gold : colors.border,
        backgroundColor: active ? alpha(colors.gold, 0.1) : alpha(colors.surface, 0.4),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: BODY,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.text,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: BODY,
          fontSize: 10,
          color: colors.textMuted,
        }}
      >
        {desc}
      </Text>
    </Pressable>
  );
}

function TimeSelector({ value, onChange }: { value: TimeMode; onChange: (v: TimeMode) => void }) {
  const { t } = useT();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {TIME_OPTIONS.map((opt) => {
          const active = value === opt.id;
          const Icon = opt.icon;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(opt.id)}
              style={({ pressed }) => ({
                flex: 1,
                padding: spacing[3],
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: active ? colors.gold : colors.border,
                backgroundColor: active ? alpha(colors.gold, 0.1) : alpha(colors.surface, 0.4),
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ marginBottom: spacing[1] }}>
                <Icon size={20} color={colors.text} />
              </View>
              <Text
                style={{
                  fontFamily: BODY,
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.semibold,
                  color: active ? colors.gold : colors.text,
                }}
              >
                {t(opt.labelKey)}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: BODY,
                  fontSize: 9,
                  lineHeight: 12,
                  textAlign: 'center',
                  color: colors.textMuted,
                }}
              >
                {t(opt.descKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value === 'quick' ? (
        <View
          style={{
            marginTop: spacing[2],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[1],
          }}
        >
          <Zap size={14} color={colors.orange} />
          <Text
            style={{
              fontFamily: BODY,
              fontSize: 11,
              color: colors.orange,
            }}
          >
            Modo Rápido: pensa rápido ou perde!
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoLink({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        padding: 10,
        borderRadius: radii.lg,
        backgroundColor: pressed ? alpha(colors.surface, 0.6) : colors.transparent,
      })}
    >
      {icon}
      <Text
        style={{
          flex: 1,
          fontFamily: BODY,
          fontSize: typography.fontSize.sm,
          color: colors.text,
        }}
      >
        {label}
      </Text>
      <ChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  );
}
