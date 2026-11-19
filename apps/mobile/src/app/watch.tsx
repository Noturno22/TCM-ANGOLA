/**
 * Watch — port 1:1 do WatchScreen web: duas IAs jogam ao vivo com comentário
 * em PT, tabuleiro, controlos de reprodução e configuração de dificuldades.
 *
 * Adaptações mobile: háptica no lugar dos sons (`playSound`), overlay de fim
 * sem gradiente (não há expo-linear-gradient) e tabuleiro dimensionado à
 * largura do ecrã. O resto segue o conteúdo/ordem/cores do web.
 */
import { chooseMove, type Difficulty } from '@tira/ai';
import {
  applyMove,
  createGame,
  isGameOver,
  type GameState,
  type Move,
} from '@tira/engine';
import * as Haptics from 'expo-haptics';
import {
  ChevronRight,
  Eye,
  Footprints,
  Handshake,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  SkipForward,
  Snail,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Board } from '@/components/board/Board';
import { GameButton, GameCard } from '@/components/game/ui';
import { TiraScreen, alpha } from '@/components/tira';
import { commentOnMove, commentOnStart, type Commentary } from '@/content';
import { boardGeometry, colors, radii, spacing, typography } from '@/theme';

type Phase = 'intro' | 'playing' | 'finished';
type Speed = 'slow' | 'normal' | 'fast';

interface ChatMessage {
  id: number;
  commentary: Commentary;
  moveNum: number;
}

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'perfect'];

const SPEEDS: { id: Speed; label: string; Icon: LucideIcon }[] = [
  { id: 'slow', label: 'Lenta', Icon: Snail },
  { id: 'normal', label: 'Normal', Icon: Footprints },
  { id: 'fast', label: 'Rápida', Icon: Zap },
];

const H2: TextStyle = {
  fontFamily: DISPLAY,
  fontSize: 33.75,
  letterSpacing: 0.844,
  color: colors.text,
  marginBottom: spacing[2],
};

const INTRO_DESC: TextStyle = {
  maxWidth: 320,
  alignSelf: 'center',
  textAlign: 'center',
  fontSize: 15.75,
  lineHeight: 20,
  color: colors.textMuted,
  fontFamily: BODY,
  marginBottom: spacing[6],
};

const GROUP_TITLE: TextStyle = {
  fontFamily: DISPLAY,
  fontSize: 20.25,
  letterSpacing: 0.3,
  color: colors.text,
};

const BTN_LABEL: TextStyle = {
  fontSize: 13.5,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: BODY,
};

const CAPTION: TextStyle = {
  fontSize: 13.5,
  color: colors.textMuted,
  fontFamily: BODY,
};

function feedback(kind: 'move' | 'win' | 'threat' | 'start' | 'click'): void {
  if (kind === 'win') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    return;
  }
  if (kind === 'threat') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    return;
  }
  if (kind === 'start') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    return;
  }
  Haptics.selectionAsync().catch(() => undefined);
}

export default function WatchScreen() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [difficulty1, setDifficulty1] = useState<Difficulty>('medium');
  const [difficulty2, setDifficulty2] = useState<Difficulty>('hard');
  const [speed, setSpeed] = useState<Speed>('normal');

  const [state, setState] = useState<GameState>(() => createGame());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [playing, setPlaying] = useState(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const msgIdRef = useRef(0);
  const stateRef = useRef<GameState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const { width } = useWindowDimensions();
  const boardSize = Math.min(
    boardGeometry.gridSizePresets.lg,
    width - spacing[4] * 2 - boardGeometry.framePadding * 2,
  );

  const speedMs = speed === 'slow' ? 2000 : speed === 'fast' ? 600 : 1200;

  const addMessage = useCallback((commentary: Commentary, moveNum: number) => {
    msgIdRef.current += 1;
    setMessages((prev) => [
      ...prev.slice(-15),
      { id: msgIdRef.current, commentary, moveNum },
    ]);
  }, []);

  const makeAiMove = useCallback(() => {
    const currentState = stateRef.current;
    if (isGameOver(currentState)) {
      setPlaying(false);
      setPhase('finished');
      return;
    }
    const player = currentState.currentPlayer;
    const diff = player === 'P1' ? difficulty1 : difficulty2;
    const seed = (Date.now() + currentState.moveCount * 7919) | 0;
    const move = chooseMove(currentState, diff, seed);
    if (!move) {
      setPlaying(false);
      setPhase('finished');
      return;
    }
    const prevState = currentState;
    try {
      const { state: newState } = applyMove(currentState, move);
      setState(newState);
      setLastMove(move);
      const commentary = commentOnMove(prevState, move, newState, newState.moveCount);
      addMessage(commentary, newState.moveCount);
      if (newState.winner) {
        feedback('win');
      } else if (commentary.type === 'threat') {
        feedback('threat');
      } else {
        feedback('move');
      }
    } catch {
      setPlaying(false);
      setPhase('finished');
    }
  }, [difficulty1, difficulty2, addMessage]);

  useEffect(() => {
    if (phase !== 'playing' || !playing) return;
    if (isGameOver(state)) return;
    const timer = setTimeout(() => {
      makeAiMove();
    }, speedMs);
    return () => clearTimeout(timer);
  }, [phase, playing, state, speedMs, makeAiMove]);

  if (phase === 'playing' && isGameOver(state)) {
    setPlaying(false);
    setPhase('finished');
  }

  const startWatch = () => {
    const newState = createGame();
    setState(newState);
    setMessages([{ id: 0, commentary: commentOnStart(), moveNum: 0 }]);
    setLastMove(null);
    setPhase('playing');
    setPlaying(true);
    feedback('start');
  };

  const togglePause = () => {
    setPlaying((p) => !p);
    feedback('click');
  };

  const stepForward = () => {
    if (!isGameOver(state)) {
      makeAiMove();
    }
    feedback('click');
  };

  const reset = () => {
    const newState = createGame();
    setState(newState);
    setMessages([{ id: 0, commentary: commentOnStart(), moveNum: 0 }]);
    setLastMove(null);
    setPlaying(false);
    setPhase('playing');
    feedback('start');
  };

  const goIntro = () => {
    setPhase('intro');
    setPlaying(false);
    setState(createGame());
    setMessages([]);
    setLastMove(null);
  };

  if (phase === 'intro') {
    return (
      <TiraScreen>
        <View style={{ gap: spacing[5], paddingBottom: spacing[4] }}>
          <GameCard glow="gold" style={{ padding: spacing[6], alignItems: 'center' }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.xl,
                backgroundColor: alpha(colors.gold, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[4],
              }}
            >
              <Eye size={32} color={colors.gold} />
            </View>
            <Text style={H2}>ASSISTIR</Text>
            <Text style={INTRO_DESC}>
              Observa duas IAs a competir com comentário ao vivo. Aprende estratégias vendo os
              mestres a jogar.
            </Text>

            <View style={{ width: '100%', gap: spacing[4], marginBottom: spacing[6] }}>
              <View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: spacing[2],
                  }}
                >
                  <PlayerDot player="P1" />
                  <Text style={GROUP_TITLE}>Jogador 1</Text>
                </View>
                <TwoColumn>
                  {DIFFICULTIES.map((d) => (
                    <DifficultyOption
                      key={d}
                      difficulty={d}
                      active={difficulty1 === d}
                      player="P1"
                      onPress={() => setDifficulty1(d)}
                    />
                  ))}
                </TwoColumn>
              </View>

              <View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: spacing[2],
                  }}
                >
                  <PlayerDot player="P2" />
                  <Text style={GROUP_TITLE}>Jogador 2</Text>
                </View>
                <TwoColumn>
                  {DIFFICULTIES.map((d) => (
                    <DifficultyOption
                      key={d}
                      difficulty={d}
                      active={difficulty2 === d}
                      player="P2"
                      onPress={() => setDifficulty2(d)}
                    />
                  ))}
                </TwoColumn>
              </View>

              <View>
                <Text style={[GROUP_TITLE, { textAlign: 'center', marginBottom: spacing[2] }]}>
                  Velocidade
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  {SPEEDS.map((s) => (
                    <SpeedOption
                      key={s.id}
                      label={s.label}
                      Icon={s.Icon}
                      active={speed === s.id}
                      onPress={() => setSpeed(s.id)}
                    />
                  ))}
                </View>
              </View>
            </View>

            <GameButton variant="gold" style={{ width: '100%' }} onPress={startWatch}>
              <Play size={16} color={colors.primaryForeground} />
              <Text
                style={[
                  BTN_LABEL,
                  { fontSize: 15.75, color: colors.primaryForeground, fontWeight: '600' },
                ]}
              >
                COMEÇAR A ASSISTIR
              </Text>
            </GameButton>
          </GameCard>
        </View>
      </TiraScreen>
    );
  }

  const gameOver = isGameOver(state);

  return (
    <TiraScreen>
      <View style={{ gap: spacing[4], paddingBottom: spacing[4] }}>
        <GameCard style={{ padding: spacing[3] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <PlayerDot player="P1" size={12} />
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text, fontFamily: BODY }}>
                {diffLabel(difficulty1)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: BODY }}>vs</Text>
              <PlayerDot player="P2" size={12} />
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text, fontFamily: BODY }}>
                {diffLabel(difficulty2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <Text style={CAPTION}>{`Jogada ${state.moveCount}`}</Text>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radii.pill,
                  backgroundColor: state.currentPlayer === 'P1' ? colors.p1 : colors.p2,
                }}
              />
            </View>
          </View>
        </GameCard>

        <View style={{ gap: spacing[4] }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <Board
                state={state}
                selectedSquare={null}
                legalMoves={[]}
                lastMove={lastMove}
                size={boardSize}
                testID="watch-board"
              />
              {gameOver ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    borderRadius: radii.xl,
                    padding: spacing[3],
                    backgroundColor: alpha(colors.bg, 0.45),
                  }}
                >
                  <View
                    style={{
                      alignItems: 'center',
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[2],
                      borderRadius: radii.xl,
                      backgroundColor: alpha(colors.bg, 0.85),
                      borderWidth: 1,
                      borderColor: alpha(colors.gold, 0.3),
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing[2],
                      }}
                    >
                      {state.winner === 'P1' ? (
                        <PlayerDot player="P1" size={20} />
                      ) : state.winner === 'P2' ? (
                        <PlayerDot player="P2" size={20} />
                      ) : (
                        <Handshake size={20} color={colors.gold} />
                      )}
                      <Text
                        style={{
                          fontFamily: DISPLAY,
                          fontSize: 22.5,
                          letterSpacing: 0.3,
                          color: colors.gold,
                        }}
                      >
                        {state.winner
                          ? `${state.winner === 'P1' ? 'Jogador 1' : 'Jogador 2'} vence!`
                          : 'Empate!'}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        fontFamily: BODY,
                        marginTop: 2,
                      }}
                    >
                      {`${state.moveCount} jogadas`}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: 'row',
                gap: spacing[2],
                marginTop: spacing[4],
                width: '100%',
                maxWidth: 320,
              }}
            >
              {!gameOver ? (
                <GameButton
                  variant={playing ? 'outline' : 'p1'}
                  style={{ flex: 1, paddingHorizontal: spacing[3] }}
                  onPress={togglePause}
                >
                  {playing ? (
                    <Pause size={16} color={colors.text} />
                  ) : (
                    <Play size={16} color={colors.white} />
                  )}
                  <ControlLabel color={playing ? colors.text : colors.white}>
                    {playing ? 'Pausa' : 'Continuar'}
                  </ControlLabel>
                </GameButton>
              ) : null}
              {!gameOver && !playing ? (
                <GameButton
                  variant="outline"
                  style={{ flex: 1, paddingHorizontal: spacing[3] }}
                  onPress={stepForward}
                >
                  <SkipForward size={16} color={colors.text} />
                  <ControlLabel>Passo</ControlLabel>
                </GameButton>
              ) : null}
              <GameButton
                variant="outline"
                style={{ flex: 1, paddingHorizontal: spacing[3] }}
                onPress={reset}
              >
                <RefreshCw size={16} color={colors.text} />
                <ControlLabel>Reiniciar</ControlLabel>
              </GameButton>
            </View>
          </View>

          <GameCard style={{ padding: spacing[3], height: 400 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
                marginBottom: spacing[2],
                paddingBottom: spacing[2],
                borderBottomWidth: 1,
                borderBottomColor: alpha(colors.white, 0.04),
              }}
            >
              <MessageCircle size={16} color={colors.gold} />
              <Text
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 15.75,
                  letterSpacing: 0.3,
                  color: colors.text,
                }}
              >
                Comentário ao vivo
              </Text>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: spacing[2] }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </ScrollView>
          </GameCard>
        </View>

        {gameOver ? (
          <View style={{ gap: spacing[2] }}>
            <GameButton variant="p1" style={{ width: '100%' }} onPress={reset}>
              <RefreshCw size={16} color={colors.white} />
              <ControlLabel color={colors.white}>Ver outra partida</ControlLabel>
            </GameButton>
            <GameButton variant="outline" style={{ width: '100%' }} onPress={goIntro}>
              <ControlLabel>Mudar configuração</ControlLabel>
              <ChevronRight size={16} color={colors.text} />
            </GameButton>
          </View>
        ) : null}
      </View>
    </TiraScreen>
  );
}

function TwoColumn({ children }: { children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return (
    <View style={{ gap: spacing[2] }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: spacing[2] }}>
          {row}
        </View>
      ))}
    </View>
  );
}

function DifficultyOption({
  difficulty,
  active,
  player,
  onPress,
}: {
  difficulty: Difficulty;
  active: boolean;
  player: 'P1' | 'P2';
  onPress: () => void;
}) {
  const color = player === 'P1' ? colors.p1 : colors.p2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: 10,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: active ? color : alpha(colors.white, 0.04),
        backgroundColor: active ? alpha(color, 0.1) : colors.transparent,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          textAlign: 'center',
          fontSize: 15.75,
          fontFamily: BODY,
          fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.regular,
          color: active ? color : colors.textMuted,
        }}
      >
        {diffLabel(difficulty)}
      </Text>
    </Pressable>
  );
}

function SpeedOption({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: LucideIcon;
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
        padding: 10,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: active ? colors.gold : alpha(colors.white, 0.04),
        backgroundColor: active ? alpha(colors.gold, 0.1) : colors.transparent,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon size={16} color={colors.text} />
      <Text
        style={{
          fontSize: 10,
          fontWeight: typography.fontWeight.medium,
          fontFamily: BODY,
          color: active ? colors.gold : colors.text,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const style: ViewStyle = {
    padding: spacing[2],
    borderRadius: radii.lg,
    backgroundColor: alpha(colors.surfaceAlt, 0.4),
  };
  if (msg.commentary.type === 'win') {
    style.backgroundColor = alpha(colors.gold, 0.15);
    style.borderWidth = 1;
    style.borderColor = alpha(colors.gold, 0.3);
  } else if (msg.commentary.type === 'threat') {
    style.backgroundColor = alpha(colors.p2, 0.1);
    style.borderWidth = 1;
    style.borderColor = alpha(colors.p2, 0.3);
  } else if (msg.commentary.type === 'good') {
    style.backgroundColor = alpha(colors.p1, 0.1);
  } else if (msg.commentary.type === 'bad') {
    style.backgroundColor = alpha(colors.p2, 0.1);
  }

  return (
    <View style={style}>
      <Text style={{ fontSize: 13.5, lineHeight: 16, color: colors.text, fontFamily: BODY }}>
        {msg.moveNum > 0 ? (
          <Text
            style={{
              fontSize: 9,
              color: colors.textMuted,
              fontFamily: typography.fontFamily.mono,
            }}
          >
            {`#${msg.moveNum} `}
          </Text>
        ) : null}
        {msg.commentary.text}
      </Text>
    </View>
  );
}

function PlayerDot({ player, size = 10 }: { player: 'P1' | 'P2'; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        backgroundColor: player === 'P1' ? colors.p1 : colors.p2,
      }}
    />
  );
}

function ControlLabel({
  children,
  color = colors.text,
}: {
  children: ReactNode;
  color?: string;
}) {
  return <Text style={[BTN_LABEL, { color }]}>{children}</Text>;
}

function diffLabel(d: Difficulty): string {
  return d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : d === 'hard' ? 'Difícil' : 'Perfeito';
}
