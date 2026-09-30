'use client';

import { motion } from 'framer-motion';
import {
  Target,
  Grid3x3,
  ArrowRightLeft,
  Move3d,
  SquareStack,
  Crown,
  Shield,
  AlertTriangle,
  Handshake,
  ListChecks,
  Play,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { WINNING_LINES } from '@/lib/engine';
import { cn } from '@/lib/utils';

interface Section {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  color?: 'p1' | 'p2' | 'gold' | 'orange';
}

const SECTIONS: Section[] = [
  {
    icon: <Target className="w-5 h-5" />,
    title: 'Objetivo',
    color: 'gold',
    body: (
      <p>
        Ser o primeiro a alinhar as <strong className="text-foreground">3 peças da tua cor</strong> numa
        das 8 linhas vencedoras (3 horizontais, 3 verticais, 2 diagonais).
      </p>
    ),
  },
  {
    icon: <Grid3x3 className="w-5 h-5" />,
    title: 'Tabuleiro',
    color: 'p1',
    body: (
      <div className="space-y-2">
        <p>Tabuleiro <strong className="text-foreground">3x3</strong> com 9 casas numeradas de 1 a 9.</p>
        <NumberedBoard />
      </div>
    ),
  },
  {
    icon: <SquareStack className="w-5 h-5" />,
    title: 'Posição Inicial',
    color: 'p1',
    body: (
      <ul className="space-y-1.5">
        <li>• <span className="text-p1 font-semibold">Jogador 1 (verde ▲)</span> — casas 1, 2, 3 (topo)</li>
        <li>• <span className="text-p2 font-semibold">Jogador 2 (vermelho ●)</span> — casas 7, 8, 9 (base)</li>
        <li>• Casas 4, 5, 6 começam vazias</li>
      </ul>
    ),
  },
  {
    icon: <ArrowRightLeft className="w-5 h-5" />,
    title: 'Turnos',
    color: 'p1',
    body: (
      <p>
        O <strong className="text-p1">Jogador 1 começa sempre</strong>. Os jogadores alternam turnos,
        movendo uma peça por turno.
      </p>
    ),
  },
  {
    icon: <Move3d className="w-5 h-5" />,
    title: 'Movimento',
    color: 'gold',
    body: (
      <ul className="space-y-1.5">
        <li>• Escolhe uma peça tua e move-a para uma casa <strong className="text-foreground">vazia</strong>.</li>
        <li>• Podes mover em qualquer direção (linha, coluna ou diagonal).</li>
        <li>• Cada peça move-se <strong className="text-foreground">uma casa de cada vez</strong> ao longo de uma reta.</li>
      </ul>
    ),
  },
  {
    icon: <SquareStack className="w-5 h-5" />,
    title: 'Regras de Ocupação',
    color: 'orange',
    body: (
      <ul className="space-y-1.5">
        <li>• Cada casa pode conter no máximo <strong className="text-foreground">uma peça</strong>.</li>
        <li>• Não podes ocupar uma casa já ocupada (nem tua nem do adversário).</li>
        <li>• Cada jogador mantém sempre <strong className="text-foreground">3 peças</strong> em jogo.</li>
      </ul>
    ),
  },
  {
    icon: <Crown className="w-5 h-5" />,
    title: 'Vitória — 8 linhas vencedoras',
    color: 'gold',
    body: (
      <div className="space-y-2">
        <p>Vences quando as tuas 3 peças formam uma destas 8 linhas:</p>
        <WinningLinesGrid />
      </div>
    ),
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Bloqueio',
    color: 'p2',
    body: (
      <p>
        Se o adversário tiver <strong className="text-foreground">duas peças alinhadas</strong> com a
        terceira casa livre, ele tem uma <strong className="text-p2">ameaça</strong>. Tens de bloquear
        a casa que falta, ou ele vence no próximo turno.
      </p>
    ),
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    title: 'Ameaças Múltiplas',
    color: 'p2',
    body: (
      <p>
        Se o adversário criar <strong className="text-p2">duas ameaças simultâneas</strong> (uma
        "forquilha"), só podes bloquear uma. A derrota é praticamente inevitável — evita chegar a
        esta situação.
      </p>
    ),
  },
  {
    icon: <Handshake className="w-5 h-5" />,
    title: 'Empate',
    color: 'orange',
    body: (
      <p>
        O jogo empata se a <strong className="text-foreground">mesma posição se repetir 3 vezes</strong>{' '}
        (com o mesmo jogador a jogar). Isto evita ciclos infinitos.
      </p>
    ),
  },
  {
    icon: <ListChecks className="w-5 h-5" />,
    title: 'Estados do Jogo',
    color: 'p1',
    body: (
      <div className="space-y-1.5 text-xs">
        <div className="flex gap-2"><code className="text-gold">READY</code> — Pronto para começar</div>
        <div className="flex gap-2"><code className="text-p1">PLAYER_1_TURN</code> — Vez do Jogador 1</div>
        <div className="flex gap-2"><code className="text-p2">PLAYER_2_TURN</code> — Vez do Jogador 2</div>
        <div className="flex gap-2"><code className="text-gold">WIN_P1</code> — Vitória do Jogador 1</div>
        <div className="flex gap-2"><code className="text-gold">WIN_P2</code> — Vitória do Jogador 2</div>
        <div className="flex gap-2"><code className="text-muted-foreground">DRAW</code> — Empate por repetição</div>
      </div>
    ),
  },
];

export function HowToPlayScreen() {
  const navigate = useApp((s) => s.navigate);

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-3xl tracking-wide">COMO JOGAR</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Regras completas do Tira o Cocó do Meio.
        </p>
      </div>

      {/* Secções */}
      <div className="space-y-3">
        {SECTIONS.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <GameCard className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    section.color === 'p1' && 'bg-p1/15 text-p1',
                    section.color === 'p2' && 'bg-p2/15 text-p2',
                    section.color === 'gold' && 'bg-gold/15 text-gold',
                    section.color === 'orange' && 'bg-orange/15 text-orange',
                    !section.color && 'bg-surface-2 text-foreground',
                  )}
                >
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg tracking-wide mb-1.5">{section.title}</h3>
                  <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    {section.body}
                  </div>
                </div>
              </div>
            </GameCard>
          </motion.div>
        ))}
      </div>

      {/* Tabela resumo */}
      <GameCard className="p-4">
        <SectionTitle title="Tabela Resumo" />
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-border/40">
                <th className="py-2 pr-3 font-semibold text-foreground">Regra</th>
                <th className="py-2 px-3 font-semibold text-foreground">Valor</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <Row k="Tabuleiro" v="3×3 (9 casas)" />
              <Row k="Peças por jogador" v="3" />
              <Row k="Jogador inicial" v="P1 (verde)" />
              <Row k="Movimento" v="Livre, sem saltar" />
              <Row k="Linhas vencedoras" v="8" />
              <Row k="Empate" v="3ª repetição" />
              <Row k="Duração média" v="2-5 min" />
            </tbody>
          </table>
        </div>
      </GameCard>

      {/* Botão final */}
      <GameButton
        variant="p1"
        className="w-full h-12"
        onClick={() => navigate('offline-select')}
        aria-label="Jogar agora"
      >
        <Play className="w-4 h-4 mr-2" />
        Jogar agora
      </GameButton>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-border/20 last:border-0">
      <td className="py-2 pr-3">{k}</td>
      <td className="py-2 px-3 text-foreground font-medium">{v}</td>
    </tr>
  );
}

/** Mini-tabuleiro numerado 1-9. */
function NumberedBoard() {
  return (
    <div className="grid grid-cols-3 gap-1 max-w-[200px] mx-auto p-2 rounded-xl bg-surface/60 border border-border/40">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className={cn(
            'aspect-square rounded-md flex items-center justify-center font-display text-lg',
            n === 5
              ? 'bg-gold/15 text-gold border border-gold/40'
              : 'bg-surface-2 text-muted-foreground border border-border/30',
          )}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

/** Diagrama das 8 linhas vencedoras (8 mini-tabuleiros 3x3 com a linha destacada). */
function WinningLinesGrid() {
  return (
    <div className="grid grid-cols-4 gap-2 mt-2">
      {WINNING_LINES.map((line, idx) => (
        <div
          key={idx}
          className="aspect-square rounded-md bg-surface/60 border border-border/40 p-1.5 grid grid-cols-3 grid-rows-3 gap-0.5"
          aria-label={`Linha ${idx + 1}: casas ${line.join(', ')}`}
        >
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
            const inLine = (line as readonly number[]).includes(n);
            return (
              <div
                key={n}
                className={cn(
                  'rounded-sm',
                  inLine ? 'bg-gold' : 'bg-surface-2/60',
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
