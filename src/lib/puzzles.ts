/**
 * Desafios Diários — puzzles verificados com o motor.
 * Cada puzzle tem uma posição onde P1 (o jogador) pode vencer em 1 jogada,
 * com uma SOLUÇÃO ÚNICA, e onde P2 não tem ameaça imediata (justo).
 *
 * Posições geradas e verificadas programaticamente com getWinningMoves.
 * Os puzzles rodam por dia da semana (7 puzzles).
 */

import type { Cell, Square } from '@/lib/engine';

export interface Puzzle {
  id: string;
  day: number; // 0-6 (dia da semana, 0 = domingo)
  title: string;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  /** Tabuleiro: length 9, index = casa-1. null = vazio. */
  board: Cell[];
  /** Jogador que joga (sempre P1 nos puzzles). */
  turn: 'P1';
  /** Número de jogadas para vencer. */
  mateIn: number;
  /** Movimento vencedor (solução única). */
  solution: { from: Square; to: Square };
  description: string;
  hint: string;
}

export const PUZZLES: Puzzle[] = [
  {
    id: 'p1',
    day: 0,
    title: 'Primeiro Passo',
    difficulty: 'Fácil',
    // P1={1,2,4}, P2={7,8,9} → solução única: 4→3 (linha 1-2-3)
    board: ['P1', 'P1', null, 'P1', null, null, 'P2', 'P2', 'P2'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 4 as Square, to: 3 as Square },
    description: 'Tens duas peças na linha de cima. Completa-a!',
    hint: 'A casa 3 está vazia. Que peça a pode alcançar sem saltar?',
  },
  {
    id: 'p2',
    day: 1,
    title: 'Regresso ao Topo',
    difficulty: 'Médio',
    // P1={1,2,5}, P2={7,8,9} → solução única: 5→3 (linha 1-2-3 via centro)
    board: ['P1', 'P1', null, null, 'P1', null, 'P2', 'P2', 'P2'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 5 as Square, to: 3 as Square },
    description: 'Saíste da linha de casa e foste para o centro. Volta para completar a linha!',
    hint: 'Tens 1 e 2. A casa 3 está livre. A peça do centro (5) pode chegar lá.',
  },
  {
    id: 'p3',
    day: 2,
    title: 'Pelo Centro',
    difficulty: 'Médio',
    // P1={1,2,8}, P2={3,6,9} → solução única: 1→5 (depois P1={2,5,8} coluna 2-5-8)
    board: ['P1', 'P1', 'P2', null, null, 'P2', null, 'P1', 'P2'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 1 as Square, to: 5 as Square },
    description: 'A coluna do meio (2-5-8) está quase tua!',
    hint: 'Tens 2 e 8. Falta a casa 5 (centro). Que peça chega lá?',
  },
  {
    id: 'p4',
    day: 3,
    title: 'Diagonal Dourada',
    difficulty: 'Difícil',
    // P1={1,2,5}, P2={3,4,8} → solução única: 2→9 (depois P1={1,5,9} diagonal 1-5-9)
    board: ['P1', 'P1', 'P2', 'P2', 'P1', null, null, 'P2', null],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 2 as Square, to: 9 as Square },
    description: 'A grande diagonal 1-5-9 está a um passo de ser tua!',
    hint: 'Tens 1 e 5 (centro). A casa 9 (canto inferior direito) está livre.',
  },
  {
    id: 'p5',
    day: 4,
    title: 'Coluna Esquerda',
    difficulty: 'Médio',
    // P1={1,2,7}, P2={3,5,8} → solução única: 2→4 (depois P1={1,4,7} coluna 1-4-7)
    board: ['P1', 'P1', 'P2', null, 'P2', null, 'P1', 'P2', null],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 2 as Square, to: 4 as Square },
    description: 'A coluna da esquerda (1-4-7) espera por ti!',
    hint: 'Tens 1 e 7. A casa 4 (meio-esquerda) está livre.',
  },
  {
    id: 'p6',
    day: 5,
    title: 'O Flanco Direito',
    difficulty: 'Difícil',
    // P1={1,2,7}, P2={4,8,9} → solução única: 7→3 (depois P1={1,2,3} linha 1-2-3)
    board: ['P1', 'P1', null, 'P2', null, null, 'P1', 'P2', 'P2'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 7 as Square, to: 3 as Square },
    description: 'A linha de cima (1-2-3) está quase completa. Mas a peça certa está longe!',
    hint: 'Tens 1 e 2. Falta a casa 3. A peça na casa 7 (canto inferior esquerdo) pode chegar lá?',
  },
  {
    id: 'p7',
    day: 6,
    title: 'Xeque-Mate Angolano',
    difficulty: 'Difícil',
    // P1={1,2,6}, P2={4,5,8} → solução única: 6→3 (depois P1={1,2,3} linha 1-2-3)
    board: ['P1', 'P1', null, 'P2', 'P2', 'P1', null, 'P2', null],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 6 as Square, to: 3 as Square },
    description: 'O adversário domina o centro. Completa a tua linha de casa!',
    hint: 'Tens 1 e 2. Falta a casa 3. A peça na casa 6 (meio-direito) pode alcançá-la.',
  },
];

/**
 * Devolve o puzzle do dia (baseado na data atual).
 */
export function getTodayPuzzle(): Puzzle {
  const day = new Date().getDay();
  return PUZZLES[day] ?? PUZZLES[0];
}

/**
 * Devolve o puzzle por índice (para modo "treinar").
 */
export function getPuzzleByIndex(i: number): Puzzle {
  return PUZZLES[i % PUZZLES.length];
}

export const TOTAL_PUZZLES = PUZZLES.length;
