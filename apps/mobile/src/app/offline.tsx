/**
 * Offline — port do OfflineSelectScreen web: modo, dificuldade (com
 * desbloqueios), lado, tutorial, tempo por jogada e botão começar.
 * CvC foi removido no mobile (fora do escopo). Sem info-links web
 * (tutorial/sobre) — essas rotas não existem no mobile nesta fase.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import type { Difficulty } from '@tira/ai';
import type { PlayerId } from '@tira/engine';
import { Pressable, Switch, View } from 'react-native';
import { DifficultySelect, Pill, TiraButton, TiraCard, TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { useGame } from '@/game/useGame';
import { useT } from '@/lib/i18n/hook';
import { useProgression } from '@/store/progression';
import { colors, radii, spacing } from '@/theme';

type OfflineMode = 'pvp' | 'pve' | 'practice';
type TimeMode = 'normal' | 'quick' | 'none';

const TIME_SECONDS: Record<TimeMode, number> = { normal: 45, quick: 15, none: 0 };

interface ModeMeta {
  id: OfflineMode;
  emoji: string;
  titleKey: 'mode.pvp' | 'mode.pve' | 'mode.practice';
  descKey: 'mode.pvp.desc' | 'mode.pve.desc' | 'mode.practice.desc';
  border: string;
  activeBg: string;
}

const MODES: ModeMeta[] = [
  {
    id: 'pvp',
    emoji: '👥',
    titleKey: 'mode.pvp',
    descKey: 'mode.pvp.desc',
    border: alpha(colors.p1, 0.5),
    activeBg: alpha(colors.p1, 0.08),
  },
  {
    id: 'pve',
    emoji: '🤖',
    titleKey: 'mode.pve',
    descKey: 'mode.pve.desc',
    border: alpha(colors.orange, 0.5),
    activeBg: alpha(colors.orange, 0.08),
  },
  {
    id: 'practice',
    emoji: '✨',
    titleKey: 'mode.practice',
    descKey: 'mode.practice.desc',
    border: alpha(colors.gold, 0.5),
    activeBg: alpha(colors.gold, 0.08),
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

  // Ajustar dificuldade se a selecionada ficar bloqueada —
  // padrão "adjust state during render" (paridade com a web).
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
    const timePerTurn = TIME_SECONDS[timeMode];
    if (mode === 'pvp') {
      startGame({ mode: 'pvp', showThreats, timePerTurn });
    } else if (mode === 'pve') {
      startGame({ mode: 'pve', difficulty, humanSide: side, showThreats, timePerTurn });
    } else {
      // Treino Livre: sem relógio (0s), sem estatísticas, vs IA
      startGame({ mode: 'practice', difficulty, humanSide: side, showThreats, timePerTurn: 0 });
    }
    router.push('/game');
  };

  return (
    <TiraScreen title={t('mode.title')} subtitle={t('mode.subtitle')} showBack>
      {/* Modos de jogo */}
      <View style={{ gap: spacing[2] }}>
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setMode(m.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[4],
                padding: spacing[4],
                borderRadius: radii.xl,
                borderWidth: 2,
                borderColor: active ? m.border : colors.border,
                backgroundColor: active ? m.activeBg : colors.surface,
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
                }}
              >
                <TiraText style={{ fontSize: 22 }}>{m.emoji}</TiraText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <TiraHeading level="h3" numberOfLines={1}>
                  {t(m.titleKey)}
                </TiraHeading>
                <TiraText size="xs" variant="muted">
                  {t(m.descKey)}
                </TiraText>
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
        })}
      </View>

      {/* Configurações de PvE */}
      {mode === 'pve' ? (
        <>
          <TiraCard>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
              {t('mode.difficulty')}
            </TiraHeading>
            <DifficultySelect value={difficulty} onChange={setDifficulty} respectLocks />
          </TiraCard>
          <TiraCard>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
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
          </TiraCard>
        </>
      ) : null}

      {/* Configurações de Treino Livre */}
      {mode === 'practice' ? (
        <>
          <TiraCard>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
              {t('mode.difficulty')}
            </TiraHeading>
            <DifficultySelect value={difficulty} onChange={setDifficulty} respectLocks={false} />
          </TiraCard>
          <TiraCard>
            <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
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
          </TiraCard>
          {/* Aviso de modo treino (web: bg-gold/5 border-gold/30) */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing[3],
              padding: spacing[4],
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: alpha(colors.gold, 0.3),
              backgroundColor: alpha(colors.gold, 0.05),
            }}
          >
            <TiraText size="lg">✨</TiraText>
            <View style={{ flex: 1, gap: 2 }}>
              <TiraText size="sm" weight="semibold">
                {t('mode.practice.info.title')}
              </TiraText>
              <TiraText size="xs" variant="muted">
                {t('mode.practice.info.desc')}
              </TiraText>
            </View>
          </View>
        </>
      ) : null}

      {/* Opção tutorial: mostrar ameaças */}
      {mode ? (
        <TiraCard>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[4],
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <TiraText size="sm" weight="semibold">
                {t('mode.tutorial')}
              </TiraText>
              <TiraText size="xs" variant="muted">
                {t('mode.tutorial.desc')}
              </TiraText>
            </View>
            <Switch
              value={showThreats}
              onValueChange={setShowThreats}
              trackColor={{ false: colors.surfaceAlt, true: colors.gold }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.surfaceAlt}
            />
          </View>
        </TiraCard>
      ) : null}

      {/* Seletor de tempo por turno */}
      {mode ? (
        <TiraCard>
          <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
            {t('mode.time')}
          </TiraHeading>
          <SegmentedTime value={timeMode} onChange={setTimeMode} />
          {timeMode === 'quick' ? (
            <TiraText size="xs" variant="orange" align="center" style={{ marginTop: spacing[3] }}>
              {t('mode.time.quick.warn')}
            </TiraText>
          ) : null}
        </TiraCard>
      ) : null}

      {/* Botão começar */}
      {mode ? (
        <TiraButton variant="p1" size="lg" fullWidth onPress={handleStart} accessibilityLabel={t('mode.start')}>
          {`▶️  ${t('mode.start')}`}
        </TiraButton>
      ) : null}
    </TiraScreen>
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
        backgroundColor: active ? alpha(colors.gold, 0.1) : colors.surface,
        gap: 2,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <TiraText size="sm" weight="semibold">
        {label}
      </TiraText>
      <TiraText size="xs" variant="muted">
        {desc}
      </TiraText>
    </Pressable>
  );
}

/** Tempo por jogada — chips com emoji + descrição (port web, sem gradiente). */
function SegmentedTime({ value, onChange }: { value: TimeMode; onChange: (v: TimeMode) => void }) {
  const { t } = useT();
  const options: { id: TimeMode; emoji: string }[] = [
    { id: 'normal', emoji: '🕐' },
    { id: 'quick', emoji: '⚡' },
    { id: 'none', emoji: '🧘' },
  ];
  const descKey: Record<TimeMode, 'mode.time.normal.desc' | 'mode.time.quick.desc' | 'mode.time.none.desc'> = {
    normal: 'mode.time.normal.desc',
    quick: 'mode.time.quick.desc',
    none: 'mode.time.none.desc',
  };
  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(opt.id)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                padding: spacing[3],
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: active ? colors.gold : colors.border,
                backgroundColor: active ? alpha(colors.gold, 0.1) : colors.surface,
                gap: spacing[1],
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <TiraText style={{ fontSize: 20 }}>{opt.emoji}</TiraText>
              <TiraText size="xs" weight="semibold" variant={active ? 'gold' : 'default'}>
                {t(`mode.time.${opt.id}`)}
              </TiraText>
            </Pressable>
          );
        })}
      </View>
      <TiraText size="xs" variant="muted" align="center">
        {t(descKey[value])}
      </TiraText>
    </View>
  );
}
