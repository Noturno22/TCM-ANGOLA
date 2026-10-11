/**
 * Replay — port do ReplayScreen web: escolhe uma partida (histórico do
 * perfil ou a partida em curso no store de jogo) e percorre-a jogada a
 * jogada no Board, com reprodução automática e passo a passo.
 *
 * Estados de cada jogada: `replayFrom(moves)` do motor para partidas
 * gravadas; `stateHistory` do store para a partida em curso. O comentário
 * em PT vem do gerador partilhado (`@/content` → src/lib/commentary.ts).
 */
import { replayFrom, type GameState, type Move } from '@tira/engine';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Board } from '@/components/board/Board';
import {
  EmptyState,
  ResultBadge,
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { commentOnMove, commentOnStart } from '@/content';
import { useT } from '@/lib/i18n/hook';
import { useGameStore } from '@/store/game';
import { useProfile, type MatchRecord } from '@/store/profile';
import { boardGeometry, colors, radii, spacing } from '@/theme';

interface ReplaySource {
  id: string;
  date: string;
  mode: MatchRecord['mode'];
  difficulty: MatchRecord['difficulty'];
  result: MatchRecord['result'];
  playerSide: MatchRecord['playerSide'];
  opponent: string;
  moves: Move[];
  durationSec: number;
  reason: MatchRecord['reason'];
  states: GameState[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReplayScreen() {
  const { t } = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId?: string }>();
  const matches = useProfile((s) => s.matches);
  const live = useGameStore();

  const sources = useMemo<ReplaySource[]>(() => {
    const list: ReplaySource[] = [];
    if (live.stateHistory.length > 1) {
      const last = live.stateHistory[live.stateHistory.length - 1];
      list.push({
        id: 'live',
        date: new Date(live.startTime || Date.now()).toISOString(),
        mode: live.mode === 'practice' ? 'pve' : live.mode,
        difficulty: live.difficulty,
        result: last.winner ?? 'DRAW',
        playerSide: live.mode === 'pvp' ? undefined : live.humanSide,
        opponent:
          live.mode === 'pve'
            ? `${t('game.ia')} ${t(`diff.${live.difficulty}`)}`
            : t('game.player2'),
        moves: [...last.history],
        durationSec: live.startTime > 0 ? Math.max(0, Math.round((Date.now() - live.startTime) / 1000)) : 0,
        reason: undefined,
        states: live.stateHistory,
      });
    }
    for (const m of matches) {
      list.push({
        id: m.id,
        date: m.date,
        mode: m.mode,
        difficulty: m.difficulty,
        result: m.result,
        playerSide: m.playerSide,
        opponent: m.opponent,
        moves: m.moves,
        durationSec: m.durationSec,
        reason: m.reason,
        states: replayFrom(m.moves),
      });
    }
    return list;
  }, [matches, live, t]);

  const paramId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null);

  const source = useMemo(
    () => sources.find((s) => s.id === selectedId) ?? sources[0] ?? null,
    [sources, selectedId],
  );

  if (!source) {
    return (
      <TiraScreen title={t('replay.title')} showBack>
        <EmptyState
          emoji="🎬"
          title={t('replay.empty')}
          desc={t('replay.empty.desc')}
          actionLabel={t('replay.go_profile')}
          onAction={() => router.replace('/profile')}
        />
      </TiraScreen>
    );
  }

  return (
    <TiraScreen title={t('replay.title')} subtitle={t('replay.subtitle')} showBack>
      {sources.length > 1 ? (
        <View style={{ gap: spacing[2] }}>
          {sources.slice(0, 20).map((s) => {
            const active = s.id === source.id;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setSelectedId(s.id);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <TiraCard
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    padding: spacing[3],
                    borderColor: active ? alpha(colors.gold, 0.5) : colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: radii.pill,
                      backgroundColor:
                        s.result === 'DRAW'
                          ? colors.textMuted
                          : s.result === 'P1'
                            ? colors.p1
                            : colors.p2,
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <TiraText size="xs" weight="semibold" numberOfLines={1}>
                      {s.id === 'live' ? t('replay.live') : t('share.vs', { opponent: s.opponent })}
                    </TiraText>
                    <TiraText size="xs" variant="muted">
                      {`${formatDate(s.date)} • ${s.moves.length} ${t('game.moves').toLowerCase()}`}
                    </TiraText>
                  </View>
                  {active ? <TiraText size="xs" variant="gold">●</TiraText> : null}
                </TiraCard>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ReplayView
        key={source.id}
        source={source}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
    </TiraScreen>
  );
}

function ReplayView({ source, onClose }: { source: ReplaySource; onClose: () => void }) {
  const { t } = useT();
  const states = source.states;
  const moves = source.moves;
  const totalPlies = Math.min(states.length - 1, moves.length);

  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const isAtEnd = ply >= totalPlies;

  useEffect(() => {
    if (!playing || isAtEnd) return;
    const timer = setTimeout(() => {
      Haptics.selectionAsync().catch(() => undefined);
      setPly((p) => Math.min(totalPlies, p + 1));
    }, 900);
    return () => clearTimeout(timer);
  }, [playing, isAtEnd, totalPlies, ply]);

  const current = states[Math.min(ply, states.length - 1)];
  const lastMove = ply > 0 ? moves[ply - 1] : null;

  const commentary = useMemo(() => {
    if (ply === 0) return commentOnStart();
    const prev = states[ply - 1];
    const next = states[ply];
    const move = moves[ply - 1];
    if (!prev || !next || !move) return commentOnStart();
    return commentOnMove(prev, move, next, ply);
  }, [ply, states, moves]);

  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (isAtEnd) {
      setPly(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [isAtEnd]);

  const handleStep = useCallback(
    (delta: number) => {
      setPlaying(false);
      Haptics.selectionAsync().catch(() => undefined);
      setPly((p) => Math.min(totalPlies, Math.max(0, p + delta)));
    },
    [totalPlies],
  );

  const handleReset = useCallback(() => {
    setPlaying(false);
    setPly(0);
  }, []);

  const seek = useCallback(
    (fraction: number) => {
      setPlaying(false);
      setPly(Math.min(totalPlies, Math.max(0, Math.round(fraction * totalPlies))));
    },
    [totalPlies],
  );

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.md,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  const modeLabel =
    source.mode === 'pvp'
      ? t('mode.pvp')
      : source.mode === 'pve'
        ? t('game.vs_ai')
        : t('replay.mode.cvc');
  const diffLabel = source.difficulty ? ` • ${t(`diff.${source.difficulty}`)}` : '';
  const resultLabel =
    source.result === 'DRAW'
      ? t('result.draw')
      : source.playerSide
        ? source.result === source.playerSide
          ? t('result.win')
          : t('result.loss')
        : `${t('result.win')} ${source.result === 'P1' ? 1 : 2}`;
  const reasonLabel =
    source.reason === 'LINE'
      ? t('replay.reason.line')
      : source.reason === 'REPETITION'
        ? t('replay.reason.repetition')
        : source.reason === 'RESIGN'
          ? t('replay.reason.resign')
          : null;

  return (
    <View style={{ gap: spacing[4] }}>
      <TiraCard>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] }}>
          <InfoCell label={t('replay.info.date')} value={`${formatDate(source.date)} · ${formatTimeOfDay(source.date)}`} />
          <InfoCell label={t('replay.info.mode')} value={`${modeLabel}${diffLabel}`} />
          <InfoCell label={t('replay.info.opponent')} value={source.opponent} />
          <InfoCell label={t('replay.info.duration')} value={`${source.durationSec}s`} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing[3],
            paddingTop: spacing[3],
            borderTopWidth: 1,
            borderTopColor: alpha(colors.border, 0.6),
          }}
        >
          <View style={{ gap: 2 }}>
            <TiraText size="xs" variant="muted" style={{ textTransform: 'uppercase' }}>
              {t('replay.result')}
            </TiraText>
            <TiraText size="sm" weight="semibold">
              {resultLabel}
            </TiraText>
          </View>
          <ResultBadge result={source.result} playerSide={source.playerSide} />
        </View>
        {reasonLabel ? (
          <TiraText size="xs" variant="muted" align="center" style={{ marginTop: spacing[2] }}>
            {reasonLabel}
          </TiraText>
        ) : null}
      </TiraCard>

      <View style={{ alignItems: 'center' }}>
        <Board
          state={current}
          selectedSquare={null}
          legalMoves={[]}
          lastMove={lastMove}
          size={boardSize}
          testID="replay-board"
        />
      </View>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <TiraText size="sm" align="center">
          {t('replay.move', { n: ply, total: totalPlies })}
        </TiraText>
        <TiraText size="xs" variant={current.currentPlayer === 'P1' ? 'p1' : 'p2'}>
          {ply === 0
            ? t('replay.initial')
            : t('replay.turn', { n: current.currentPlayer === 'P1' ? 1 : 2 })}
        </TiraText>
      </View>

      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('replay.move', { n: ply, total: totalPlies })}
        accessibilityValue={{ min: 0, max: totalPlies, now: ply }}
      >
        <Pressable
          onPress={(e) => {
            if (trackWidth <= 0 || totalPlies <= 0) return;
            seek(e.nativeEvent.locationX / trackWidth);
          }}
          style={{
            height: 10,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceAlt,
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: `${totalPlies > 0 ? (ply / totalPlies) * 100 : 0}%`,
              height: '100%',
              borderRadius: radii.pill,
              backgroundColor: colors.gold,
            }}
          />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <TiraButton
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          disabled={ply === 0}
          onPress={handleReset}
          accessibilityLabel={t('replay.reset')}
        >
          {`⏮ ${t('replay.reset')}`}
        </TiraButton>
        <TiraButton
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          disabled={ply === 0}
          onPress={() => handleStep(-1)}
          accessibilityLabel={t('replay.step_back')}
        >
          {`⏪ ${t('replay.step_back')}`}
        </TiraButton>
        <TiraButton
          variant="gold"
          size="sm"
          style={{ flex: 1.2 }}
          onPress={handlePlay}
          accessibilityLabel={playing && !isAtEnd ? t('replay.pause') : t('replay.play')}
        >
          {playing && !isAtEnd ? `⏸ ${t('replay.pause')}` : `▶️ ${t('replay.play')}`}
        </TiraButton>
        <TiraButton
          variant="outline"
          size="sm"
          style={{ flex: 1 }}
          disabled={isAtEnd}
          onPress={() => handleStep(1)}
          accessibilityLabel={t('replay.step_fwd')}
        >
          {`⏩ ${t('replay.step_fwd')}`}
        </TiraButton>
      </View>

      <TiraCard
        style={{
          borderColor: alpha(colors.gold, 0.3),
          backgroundColor: alpha(colors.gold, 0.05),
        }}
      >
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <TiraText size="lg">{commentary.emoji ?? '💬'}</TiraText>
          <TiraText size="sm" style={{ flex: 1 }}>
            {commentary.text}
          </TiraText>
        </View>
      </TiraCard>

      {isAtEnd && totalPlies > 0 ? (
        <TiraCard glow="gold">
          <View style={{ alignItems: 'center', gap: spacing[1] }}>
            <TiraHeading level="h3" color={source.result === 'DRAW' ? 'textMuted' : 'gold'}>
              {source.result === 'DRAW'
                ? t('replay.end.draw')
                : t('replay.end.win', {
                    side: source.result === 'P1' ? t('game.player1') : t('game.player2'),
                  })}
            </TiraHeading>
            <TiraText size="xs" variant="muted">
              {t('replay.end')}
            </TiraText>
          </View>
        </TiraCard>
      ) : null}

      <TiraButton variant="outline" fullWidth onPress={onClose}>
        {`✕ ${t('replay.close')}`}
      </TiraButton>
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 120, gap: 2 }}>
      <TiraText size="xs" variant="muted" style={{ textTransform: 'uppercase' }}>
        {label}
      </TiraText>
      <TiraText size="xs" variant="muted" numberOfLines={1}>
        {value}
      </TiraText>
    </View>
  );
}
