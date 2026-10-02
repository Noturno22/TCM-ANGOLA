'use client';

import { motion } from 'framer-motion';
import { Trophy, Zap, X, ChevronRight, Swords, Bot, Users, Crown, Gamepad2, Target, Check, Share2, Eye, Flag } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/store/app';
import { useProfile, getSimulatedRankings, xpProgress } from '@/store/profile';
import { useChallenge } from '@/store/challenge';
import { getTodayPuzzle } from '@/lib/puzzles';
import { AdSlot } from '@/components/game/AdSlot';
import {
  GameButton,
  GameCard,
  LevelAvatar,
  XpBar,
  BalancePill,
  SectionTitle,
  GameLogo,
} from '@/components/game/ui';

export function HomeScreen() {
  const navigate = useApp((s) => s.navigate);
  const profile = useProfile();
  const [showTournamentBanner, setShowTournamentBanner] = useState(true);
  const xp = xpProgress(profile.xp, profile.level);

  const featuredRooms = [
    { name: 'Luanda', players: '32/50', stake: 100, emoji: '🏙️' },
    { name: 'Benguela', players: '18/40', stake: 50, emoji: '🌊' },
    { name: 'Huambo', players: '12/30', stake: 25, emoji: '⛰️' },
  ];

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Cabeçalho com logo + saldo */}
      <div className="flex items-center justify-between pt-1">
        <GameLogo size="sm" />
        <BalancePill coins={profile.coins} onClick={() => navigate('wallet')} />
      </div>

      {/* Cartão do utilizador */}
      <GameCard className="p-4" glow="gold">
        <div className="flex items-center gap-4">
          <LevelAvatar emoji="🦁" level={profile.level} size="md" online />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-semibold text-foreground truncate">Jogador</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-p1/15 text-p1 font-medium">
                Online
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Nível {profile.level} • Elo {profile.elo}
            </p>
            <XpBar xp={profile.xp} level={profile.level} />
          </div>
        </div>
      </GameCard>

      {/* Banner do torneio semanal */}
      {showTournamentBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-p2/30 via-gold/20 to-p1/20 border border-gold/40 p-4"
        >
          <button
            type="button"
            onClick={() => setShowTournamentBanner(false)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/40 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Fechar banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gold font-semibold">
                Torneio Semanal
              </p>
              <h3 className="font-display text-xl leading-tight">PRÉMIO: 50.000 KZ</h3>
              <p className="text-[11px] text-muted-foreground">Inscrições abertas • Eliminatória simples</p>
            </div>
            <GameButton
              variant="gold"
              size="sm"
              className="shrink-0"
              onClick={() => navigate('rooms')}
            >
              PARTICIPE AGORA
            </GameButton>
          </div>
        </motion.div>
      )}

      {/* Google Ads — banner topo */}
      <AdSlot format="banner-top" />

      {/* CTAs principais: JOGAR ONLINE / JOGAR OFFLINE */}
      <div className="grid grid-cols-1 gap-3">
        {/* Desafio Diário */}
        <DailyChallengeCard />
        <GameButton
          variant="p1"
          className="h-auto py-4 justify-start"
          onClick={() => navigate('rooms')}
        >
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-lg bg-background/20 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-left flex-1">
              <div className="font-display text-lg leading-none">JOGAR ONLINE</div>
              <div className="text-[11px] opacity-80 font-sans normal-case">
                Encontre jogadores em tempo real
              </div>
            </div>
            <ChevronRight className="w-5 h-5 opacity-70" />
          </div>
        </GameButton>

        <GameButton
          variant="orange"
          className="h-auto py-4 justify-start"
          onClick={() => navigate('offline-select')}
        >
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-lg bg-background/20 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="text-left flex-1">
              <div className="font-display text-lg leading-none">JOGAR OFFLINE</div>
              <div className="text-[11px] opacity-80 font-sans normal-case">
                Contra a IA ou com um amigo
              </div>
            </div>
            <ChevronRight className="w-5 h-5 opacity-70" />
          </div>
        </GameButton>
      </div>

      {/* Campanha */}
      <button
        type="button"
        onClick={() => navigate('campaign')}
        className="w-full text-left rounded-2xl overflow-hidden bg-gradient-to-r from-p2/20 via-gold/15 to-p2/20 border-2 border-p2/40 p-4 hover:border-p2/60 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-p2/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Flag className="w-6 h-6 text-p2" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase tracking-wider text-p2 font-semibold">
                Modo História
              </span>
            </div>
            <h3 className="font-display text-lg leading-tight">CAMPANHA</h3>
            <p className="text-[10px] text-muted-foreground">
              8 níveis progressivos com objetivos únicos • até 2000 KZ
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-p2/15 flex items-center justify-center group-hover:bg-p2/30 transition-colors">
            <ChevronRight className="w-4 h-4 text-p2" />
          </div>
        </div>
      </button>

      {/* Assistir IA vs IA */}
      <button
        type="button"
        onClick={() => navigate('watch')}
        className="w-full text-left rounded-2xl overflow-hidden bg-gradient-to-r from-surface/80 to-surface-2/40 border border-border/60 p-4 hover:border-gold/40 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Eye className="w-6 h-6 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase tracking-wider text-gold font-semibold">
                Modo Espetador
              </span>
            </div>
            <h3 className="font-display text-lg leading-tight">ASSISTIR IA vs IA</h3>
            <p className="text-[10px] text-muted-foreground">
              Observa duas IAs a competir com comentário ao vivo
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
            <ChevronRight className="w-4 h-4 text-gold" />
          </div>
        </div>
      </button>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-4 gap-2">
        <Shortcut icon={<Users className="w-5 h-5" />} label="Salas" onClick={() => navigate('rooms')} />
        <Shortcut icon={<Trophy className="w-5 h-5" />} label="Torneios" onClick={() => navigate('rooms')} />
        <Shortcut icon={<Zap className="w-5 h-5" />} label="Apostas" onClick={() => navigate('wallet')} />
        <Shortcut icon={<Share2 className="w-5 h-5" />} label="Partilhar" onClick={() => navigate('share')} />
      </div>

      {/* Jogos em destaque */}
      <div>
        <SectionTitle
          title="Jogos em Destaque"
          action={
            <button
              onClick={() => navigate('rooms')}
              className="text-[11px] text-gold hover:underline"
            >
              Ver todos
            </button>
          }
        />
        <div className="space-y-2">
          {featuredRooms.map((room) => (
            <GameCard key={room.name} className="p-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-p1/20 to-p2/20 flex items-center justify-center text-xl shrink-0">
                {room.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">Sala {room.name}</h4>
                  <span className="text-[10px] text-muted-foreground">{room.players}</span>
                </div>
                <p className="text-[11px] text-gold font-medium">Aposta: {room.stake} KZ</p>
              </div>
              <GameButton variant="p1" size="sm" onClick={() => navigate('rooms')}>
                Entrar
              </GameButton>
            </GameCard>
          ))}
        </div>
      </div>

      {/* Estatísticas rápidas */}
      <GameCard className="p-4">
        <SectionTitle title="As tuas estatísticas" />
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Vitórias" value={profile.wins} color="text-p1" />
          <Stat label="Derrotas" value={profile.losses} color="text-p2" />
          <Stat label="Empates" value={profile.draws} color="text-muted-foreground" />
        </div>
      </GameCard>

      {/* Botão de tutorial para novos */}
      {profile.totalMatches < 3 && (
        <GameButton variant="outline" className="w-full" onClick={() => navigate('tutorial')}>
          <Gamepad2 className="w-4 h-4 mr-2" />
          Aprender a jogar (Tutorial)
        </GameButton>
      )}
    </div>
  );
}

function Shortcut({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/60 border border-border/40 hover:border-gold/40 transition-colors min-h-[68px] justify-center"
    >
      <span className="text-gold">{icon}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`font-display text-2xl ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function DailyChallengeCard() {
  const navigate = useApp((s) => s.navigate);
  const isSolved = useChallenge((s) => s.isSolved);
  const puzzle = getTodayPuzzle();
  const solved = isSolved(puzzle.id);

  return (
    <button
      type="button"
      onClick={() => navigate('challenge')}
      className="w-full text-left rounded-2xl overflow-hidden bg-gradient-to-r from-gold/20 via-p1/15 to-gold/20 border-2 border-gold/40 p-4 hover:border-gold/60 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Target className="w-6 h-6 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] uppercase tracking-wider text-gold font-semibold">
              Desafio Diário
            </span>
            {solved && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-p1/20 text-p1 font-semibold uppercase flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                Resolvido
              </span>
            )}
          </div>
          <h3 className="font-display text-lg leading-tight">{puzzle.title}</h3>
          <p className="text-[10px] text-muted-foreground">
            {puzzle.difficulty} • +200 KZ • {solved ? 'Já resolvido' : 'Por resolver'}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center group-hover:bg-gold/30 transition-colors">
          <ChevronRight className="w-4 h-4 text-gold" />
        </div>
      </div>
    </button>
  );
}
