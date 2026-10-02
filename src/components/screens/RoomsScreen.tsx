'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Coins, LogIn, MessageCircle, Send, Globe, Sparkles, Info, MapPin } from 'lucide-react';
import { useApp } from '@/store/app';
import { GameButton, GameCard, FilterChip, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { Globe3D } from '@/components/game/Globe3D';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'online' | 'bets' | 'friends';

interface Room {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  players: number;
  capacity: number;
  stake: number;
  featured?: boolean;
  tags: Filter[];
}

const ROOMS: Room[] = [
  {
    id: 'angola',
    name: 'Angola',
    emoji: '🇦🇴',
    gradient: 'from-p2/40 via-gold/30 to-p1/30',
    players: 47,
    capacity: 50,
    stake: 200,
    featured: true,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'luanda',
    name: 'Luanda',
    emoji: '🏙️',
    gradient: 'from-gold/30 to-orange/20',
    players: 32,
    capacity: 50,
    stake: 100,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'benguela',
    name: 'Benguela',
    emoji: '🌊',
    gradient: 'from-p1/30 to-gold/20',
    players: 18,
    capacity: 40,
    stake: 50,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'huambo',
    name: 'Huambo',
    emoji: '⛰️',
    gradient: 'from-orange/30 to-p2/20',
    players: 12,
    capacity: 30,
    stake: 25,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'cabinda',
    name: 'Cabinda',
    emoji: '🌴',
    gradient: 'from-p1/30 to-p2/20',
    players: 8,
    capacity: 20,
    stake: 10,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'global',
    name: 'Global (Free)',
    emoji: '🌍',
    gradient: 'from-surface-2 to-surface',
    players: 64,
    capacity: 100,
    stake: 0,
    tags: ['all', 'online'],
  },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'online', label: 'Online' },
  { id: 'bets', label: 'Apostas' },
  { id: 'friends', label: 'Amigos' },
];

const SAMPLE_PLAYERS = [
  { name: 'KwanzaMaster', emoji: '👑', level: 24 },
  { name: 'JJ_Manuel', emoji: '🦁', level: 21 },
  { name: 'Muxima', emoji: '🌟', level: 18 },
  { name: 'Benguela_Bull', emoji: '🐂', level: 16 },
];

const SAMPLE_CHAT = [
  { author: 'KwanzaMaster', text: 'Alguém para uma partida rápida?', me: false },
  { author: 'JJ_Manuel', text: 'Eu entro! Que apostas?', me: false },
  { author: 'Tu', text: 'Boa, vamos lá!', me: true },
  { author: 'Muxima', text: 'Sorte a todos 🍀', me: false },
];

export function RoomsScreen() {
  const navigate = useApp((s) => s.navigate);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const filteredRooms = useMemo(() => {
    if (filter === 'all') {
      // Em "Todas", a sala em destaque (Angola) é mostrada como cartão próprio;
      // o resto aparece na lista.
      return ROOMS.filter((r) => !r.featured);
    }
    if (filter === 'friends') {
      // Amigos: simulado — sem salas privadas por agora.
      return [];
    }
    return ROOMS.filter((r) => r.tags.includes(filter) && !r.featured);
  }, [filter]);

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-3xl tracking-wide">SALAS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encontra jogadores de todo o mundo no globo.
        </p>
      </div>

      {/* Globo 3D com jogadores online */}
      <GameCard className="p-4 flex flex-col items-center">
        <SectionTitle
          title="Jogadores Online"
          action={
            <span className="flex items-center gap-1 text-[10px] text-p1 font-semibold">
              <MapPin className="w-3 h-3" />
              Tempo real
            </span>
          }
        />
        <Globe3D
          onLocationClick={(loc) => {
            toast.info(`Desafio em ${loc.city}, ${loc.country}!`, {
              description: `${loc.players} jogadores disponíveis. Modo online em breve — joga offline por agora.`,
            });
          }}
        />
      </GameCard>

      {/* Aviso subtil */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-orange/10 border border-orange/30 text-orange">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">
          <strong>Modo online em breve.</strong> Por agora, joga offline contra a IA ou com amigos.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto scrollbar-custom -mx-1 px-1 pb-1">
        {FILTERS.map((f) => (
          <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {/* Sala em destaque (Angola) */}
      {filter === 'all' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GameCard className="overflow-hidden border-gold/40" glow="gold">
            <div className={cn('relative bg-gradient-to-br p-5', ROOMS[0].gradient)}>
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-gold text-background text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Destaque
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-background/30 backdrop-blur-sm flex items-center justify-center text-4xl shrink-0">
                  {ROOMS[0].emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Sala Oficial</p>
                  <h3 className="font-display text-2xl tracking-wide leading-none">ANGOLA</h3>
                  <p className="text-xs text-foreground/80 mt-1">
                    A grande sala nacional. Aposta mais alta.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-foreground/80">
                    <Users className="w-3.5 h-3.5" />
                    {ROOMS[0].players}/{ROOMS[0].capacity}
                  </span>
                  <span className="flex items-center gap-1 text-gold font-semibold">
                    <Coins className="w-3.5 h-3.5" />
                    {ROOMS[0].stake} KZ
                  </span>
                </div>
                <GameButton variant="gold" size="sm" onClick={() => setSelectedRoom(ROOMS[0])}>
                  <LogIn className="w-3.5 h-3.5 mr-1" />
                  Entrar
                </GameButton>
              </div>
            </div>
          </GameCard>
        </motion.div>
      )}

      {/* Lista de salas */}
      <div>
        <SectionTitle
          title={filter === 'friends' ? 'Salas de Amigos' : 'Todas as Salas'}
          action={
            <span className="text-[11px] text-muted-foreground">{filteredRooms.length} salas</span>
          }
        />
        {filteredRooms.length === 0 ? (
          <GameCard className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma sala encontrada neste filtro.
            </p>
          </GameCard>
        ) : (
          <div className="space-y-2">
            {filteredRooms.map((room) => (
              <RoomCard key={room.id} room={room} onEnter={() => setSelectedRoom(room)} />
            ))}
          </div>
        )}
      </div>

      {/* Sala Global */}
      {filter === 'all' && (
        <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
          Sala Global é gratuita e sem apostas. Ideal para practicar.
        </p>
      )}

      {/* Dialog de detalhes da sala */}
      <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden p-0">
          {selectedRoom && <RoomDialog room={selectedRoom} onPlay={() => navigate('offline-select')} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomCard({ room, onEnter }: { room: Room; onEnter: () => void }) {
  const pct = Math.round((room.players / room.capacity) * 100);
  return (
    <GameCard className="p-3 flex items-center gap-3">
      {/* Imagem placeholder */}
      <div
        className={cn(
          'relative w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl shrink-0 overflow-hidden',
          room.gradient,
        )}
      >
        {room.emoji}
        {room.players >= room.capacity * 0.9 && (
          <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded-full bg-p2 text-white text-[8px] font-bold">
            CHEIA
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm truncate">{room.name}</h4>
          {room.stake === 0 && (
            <span className="px-1.5 py-0.5 rounded bg-p1/15 text-p1 text-[9px] font-bold uppercase">
              Free
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {room.players}/{room.capacity}
          </span>
          <span className="flex items-center gap-1 text-gold font-semibold">
            <Coins className="w-3 h-3" />
            {room.stake === 0 ? 'Sem aposta' : `${room.stake} KZ`}
          </span>
        </div>
        {/* Mini barra de ocupação */}
        <div className="h-1 rounded-full bg-surface-2 mt-1.5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              pct > 90 ? 'bg-p2' : pct > 60 ? 'bg-gold' : 'bg-p1',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <GameButton
        variant="p1"
        size="sm"
        onClick={onEnter}
        disabled={room.players >= room.capacity}
        aria-label={`Entrar na sala ${room.name}`}
      >
        <LogIn className="w-3.5 h-3.5 mr-1" />
        Entrar
      </GameButton>
    </GameCard>
  );
}

function RoomDialog({ room, onPlay }: { room: Room; onPlay: () => void }) {
  return (
    <>
      {/* Header com gradiente */}
      <div className={cn('relative bg-gradient-to-br p-5', room.gradient)}>
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-background/30 backdrop-blur-sm flex items-center justify-center text-3xl shrink-0">
              {room.emoji}
            </div>
            <div>
              <DialogTitle className="font-display text-2xl tracking-wide">{room.name}</DialogTitle>
              <DialogDescription className="text-xs">
                Sala {room.stake === 0 ? 'gratuita' : `com aposta de ${room.stake} KZ`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1 text-foreground/80">
            <Users className="w-3.5 h-3.5" />
            {room.players}/{room.capacity} jogadores
          </span>
          {room.stake > 0 && (
            <span className="flex items-center gap-1 text-gold font-semibold">
              <Coins className="w-3.5 h-3.5" />
              {room.stake} KZ
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo: jogadores online + chat */}
      <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[50vh]">
        {/* Jogadores online */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
            Jogadores online ({SAMPLE_PLAYERS.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_PLAYERS.map((p) => (
              <div key={p.name} className="flex items-center gap-2 p-2 rounded-lg bg-surface/60 border border-border/40">
                <LevelAvatar emoji={p.emoji} level={p.level} size="sm" online />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{p.name}</p>
                  <p className="text-[9px] text-p1">● Online</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat simulado */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3" />
            Chat da sala
          </p>
          <ScrollArea className="h-32 rounded-lg bg-surface/60 border border-border/40 p-3">
            <div className="space-y-2">
              {SAMPLE_CHAT.map((msg, i) => (
                <div
                  key={i}
                  className={cn('flex flex-col', msg.me ? 'items-end' : 'items-start')}
                >
                  <span className="text-[9px] text-muted-foreground mb-0.5">{msg.author}</span>
                  <div
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-xs max-w-[80%]',
                      msg.me
                        ? 'bg-p1 text-background'
                        : 'bg-surface-2 text-foreground',
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-1.5 mt-2">
            <input
              type="text"
              placeholder="Mensagem…"
              disabled
              className="flex-1 h-9 rounded-lg bg-surface/60 border border-border/40 px-3 text-xs text-muted-foreground placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              disabled
              className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-muted-foreground"
              aria-label="Enviar mensagem (indisponível)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <DialogFooter className="px-5 pb-5 pt-2 gap-2">
        <p className="text-[10px] text-muted-foreground/70 text-center w-full flex items-center justify-center gap-1.5">
          <Globe className="w-3 h-3" />
          Modo online em breve — redirecionado para o modo offline.
        </p>
        <GameButton variant="p1" className="w-full h-11" onClick={onPlay}>
          <LogIn className="w-4 h-4 mr-2" />
          Jogar
        </GameButton>
      </DialogFooter>
    </>
  );
}
