/**
 * TournamentPlay — port mobile de `TournamentPlayScreen` (web).
 *
 * Joga uma partida da chave do Torneio Semanal (PvE vs IA), avalia o
 * resultado no fim e avança o vencedor na chave. O tabuleiro só visualiza o
 * `GameState` do motor; a IA é agendada por `@/game/useGame`.
 */
import {
  isGameOver,
  type GameState,
  type Line,
  type Move,
  type Square,
} from '@tira/engine';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronRight, Flag, Frown, RefreshCw, Target, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Board } from '@/components/board/Board';
import { GameButton, GameCard } from '@/components/game/ui';
import { TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { useGame } from '@/game/useGame';
import { getEntrant } from '@/lib/tournament';
import { useGameStore } from '@/store/game';
import { useTournament } from '@/store/tournament';
import { boardGeometry, colors, radii, spacing, typography } from '@/theme';

type ResultType = 'success' | 'failure' | null;

function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/tournament');
  }
}

function BtnRow({
  icon,
  color,
  children,
}: {
  icon: ReactNode;
  color: string;
  children: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
      {icon}
      <TiraText
        size="sm"
        weight="semibold"
        numberOfLines={1}
        style={{ color, fontFamily: typography.fontFamily.body }}
      >
        {children}
      </TiraText>
    </View>
  );
}

export default function TournamentPlayScreen() {
  const currentMatchId = useTournament((s) => s.currentMatchId);
  const bracket = useTournament((s) => s.bracket);
  const advance = useTournament((s) => s.advance);

  const match = useMemo(
    () => (bracket && currentMatchId ? bracket.matches[currentMatchId] ?? null : null),
    [bracket, currentMatchId],
  );
  const p1 = useMemo(() => getEntrant(bracket, match?.p1Id), [bracket, match]);
  const p2 = useMemo(() => getEntrant(bracket, match?.p2Id), [bracket, match]);

  const humanSide: 'P1' | 'P2' = p1?.isHuman ? 'P1' : 'P2';

  const game = useGame();

  const [result, setResult] = useState<ResultType>(null);
  const [resultComputed, setResultComputed] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const matchId = match?.id ?? null;

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.lg,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  // Inicia a partida ao montar / mudar de partida. Usa getState() para o
  // efeito não depender do snapshot completo da store.
  useEffect(() => {
    if (!matchId || !match || match.winnerId) return;
    useGameStore.getState().startGame({
      mode: 'pve',
      difficulty: 'medium',
      humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    setGameStarted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, humanSide]);

  // Avalia o resultado quando o jogo termina.
  const gameEnded = isGameOver(game.state);
  useEffect(() => {
    if (!gameEnded || !match || !gameStarted || resultComputed) return;
    setResultComputed(true);
    const humanWon = game.state.winner === humanSide;
    if (humanWon) {
      setResult('success');
      advance(match.id, 'human');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } else {
      setResult('failure');
      const oppId = humanSide === 'P1' ? match.p2Id : match.p1Id;
      if (oppId) advance(match.id, oppId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameEnded, gameStarted, resultComputed, match, humanSide, advance, game.state.winner]);

  const handleSquareClick = useCallback((sq: Square) => {
    const g = useGameStore.getState();
    if (isGameOver(g.state)) return;
    if (g.state.currentPlayer !== g.humanSide) return;
    const cell = g.state.board[sq - 1];
    if (cell === g.state.currentPlayer) {
      g.selectSquare(sq);
    } else if (g.selectedSquare && g.validTargets.includes(sq)) {
      g.attemptMove(sq);
    }
  }, []);

  const handleRestart = useCallback(() => {
    setResult(null);
    setResultComputed(false);
    setGameStarted(false);
    useGameStore.getState().startGame({
      mode: 'pve',
      difficulty: 'medium',
      humanSide,
      showThreats: true,
      timePerTurn: 0,
    });
    setGameStarted(true);
  }, [humanSide]);

  if (!match || !bracket) {
    return (
      <TiraScreen>
        <GameCard style={{ padding: spacing[8], alignItems: 'center' }}>
          <Flag width={40} height={40} color={colors.textMuted} style={{ marginBottom: spacing[3] }} />
          <TiraText size="sm" variant="muted" align="center" style={{ marginBottom: spacing[4] }}>
            Nenhuma partida selecionada.
          </TiraText>
          <GameButton variant="p1" onPress={() => router.replace('/tournament')}>
            Voltar ao Torneio
          </GameButton>
        </GameCard>
      </TiraScreen>
    );
  }

  const oppName = humanSide === 'P1' ? p2?.name : p1?.name;
  const roundLabel =
    match.round === 3 ? 'Final' : match.round === 2 ? 'Meias-finais' : '1/4 Final';

  const legalMoves: Move[] = game.selectedSquare
    ? game.validTargets.map((to) => ({ from: game.selectedSquare as Square, to }))
    : [];

  return (
    <TiraScreen
      chrome={false}
      scroll={false}
      style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 }}
      overlay={
        result ? (
          <ResultOverlay
            result={result}
            state={game.state}
            lastMove={game.lastMove}
            winningLine={game.winningLine}
            onBack={() => router.replace('/tournament')}
          />
        ) : undefined
      }
    >
      <View style={{ flex: 1 }}>
        {/* Header próprio (ecrã full-screen) */}
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: alpha(colors.bg, 0.6),
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[3],
          }}
        >
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.pill,
              backgroundColor: alpha(colors.surface, 0.6),
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <ChevronRight
              width={20}
              height={20}
              color={colors.text}
              style={{ transform: [{ rotate: '180deg' }] }}
            />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
            <TiraText
              size="xs"
              variant="muted"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontFamily: typography.fontFamily.body,
              }}
            >
              Torneio • {roundLabel}
            </TiraText>
            <TiraText size="xs" variant="gold" weight="medium" numberOfLines={1}>
              Tu vs {oppName}
            </TiraText>
          </View>
          <View style={{ width: 48, height: 48 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
          }}
          showsVerticalScrollIndicator={false}
        >
          <GameCard style={{ padding: spacing[3], marginBottom: spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.lg,
                  backgroundColor: alpha(colors.gold, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Target width={20} height={20} color={colors.gold} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TiraText
                  size="xs"
                  variant="muted"
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  Partida
                </TiraText>
                <TiraText size="sm" weight="medium">
                  Vence para passar à ronda seguinte
                </TiraText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <TiraText size="xs" variant="muted" style={{ fontSize: 10 }}>
                  Jogadas
                </TiraText>
                <TiraHeading level="h3" style={{ fontSize: 20.25, letterSpacing: 0.405, lineHeight: 31.5 }}>
                  {game.moveCount}
                </TiraHeading>
              </View>
            </View>
          </GameCard>

          <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
            <Board
              state={game.state}
              selectedSquare={game.selectedSquare}
              legalMoves={legalMoves}
              lastMove={game.lastMove}
              threats={[]}
              size={boardSize}
              onSquarePress={handleSquareClick}
              testID="tournament-play-board"
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: spacing[2],
              width: '100%',
              maxWidth: 448,
              alignSelf: 'center',
            }}
          >
            <GameButton variant="p2" style={{ flex: 1 }} onPress={handleRestart}>
              <BtnRow
                icon={<RefreshCw width={16} height={16} color={colors.white} />}
                color={colors.white}
              >
                Reiniciar
              </BtnRow>
            </GameButton>
          </View>
        </ScrollView>
      </View>
    </TiraScreen>
  );
}

function ResultOverlay({
  result,
  state,
  lastMove,
  winningLine,
  onBack,
}: {
  result: Exclude<ResultType, null>;
  state: GameState;
  lastMove: Move | null;
  winningLine: Line | null;
  onBack: () => void;
}) {
  const success = result === 'success';
  const { width } = useWindowDimensions();
  const resultBoardSize = Math.min(
    boardGeometry.gridSizePresets.sm,
    Math.max(
      180,
      width -
        spacing[4] * 2 -
        spacing[5] * 2 -
        spacing[3] * 2 -
        boardGeometry.framePadding * 2 -
        4,
    ),
  );

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: alpha(colors.bg, 0.95),
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[4],
      }}
    >
      <View style={{ width: '100%', maxWidth: 420 }}>
        <GameCard
          glow={success ? 'gold' : null}
          style={{
            padding: spacing[5],
            borderColor: success ? alpha(colors.p1, 0.4) : alpha(colors.p2, 0.4),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
              marginBottom: spacing[3],
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.cardLg,
                backgroundColor: success ? alpha(colors.gold, 0.15) : alpha(colors.p2, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {success ? (
                <Trophy width={28} height={28} color={colors.gold} />
              ) : (
                <Frown width={28} height={28} color={colors.p2} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TiraHeading
                level="display"
                color={success ? 'p1' : 'p2'}
                style={[
                  { letterSpacing: 0.844, lineHeight: 33.75 },
                  success ? { textShadowColor: colors.gold, textShadowRadius: 12 } : null,
                ]}
              >
                {success ? 'GANHASTE!' : 'PERDESTE'}
              </TiraHeading>
              <TiraText size="xs" variant="muted" style={{ marginTop: spacing[1] }}>
                {success ? 'Avanças na chave do torneio' : 'O teu adversário avança'}
              </TiraText>
            </View>
          </View>

          {/* Tabuleiro REAL da posição final */}
          <View
            style={{
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: alpha(colors.border, 0.6),
              backgroundColor: alpha(colors.surfaceAlt, 0.6),
              padding: spacing[3],
            }}
          >
            <TiraText
              size="xs"
              variant="muted"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: spacing[2],
                fontFamily: typography.fontFamily.body,
              }}
            >
              {winningLine && winningLine.length === 3 ? 'Como foi a vitória' : 'Posição final'}
            </TiraText>
            <View style={{ alignItems: 'center' }}>
              <Board
                state={state}
                selectedSquare={null}
                legalMoves={[]}
                lastMove={lastMove}
                threats={[]}
                size={resultBoardSize}
              />
            </View>
          </View>

          <TiraText
            size="xs"
            variant="muted"
            align="center"
            style={{ marginTop: spacing[3], marginBottom: spacing[4] }}
          >
            {lastMove
              ? `Última jogada: casa ${lastMove.from} → casa ${lastMove.to}`
              : 'Nenhuma linha foi completada.'}
          </TiraText>

          <GameButton variant="p1" style={{ width: '100%' }} onPress={onBack}>
            Voltar ao Torneio
          </GameButton>
        </GameCard>
      </View>
    </View>
  );
}
