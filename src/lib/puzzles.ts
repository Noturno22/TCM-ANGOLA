/**
 * Desafios Diários — puzzles verificados com o motor (modo adjacent-only).
 * Cada puzzle tem uma posição onde P1 (o jogador) pode vencer.
 *
 * Movimento: apenas para casas adjacentes vazias (1 passo em qualquer direção).
 *
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
    title: 'Regresso ao Topo',
    difficulty: 'Fácil',
    // P1={1,2,5}, P2={4,6,7} → solução: 5→3 (linha 1-2-3)
    board: ['P1', 'P1', null, 'P2', 'P1', 'P2', 'P2', null, null],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 5 as Square, to: 3 as Square },
    description: 'Saíste da linha de casa e foste para o centro. Volta para completar a linha!',
    hint: 'Tens 1 e 2. A casa 3 está livre. A peça no centro (5) pode chegar lá — é adjacente.',
  },
  {
    id: 'p2',
    day: 1,
    title: 'Coluna Esquerda',
    difficulty: 'Médio',
    // P1={1,2,7}, P2={3,5,8} → solução: 2→4 (linha 1-4-7)
    board: ['P1', 'P1', 'P2', null, 'P2', null, 'P1', 'P2', null],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 2 as Square, to: 4 as Square },
    description: 'A coluna da esquerda (1-4-7) está quase tua. Ocupa a casa que falta!',
    hint: 'Tens 1 e 7. A casa 4 (meio-esquerda) está livre. Que peça a pode alcançar?',
  },
  {
    id: 'p3',
    day: 2,
    title: 'Coluna Central',
    difficulty: 'Médio',
    // P1={1,2,8}, P2={3,4,9} → solução: 1→5 (linha 2-5-8)
    board: ['P1', 'P1', 'P2', 'P2', null, null, null, 'P1', 'P2'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 1 as Square, to: 5 as Square },
    description: 'A coluna do meio (2-5-8) espera por ti. Move a peça certa!',
    hint: 'Tens 2 e 8. A casa 5 (centro) está livre. A peça na casa 1 pode alcançá-la — é diagonal.',
  },
  {
    id: 'p4',
    day: 3,
    title: 'Diagonal Dourada',
    difficulty: 'Difícil',
    // P1={1,2,9}, P2={3,4,8} → solução: 2→5 (linha 1-5-9)
    board: ['P1', 'P1', 'P2', 'P2', null, null, null, 'P2', 'P1'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 2 as Square, to: 5 as Square },
    description: 'A grande diagonal 1-5-9 está a um passo de ser tua!',
    hint: 'Tens 1 e 9. A casa 5 (centro) está livre. Que peça a pode alcançar?',
  },
  {
    id: 'p5',
    day: 4,
    title: 'Diagonal Inversa',
    difficulty: 'Difícil',
    // P1={1,3,7}, P2={2,4,9} → solução: 1→5 (linha 3-5-7)
    board: ['P1', 'P2', 'P1', 'P2', null, null, 'P1', null, 'P2'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 1 as Square, to: 5 as Square },
    description: 'A diagonal inversa 3-5-7 está quase completa. Fecha-a!',
    hint: 'Tens 3 e 7. A casa 5 (centro) está livre. A peça na casa 1 pode alcançá-la — é diagonal.',
  },
  {
    id: 'p6',
    day: 5,
    title: 'Linha do Meio',
    difficulty: 'Médio',
    // P1={1,4,6}, P2={2,3,9} → solução: 1→5 (linha 4-5-6)
    board: ['P1', 'P2', 'P2', 'P1', null, 'P1', null, null, 'P2'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 1 as Square, to: 5 as Square },
    description: 'A linha do meio (4-5-6) está quase tua. Move para o centro!',
    hint: 'Tens 4 e 6. A casa 5 (centro) está livre. A peça na casa 1 pode alcançá-la — é diagonal.',
  },
  {
    id: 'p7',
    day: 6,
    title: 'Coluna Direita',
    difficulty: 'Difícil',
    // P1={2,3,9}, P2={1,5,8} → solução: 2→6 (linha 3-6-9)
    board: ['P2', 'P1', 'P1', null, 'P2', null, null, 'P2', 'P1'],
    turn: 'P1',
    mateIn: 1,
    solution: { from: 2 as Square, to: 6 as Square },
    description: 'A coluna direita (3-6-9) está quase completa. Move a peça certa!',
    hint: 'Tens 3 e 9. A casa 6 (meio-direito) está livre. Que peça a pode alcançar? É adjacente.',
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
