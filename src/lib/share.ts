/**
 * Codec para partilha de partidas — códigos curtos codificados.
 *
 * Formato: uma string base36 compacta que codifica os movimentos.
 * Útil para partilhar uma partida via texto, QR code, etc.
 *
 * Estrutura do código:
 *   - Versão (1 char): '1'
 *   - Modo (1 char): P=pvp, V=pve, C=cvc
 *   - Dificuldade (1 char): F=fácil, M=médio, D=difícil, P=perfeito, _=n/a
 *   - Lado humano (1 char): 1=P1, 2=P2, _=n/a
 *   - Número de jogadas (2 chars base36)
 *   - Movimentos: cada movimento é 2 chars (from + to, base36 1-9 → 0-8)
 *
 * Exemplo: "1VM_02" → modo pve, médio, sem lado, 2 jogadas
 */

import type { Move } from '@/lib/engine';
import type { Difficulty } from '@/lib/ai';
import type { GameMode } from '@/store/game';

export interface SharedMatch {
  version: 1;
  mode: GameMode;
  difficulty?: Difficulty;
  humanSide?: 'P1' | 'P2';
  moves: Move[];
}

const VERSION = '1';
const MODE_CHARS: Record<GameMode, string> = { pvp: 'P', pve: 'V', cvc: 'C' };
const MODE_REV: Record<string, GameMode> = { P: 'pvp', V: 'pve', C: 'cvc' };
const DIFF_CHARS: Record<Difficulty, string> = { easy: 'F', medium: 'M', hard: 'D', perfect: 'P' };
const DIFF_REV: Record<string, Difficulty> = { F: 'easy', M: 'medium', D: 'hard', P: 'perfect' };

/** Codifica um número (0-1295) em base36 (2 chars). */
function enc2(n: number): string {
  return n.toString(36).padStart(2, '0').toUpperCase();
}

/** Descodifica 2 chars base36 para número. */
function dec2(s: string): number {
  return parseInt(s, 36);
}

/**
 * Codifica uma partida partilhada num código curto.
 */
export function encodeMatch(m: SharedMatch): string {
  let code = VERSION;
  code += MODE_CHARS[m.mode];
  code += m.difficulty ? DIFF_CHARS[m.difficulty] : '_';
  code += m.humanSide ? (m.humanSide === 'P1' ? '1' : '2') : '_';
  code += enc2(m.moves.length);
  for (const mv of m.moves) {
    // from e to são 1-9; converter para 0-8 e codificar como 1 char base36 cada
    code += (mv.from - 1).toString(36).toUpperCase();
    code += (mv.to - 1).toString(36).toUpperCase();
  }
  return code;
}

/**
 * Descodifica um código curto numa partida partilhada.
 * @returns null se o código for inválido.
 */
export function decodeMatch(code: string): SharedMatch | null {
  try {
    const clean = code.trim().toUpperCase().replace(/\s/g, '');
    if (clean.length < 6) return null;
    if (clean[0] !== VERSION) return null;
    const mode = MODE_REV[clean[1]];
    if (!mode) return null;
    const diffChar = clean[2];
    const difficulty = diffChar === '_' ? undefined : DIFF_REV[diffChar];
    const sideChar = clean[3];
    const humanSide = sideChar === '1' ? 'P1' : sideChar === '2' ? 'P2' : undefined;
    const moveCount = dec2(clean.slice(4, 6));
    if (clean.length < 6 + moveCount * 2) return null;
    const moves: Move[] = [];
    for (let i = 0; i < moveCount; i++) {
      const fromIdx = i * 2 + 6;
      const from = parseInt(clean[fromIdx], 36) + 1;
      const to = parseInt(clean[fromIdx + 1], 36) + 1;
      if (from < 1 || from > 9 || to < 1 || to > 9) return null;
      moves.push({ from: from as Move['from'], to: to as Move['to'] });
    }
    return { version: 1, mode, difficulty, humanSide, moves };
  } catch {
    return null;
  }
}

/**
 * Gera um resumo legível da partida partilhada.
 */
export function describeSharedMatch(m: SharedMatch): string {
  const modeLabel = m.mode === 'pvp' ? '2 Jogadores' : m.mode === 'pve' ? 'vs IA' : 'IA vs IA';
  const diffLabel = m.difficulty ? ` (${m.difficulty})` : '';
  return `${modeLabel}${diffLabel} • ${m.moves.length} jogadas`;
}
