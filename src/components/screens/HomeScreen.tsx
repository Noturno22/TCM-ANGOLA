'use client';

import { motion } from 'framer-motion';
import {
  Trophy,
  Zap,
  X,
  ChevronRight,
  Bot,
  Users,
  Gamepad2,
  Target,
  Check,
  Share2,
  Eye,
  Flag,
  Building2,
  Waves,
  Mountain,
  ShoppingBag,
  UserPlus,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/store/app';
import { useProfile } from '@/store/profile';
import { useNotifications } from '@/store/notifications';
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

interface FeaturedRoom {
  name: string;
  players: string;
  stake: number;
  icon: LucideIcon;
}

export function HomeScreen() {
  const navigate = useApp((s) => s.navigate);
  const profile = useProfile();
  const unread = useNotifications((s) => s.unread);
  const [showTournamentBanner, setShowTournamentBanner] = useState(true);

  const featuredRooms: FeaturedRoom[] = [
    { name: 'Luanda', players: '32/50', stake: 100, icon: Building2 },
    { name: 'Benguela', players: '18/40', stake: 50, icon: Waves },
    { name: 'Huambo', players: '12/30', stake: 25, icon: Mountain },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Cabeçalho com logo + saldo */}
      <div className="flex items-center justify-between pt-1">
        <GameLogo size="sm" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('notifications')}
            className="relative w-11 h-11 rounded-full bg-surface-2 border border-border flex items-center justify-center text-foreground hover:bg-surface transition-colors"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-p2 text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-background">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <BalancePill coins={profile.coins} onClick={() => navigate('wallet')} />
        </div>
      </div>

      {/* Cartão do utilizador */}
      <GameCard className="p-4" glow="gold">
        <div className="flex items-center gap-4">
          <LevelAvatar name="Jogador" level={profile.level} size="md" online />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-foreground truncate">Jogador</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-p1/15 text-p1 font-medium">
                Online
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5">
              Nível {profile.level} · Elo {profile.elo}
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
          className="relative rounded-2xl overflow-hidden bg-surface border border-gold/30 p-4"
        >
          <button
            type="button"
            onClick={() => setShowTournamentBanner(false)}
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-background/60 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Fechar banner"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gold/12 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                Torneio Semanal
              </p>
              <h3 className="font-display text-2xl leading-none mt-1">PRÉMIO: 50.000 KZ</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Inscrições abertas • Eliminatória simples
              </p>
            </div>
          </div>
          <GameButton
            variant="primary"
            className="w-full h-10 mt-4 text-sm"
            onClick={() => navigate('rooms')}
          >
            Participar agora
          </GameButton>
        </motion.div>
      )}

      {/* Google Ads — banner topo */}
      <AdSlot format="banner-top" />

      {/* CTAs principais: JOGAR ONLINE / JOGAR OFFLINE */}
      <div className="grid grid-cols-2 gap-3">
        <GameButton
          variant="primary"
          className="h-auto flex-col items-start gap-3 p-4"
          onClick={() => navigate('rooms')}
        >
          <span className="w-10 h-10 rounded-xl bg-background/20 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </span>
          <span className="text-left">
            <span className="block font-display text-xl leading-none">JOGAR ONLINE</span>
            <span className="block text-xs opacity-90 font-sans mt-1">
              Jogadores em tempo real
            </span>
          </span>
        </GameButton>

        <GameButton
          variant="outline"
          className="h-auto flex-col items-start gap-3 p-4"
          onClick={() => navigate('offline-select')}
        >
          <span className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-gold">
            <Bot className="w-5 h-5" />
          </span>
          <span className="text-left">
            <span className="block font-display text-xl leading-none text-foreground">
              JOGAR OFFLINE
            </span>
            <span className="block text-xs text-muted-foreground font-sans mt-1">
              Contra a IA ou um amigo
            </span>
          </span>
        </GameButton>
      </div>

      {/* Desafio Diário */}
      <DailyChallengeCard />

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-5 gap-2">
        <Shortcut icon={Users} label="Salas" onClick={() => navigate('rooms')} />
        <Shortcut icon={UserPlus} label="Amigos" onClick={() => navigate('friends')} />
        <Shortcut icon={ShoppingBag} label="Loja" onClick={() => navigate('shop')} />
        <Shortcut icon={Zap} label="Apostas" onClick={() => navigate('wallet')} />
        <Shortcut icon={Share2} label="Partilhar" onClick={() => navigate('share')} />
      </div>

      {/* Modos secundários */}
      <div className="grid grid-cols-2 gap-3">
        <FeatureCard
          icon={Flag}
          eyebrow="Modo História"
          title="Campanha"
          description="8 níveis progressivos"
          onClick={() => navigate('campaign')}
        />
        <FeatureCard
          icon={Eye}
          eyebrow="Modo Espetador"
          title="Assistir IA vs IA"
          description="Competição com comentário"
          onClick={() => navigate('watch')}
        />
      </div>

      {/* Jogos em destaque */}
      <div>
        <SectionTitle
          title="Salas em destaque"
          action={
            <button
              onClick={() => navigate('rooms')}
              className="text-xs text-gold hover:underline"
            >
              Ver todas
            </button>
          }
        />
        <div className="space-y-2.5">
          {featuredRooms.map((room) => {
            const Icon = room.icon;
            return (
              <GameCard key={room.name} className="p-3.5 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-surface-2 flex items-center justify-center text-gold shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold truncate">Sala {room.name}</h4>
                    <span className="text-[11px] text-muted-foreground">{room.players}</span>
                  </div>
                  <p className="text-xs text-gold font-medium mt-0.5">Aposta: {room.stake} KZ</p>
                </div>
                <GameButton
                  variant="outline"
                  className="text-xs px-3.5 h-9"
            onClick={() => navigate('tournament')}
                >
                  Entrar
                </GameButton>
              </GameCard>
            );
          })}
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
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface border border-border hover:border-gold/40 transition-colors min-h-[76px] justify-center"
    >
      <Icon className="w-5 h-5 text-gold" />
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`font-display text-3xl leading-none ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl bg-surface border border-border p-4 hover:border-gold/40 transition-colors flex flex-col gap-3"
    >
      <span className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-gold">
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {eyebrow}
        </span>
        <span className="block font-display text-lg leading-tight mt-0.5">{title}</span>
        <span className="block text-xs text-muted-foreground mt-1">{description}</span>
      </span>
    </button>
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
      className="w-full text-left rounded-2xl bg-surface border border-gold/30 p-4 hover:border-gold/60 transition-colors group"
    >
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-gold/12 flex items-center justify-center shrink-0">
          <Target className="w-6 h-6 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
              Desafio Diário
            </span>
            {solved && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-p1/20 text-p1 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" />
                Resolvido
              </span>
            )}
          </div>
          <h3 className="font-display text-xl leading-tight">{puzzle.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {puzzle.difficulty} • +200 KZ • {solved ? 'Já resolvido' : 'Por resolver'}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gold group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}
