'use client';

import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Info, Heart, MapPin, Tag, Hash } from 'lucide-react';
import { useApp } from '@/store/app';
import { GameButton, GameCard, GameLogo, SectionTitle } from '@/components/game/ui';

export function AboutScreen() {
  const navigate = useApp((s) => s.navigate);

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center pt-2"
      >
        <GameLogo size="md" />
        <h1 className="font-display text-3xl tracking-wider mt-3 leading-none">
          TIRA O COCÓ DO MEIO
        </h1>
        <p className="text-gold font-display text-lg tracking-wide mt-1 text-glow-gold">
          Simples de começar, difícil de dominar
        </p>
      </motion.div>

      {/* Cartão de identidade */}
      <GameCard className="p-5" glow="gold">
        <SectionTitle title="Identidade" />
        <div className="space-y-3">
          <InfoRow icon={<Tag className="w-4 h-4" />} label="Nome" value="Tira o Cocó do Meio" />
          <InfoRow
            icon={<BookOpen className="w-4 h-4" />}
            label="Categoria"
            value="Jogo de estratégia · Tabuleiro"
          />
          <InfoRow
            icon={<MapPin className="w-4 h-4" />}
            label="Origem"
            value="Angola"
            highlight="gold"
          />
          <InfoRow
            icon={<Hash className="w-4 h-4" />}
            label="Versão"
            value="1.0"
          />
        </div>
      </GameCard>

      {/* Sobre o jogo */}
      <GameCard className="p-5">
        <SectionTitle title="Sobre o Jogo" />
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Tira o Cocó do Meio</strong> é um clássico jogo de
            estratégia para 2 jogadores, enraizado na tradição angolana. Cada jogador comanda três
            peças num tabuleiro 3x3 e tenta ser o primeiro a formar uma linha de três.
          </p>
          <p>
            Com regras simples mas profundidade estratégica, o jogo pertence à mesma família dos
            jogos de alinhamento africanos — onde cada jogada conta e um pequeno erro pode decidir
            a partida.
          </p>
        </div>
      </GameCard>

      {/* Identidade cultural angolana */}
      <GameCard className="p-5">
        <SectionTitle title="Identidade Angolana" />
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Este jogo é uma <strong className="text-foreground">homenagem contemporânea</strong> à
            cultura angolana. A paleta de cores — verdes, vermelhos e dourados — evoca a bandeira
            nacional e os tecidos tradicionais, sem cair em estereótipos.
          </p>
          <p>
            Os padrões geométricos que decoram a interface inspiram-se na arte visual angolana
            contemporânea: linhas limpas, simetria e contrastes fortes. O objetivo é celebrar uma
            Angola <strong className="text-foreground">moderna, urbana e digital</strong>, nem
            rural-arcaica nem exotizada.
          </p>
          <p>
            Tira o Cocó do Meio é um convite a conhecer um pedaço do património lúdico angolano —
            de forma leve, competitiva e orgulhosa.
          </p>
        </div>
      </GameCard>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <GameButton
          variant="outline"
          className="h-12"
          onClick={() => navigate('how-to-play')}
          aria-label="Abrir como jogar"
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Como Jogar
        </GameButton>
        <GameButton
          variant="p1"
          className="h-12"
          onClick={() => navigate('tutorial')}
          aria-label="Abrir tutorial"
        >
          <GraduationCap className="w-4 h-4 mr-2" />
          Tutorial
        </GameButton>
      </div>

      {/* Créditos */}
      <div className="text-center pt-4 pb-2 space-y-1.5">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Heart className="w-3.5 h-3.5 text-p2" />
          <span>
            Inspirado na cultura angolana.{' '}
            <span className="text-foreground font-medium">Feito com orgulho.</span>
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-widest">
          <Info className="w-3 h-3" />
          <span>Moeda virtual · Sem dinheiro real</span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: 'gold' | 'p1' | 'p2';
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <span
          className={
            highlight === 'gold'
              ? 'text-gold font-display text-base tracking-wide'
              : 'text-foreground font-medium text-sm'
          }
        >
          {value}
        </span>
      </div>
    </div>
  );
}
