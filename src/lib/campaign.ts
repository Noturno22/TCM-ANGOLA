/**
 * Modo Campanha — série de partidas progressivas com objetivos.
 * Cada nível tem um objetivo específico (vencer, vencer em N jogadas, etc.)
 * e uma configuração de IA definida.
 */

import type { Difficulty } from '@/lib/ai';
import type { PlayerId } from '@/lib/engine';

export interface CampaignLevel {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  humanSide: PlayerId;
  /** Objetivo: vencer a partida, opcionalmente em ≤ N jogadas, ou apenas sobreviver N jogadas */
  objective: {
    type: 'win' | 'win_fast' | 'survive';
    maxMoves?: number; // para win_fast
    minMoves?: number; // para survive (número mínimo de jogadas antes de poder declarar sucesso)
  };
  /** Recompensa em KZ */
  reward: number;
  /** Dica estratégica */
  hint: string;
}

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  {
    id: 1,
    title: 'Primeira Vitória',
    description: 'Vence a IA Fácil. Sem pressão de tempo.',
    difficulty: 'easy',
    humanSide: 'P1',
    objective: { type: 'win' },
    reward: 100,
    hint: 'Sai da linha de casa e volta para completar a linha 1-2-3.',
  },
  {
    id: 2,
    title: 'Velocidade',
    description: 'Vence a IA Fácil em 3 jogadas ou menos.',
    difficulty: 'easy',
    humanSide: 'P1',
    objective: { type: 'win_fast', maxMoves: 3 },
    reward: 200,
    hint: 'A jogada 1→5 é a chave. Depois, volta para a linha de casa.',
  },
  {
    id: 3,
    title: 'Lado Reverso',
    description: 'Vence a IA Fácil jogando com o vermelho (P2).',
    difficulty: 'easy',
    humanSide: 'P2',
    objective: { type: 'win' },
    reward: 250,
    hint: 'A IA joga primeiro. Observa a jogada dela e responde.',
  },
  {
    id: 4,
    title: 'Desafio Médio',
    description: 'Vence a IA Média.',
    difficulty: 'medium',
    humanSide: 'P1',
    objective: { type: 'win' },
    reward: 300,
    hint: 'A IA Média bloqueia ameaças. Cria jogadas duplas.',
  },
  {
    id: 5,
    title: 'Sobrevivente',
    description: 'Resiste 8 jogadas contra a IA Difícil sem perder.',
    difficulty: 'hard',
    humanSide: 'P1',
    objective: { type: 'survive', minMoves: 8 },
    reward: 400,
    hint: 'Bloqueia sempre. Não ataques, apenas defende.',
  },
  {
    id: 6,
    title: 'Velocidade Média',
    description: 'Vence a IA Média em 5 jogadas ou menos.',
    difficulty: 'medium',
    humanSide: 'P1',
    objective: { type: 'win_fast', maxMoves: 5 },
    reward: 500,
    hint: 'Usa o centro para criar ameaças rápidas.',
  },
  {
    id: 7,
    title: 'Mestre Tático',
    description: 'Vence a IA Difícil.',
    difficulty: 'hard',
    humanSide: 'P1',
    objective: { type: 'win' },
    reward: 700,
    hint: 'A IA Difícil usa Minimax. Precisas de jogar quase perfeitamente.',
  },
  {
    id: 8,
    title: 'Lendário',
    description: 'Vence a IA Perfeita. Quase impossível!',
    difficulty: 'perfect',
    humanSide: 'P1',
    objective: { type: 'win' },
    reward: 2000,
    hint: 'A IA Perfeita joga a solução ótima. Só podes vencer se ela cometer um erro (o que não acontece). Boa sorte!',
  },
];

export const TOTAL_CAMPAIGN_LEVELS = CAMPAIGN_LEVELS.length;

/**
 * Devolve o nível de campanha por ID (1-indexed).
 */
export function getCampaignLevel(id: number): CampaignLevel | null {
  return CAMPAIGN_LEVELS.find((l) => l.id === id) ?? null;
}
