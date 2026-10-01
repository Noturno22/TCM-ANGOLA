/**
 * Gerador de comentário textual para partidas (modo Assistir).
 * Analisa o estado do jogo e gera comentários contextuais em PT.
 */

import {
  getWinningMoves,
  getThreats,
  getLegalMoves,
  type GameState,
  type Move,
  type PlayerId,
} from '@/lib/engine';

export interface Commentary {
  text: string;
  type: 'neutral' | 'good' | 'bad' | 'threat' | 'win' | 'info';
  emoji?: string;
}

/**
 * Gera um comentário para a jogada acabada de acontecer.
 */
export function commentOnMove(
  prevState: GameState,
  move: Move,
  newState: GameState,
  moveNum: number,
): Commentary {
  const mover = move.from;
  const dest = move.to;
  const player = prevState.currentPlayer;
  const playerLabel = player === 'P1' ? 'Jogador 1' : 'Jogador 2';
  const pieceEmoji = player === 'P1' ? '🟢' : '🔴';

  // Vitória
  if (newState.winner) {
    if (newState.winningLine) {
      const [a, b, c] = newState.winningLine;
      return {
        text: `🏆 ${playerLabel} completa a linha ${a}-${b}-${c} e vence!`,
        type: 'win',
        emoji: '🏆',
      };
    }
    return {
      text: `🏆 ${playerLabel} vence!`,
      type: 'win',
      emoji: '🏆',
    };
  }

  // Empate
  if (newState.status === 'DRAW') {
    return {
      text: `🤝 Empate! A posição repetiu-se.`,
      type: 'info',
      emoji: '🤝',
    };
  }

  // Ameaça criada (o mover pode ganhar no próximo turno)
  const myWinningMoves = getWinningMoves(newState, player);
  if (myWinningMoves.length >= 2) {
    return {
      text: `⚡ ${playerLabel} cria uma ameaça dupla! O adversário só pode bloquear uma.`,
      type: 'threat',
      emoji: '⚡',
    };
  }
  if (myWinningMoves.length === 1) {
    return {
      text: `⚠️ ${playerLabel} ameaça vitória! O adversário tem de bloquear.`,
      type: 'threat',
      emoji: '⚠️',
    };
  }

  // Centro ocupado
  const movedToCenter = dest === 5;
  if (movedToCenter && prevState.board[4] === null) {
    return {
      text: `🎯 ${playerLabel} ocupa o centro — posição estratégica forte.`,
      type: 'good',
      emoji: '🎯',
    };
  }

  // Saiu da linha de casa (deixou a linha inicial)
  const homeLine = player === 'P1' ? [1, 2, 3] : [7, 8, 9];
  const wasInHomeLine = homeLine.includes(mover);
  const leftHomeLine = wasInHomeLine && !homeLine.includes(dest);
  if (leftHomeLine && moveNum === 1) {
    return {
      text: `🚀 ${playerLabel} sai da linha de casa à procura de estratégia.`,
      type: 'neutral',
      emoji: '🚀',
    };
  }

  // Voltou à linha de casa (mas sem vitória)
  const returnedHome = !homeLine.includes(mover) && homeLine.includes(dest);
  if (returnedHome) {
    return {
      text: `↩️ ${playerLabel} regressa à linha de casa.`,
      type: 'neutral',
      emoji: '↩️',
    };
  }

  // Ameaça do adversário bloqueada
  const prevOpponent = (player === 'P1' ? 'P2' : 'P1') as PlayerId;
  const prevThreats = getThreats(prevState, prevOpponent);
  if (prevThreats.length > 0) {
    const blockedThreat = prevThreats.some((t) => t.to === dest);
    if (blockedThreat) {
      return {
        text: `🛡️ ${playerLabel} bloqueia a ameaça do adversário!`,
        type: 'good',
        emoji: '🛡️',
      };
    }
  }

  // Jogada de abertura clássica (primeira jogada para o centro)
  if (moveNum === 1 && dest === 5) {
    return {
      text: `🎯 ${playerLabel} abre com o centro — jogada clássica e forte.`,
      type: 'good',
      emoji: '🎯',
    };
  }

  // Comentários neutros rotativos
  const neutralComments = [
    `${pieceEmoji} ${playerLabel} move de ${mover} para ${dest}.`,
    `${playerLabel} reorganiza as suas peças.`,
    `Jogada cautelosa de ${playerLabel}.`,
    `${playerLabel} ajusta a sua formação.`,
  ];
  return {
    text: neutralComments[moveNum % neutralComments.length],
    type: 'neutral',
  };
}

/**
 * Gera um comentário de abertura (antes da primeira jogada).
 */
export function commentOnStart(): Commentary {
  const intros = [
    { text: '🎯 Começa a partida! O Jogador 1 (verde) joga primeiro.', emoji: '🎯' },
    { text: '⚡ Partida a decorrer! Quem formará a primeira linha?', emoji: '⚡' },
    { text: '🦁 Que comecem os jogos! P1 tem a iniciativa.', emoji: '🦁' },
  ];
  return { ...intros[Math.floor(Math.random() * intros.length)], type: 'info' };
}
