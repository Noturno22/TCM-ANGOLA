'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Coins,
  LogIn,
  MessageCircle,
  Send,
  Globe,
  Sparkles,
  Info,
  MapPin,
  Wifi,
  Loader2,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useOnline } from '@/store/online';
import { useAuth } from '@/store/auth';
import { useMatch } from '@/store/match';
import { useProfile } from '@/store/profile';
import { useAge } from '@/store/age';
import { GameButton, GameCard, FilterChip, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { RoomIcon } from '@/components/game/icons';
import { Globe3D } from '@/components/game/Globe3D';
import { AdSlot } from '@/components/game/AdSlot';
import { AgeGateDialog } from '@/components/game/AgeGateDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'online' | 'bets' | 'friends';

interface Room {
  id: string;
  name: string;
  region: 'national' | 'international';
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
    region: 'national',
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
    region: 'national',
    gradient: 'from-gold/30 to-orange/20',
    players: 32,
    capacity: 50,
    stake: 100,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'benguela',
    name: 'Benguela',
    region: 'national',
    gradient: 'from-p1/30 to-gold/20',
    players: 18,
    capacity: 40,
    stake: 50,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'huambo',
    name: 'Huambo',
    region: 'national',
    gradient: 'from-orange/30 to-p2/20',
    players: 12,
    capacity: 30,
    stake: 25,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'cabinda',
    name: 'Cabinda',
    region: 'national',
    gradient: 'from-p1/30 to-p2/20',
    players: 8,
    capacity: 20,
    stake: 10,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'global',
    name: 'Global (Free)',
    region: 'international',
    gradient: 'from-surface-2 to-surface',
    players: 64,
    capacity: 100,
    stake: 0,
    tags: ['all', 'online'],
  },
  {
    id: 'portugal',
    name: 'Portugal',
    region: 'international',
    gradient: 'from-p1/30 to-p2/20',
    players: 24,
    capacity: 50,
    stake: 100,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'brasil',
    name: 'Brasil',
    region: 'international',
    gradient: 'from-p1/30 to-gold/20',
    players: 38,
    capacity: 60,
    stake: 100,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'mocambique',
    name: 'Moçambique',
    region: 'international',
    gradient: 'from-p2/30 to-gold/20',
    players: 21,
    capacity: 40,
    stake: 50,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'caboverde',
    name: 'Cabo Verde',
    region: 'international',
    gradient: 'from-orange/30 to-p1/20',
    players: 9,
    capacity: 30,
    stake: 50,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'africa',
    name: 'África Lusófona',
    region: 'international',
    gradient: 'from-gold/30 to-p1/20',
    players: 41,
    capacity: 80,
    stake: 50,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'europa',
    name: 'Europa',
    region: 'international',
    gradient: 'from-p2/30 to-gold/20',
    players: 58,
    capacity: 80,
    stake: 100,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'america',
    name: 'América',
    region: 'international',
    gradient: 'from-p1/30 to-p2/20',
    players: 37,
    capacity: 80,
    stake: 100,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'mundo',
    name: 'Mundo',
    region: 'international',
    gradient: 'from-surface-2 to-surface',
    players: 72,
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
  { name: 'KwanzaMaster', level: 24 },
  { name: 'JJ_Manuel', level: 21 },
  { name: 'Muxima', level: 18 },
  { name: 'Benguela_Bull', level: 16 },
];

const SAMPLE_CHAT = [
  { author: 'KwanzaMaster', text: 'Alguém para uma partida rápida?', me: false },
  { author: 'JJ_Manuel', text: 'Eu entro! Que apostas?', me: false },
  { author: 'Tu', text: 'Boa, vamos lá!', me: true },
  { author: 'Muxima', text: 'Sorte a todos', me: false },
];

export function RoomsScreen() {
  const navigate = useApp((s) => s.navigate);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [ageRoom, setAgeRoom] = useState<Room | null>(null);

  const onlineEnabled = useOnline((s) => s.enabled);
  const onlineRooms = useOnline((s) => s.rooms);
  const loadRooms = useOnline((s) => s.loadRooms);
  const enterRoom = useOnline((s) => s.enterRoom);
  const leaveRoom = useOnline((s) => s.leaveRoom);
  const isAuthed = useAuth((s) => Boolean(s.user));
  const joinQueue = useMatch((s) => s.joinQueue);
  const coins = useProfile((s) => s.coins);
  const isAdult = useAge((s) => s.isAdult);
  const loadAge = useAge((s) => s.load);

  // Entra na fila da sala (verificando saldo; a idade já foi validada antes).
  const proceedPlay = (room: Room) => {
    if (room.stake > 0 && coins < room.stake) {
      toast.error('Moedas insuficientes', {
        description: `Precisas de ${room.stake} KZ virtuais para entrar nesta sala.`,
      });
      navigate('wallet');
      return;
    }
    void joinQueue(room.id, room.stake);
    navigate('match');
  };

  // Inicia matchmaking online (quando configurado + sessão); senão, offline.
  const handlePlay = (room: Room) => {
    if (onlineEnabled && isAuthed) {
      // Salas com aposta exigem 18+ (gate também validado no servidor).
      if (room.stake > 0 && !isAdult) {
        setSelectedRoom(null);
        setAgeRoom(room);
        return;
      }
      proceedPlay(room);
    } else {
      navigate('offline-select');
    }
  };

  // Carrega o catálogo real de salas (se o backend estiver configurado).
  useEffect(() => {
    if (onlineEnabled) void loadRooms();
  }, [onlineEnabled, loadRooms]);

  // Consulta o gate 18+ (para salas com aposta).
  useEffect(() => {
    if (onlineEnabled && isAuthed) void loadAge();
  }, [onlineEnabled, isAuthed, loadAge]);

  // Entra/sai da sala para subscrever presença e chat em tempo real.
  useEffect(() => {
    if (selectedRoom) void enterRoom(selectedRoom.id);
    else leaveRoom();
  }, [selectedRoom, enterRoom, leaveRoom]);

  // Limpa subscrições ao sair do ecrã.
  useEffect(() => () => leaveRoom(), [leaveRoom]);

  // Funde o catálogo real (capacidade/aposta/região) com a apresentação local.
  const rooms = useMemo<Room[]>(() => {
    if (onlineRooms.length === 0) return ROOMS;
    const merged = ROOMS.map((r) => {
      const o = onlineRooms.find((x) => x.id === r.id);
      return o ? { ...r, capacity: o.capacity, stake: o.stake, region: o.region } : r;
    });
    // Salas presentes no servidor mas ainda não conhecidas localmente.
    const known = new Set(ROOMS.map((r) => r.id));
    for (const o of onlineRooms) {
      if (known.has(o.id)) continue;
      const tags: Filter[] = o.stake > 0 ? ['all', 'online', 'bets'] : ['all', 'online'];
      merged.push({
        id: o.id,
        name: o.name,
        region: o.region,
        gradient: 'from-surface-2 to-surface',
        players: 0,
        capacity: o.capacity,
        stake: o.stake,
        featured: o.isFeatured,
        tags,
      });
    }
    return merged;
  }, [onlineRooms]);

  const featured = rooms.find((r) => r.featured) ?? ROOMS[0];

  const filteredRooms = useMemo(() => {
    if (filter === 'all') {
      // Em "Todas", a sala em destaque (Angola) é mostrada como cartão próprio;
      // o resto aparece na lista.
      return rooms.filter((r) => !r.featured);
    }
    if (filter === 'friends') {
      // Amigos: simulado — sem salas privadas por agora.
      return [];
    }
    return rooms.filter((r) => r.tags.includes(filter) && !r.featured);
  }, [filter, rooms]);

  const nationalRooms = filteredRooms.filter((r) => r.region === 'national');
  const internationalRooms = filteredRooms.filter((r) => r.region === 'international');

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

      {/* Google Ads — banner inline */}
      <AdSlot format="banner-inline" />

      {/* Aviso subtil */}
      <div
        className={cn(
          'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-xs leading-relaxed',
          onlineEnabled
            ? 'bg-p1/10 border-p1/30 text-p1'
            : 'bg-orange/10 border-orange/30 text-orange',
        )}
      >
        {onlineEnabled ? <Wifi className="w-4 h-4 shrink-0 mt-0.5" /> : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
        <p>
          {onlineEnabled ? (
            <>
              <strong>Chat e presença em tempo real ativos.</strong> Entra numa sala para
              conversar com os jogadores online.
            </>
          ) : (
            <>
              <strong>Modo online em breve.</strong> Por agora, joga offline contra a IA ou com
              amigos.
            </>
          )}
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
            <div className={cn('relative bg-gradient-to-br p-5', featured.gradient)}>
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-gold text-background text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Destaque
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-background/30 backdrop-blur-sm flex items-center justify-center text-4xl shrink-0">
                  <RoomIcon id={featured.id} className="w-9 h-9 text-gold" />
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
                    {featured.players}/{featured.capacity}
                  </span>
                  <span className="flex items-center gap-1 text-gold font-semibold">
                    <Coins className="w-3.5 h-3.5" />
                    {featured.stake} KZ
                  </span>
                </div>
                <GameButton variant="gold" onClick={() => setSelectedRoom(featured)} className="text-xs px-3 h-8">
                  <LogIn className="w-3.5 h-3.5 mr-1" />
                  Entrar
                </GameButton>
              </div>
            </div>
          </GameCard>
        </motion.div>
      )}

      {/* Lista de salas — nacionais e internacionais */}
      {filteredRooms.length === 0 ? (
        <div>
          <SectionTitle
            title={filter === 'friends' ? 'Salas de Amigos' : 'Todas as Salas'}
            action={<span className="text-[11px] text-muted-foreground">0 salas</span>}
          />
          <GameCard className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma sala encontrada neste filtro.
            </p>
          </GameCard>
        </div>
      ) : (
        <>
          {nationalRooms.length > 0 && (
            <div>
              <SectionTitle
                title="Salas Nacionais"
                action={
                  <span className="text-[11px] text-muted-foreground">
                    {nationalRooms.length} salas
                  </span>
                }
              />
              <div className="space-y-2">
                {nationalRooms.map((room) => (
                  <RoomCard key={room.id} room={room} onEnter={() => setSelectedRoom(room)} />
                ))}
              </div>
            </div>
          )}

          {internationalRooms.length > 0 && (
            <div>
              <SectionTitle
                title="Salas Internacionais"
                action={
                  <span className="text-[11px] text-muted-foreground">
                    {internationalRooms.length} salas
                  </span>
                }
              />
              <div className="space-y-2">
                {internationalRooms.map((room) => (
                  <RoomCard key={room.id} room={room} onEnter={() => setSelectedRoom(room)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Salas gratuitas */}
      {filter === 'all' && (
        <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
          As salas Global e Mundo são gratuitas e sem apostas. Ideais para praticar.
        </p>
      )}

      {/* Dialog de detalhes da sala */}
      <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden p-0">
          {selectedRoom && <RoomDialog room={selectedRoom} onPlay={() => handlePlay(selectedRoom)} />}
        </DialogContent>
      </Dialog>

      {/* Verificação 18+ (salas com aposta) */}
      <AgeGateDialog
        open={!!ageRoom}
        onOpenChange={(open) => !open && setAgeRoom(null)}
        onVerified={() => {
          if (ageRoom) proceedPlay(ageRoom);
          setAgeRoom(null);
        }}
      />
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
        <RoomIcon id={room.id} className="w-7 h-7 text-foreground/80" />
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
        onClick={onEnter}
        disabled={room.players >= room.capacity}
        aria-label={`Entrar na sala ${room.name}`}
        className="text-xs px-3 h-8"
      >
        <LogIn className="w-3.5 h-3.5 mr-1" />
        Entrar
      </GameButton>
    </GameCard>
  );
}

function RoomDialog({ room, onPlay }: { room: Room; onPlay: () => void }) {
  const enabled = useOnline((s) => s.enabled);
  const players = useOnline((s) => s.players);
  const messages = useOnline((s) => s.messages);
  const loading = useOnline((s) => s.loadingRoom);
  const sendMessage = useOnline((s) => s.sendMessage);
  const currentUserId = useAuth((s) => s.user?.id ?? null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canChat = enabled && Boolean(currentUserId);
  const usingRealPlayers = enabled && players.length > 0;

  const displayPlayers = usingRealPlayers
    ? players.map((p) => ({ name: p.name, level: p.level }))
    : SAMPLE_PLAYERS;

  const displayMessages = enabled
    ? messages.map((m) => ({
        key: `m${m.id}`,
        author: m.author,
        text: m.body,
        me: currentUserId !== null && m.userId === currentUserId,
        kind: m.kind,
      }))
    : SAMPLE_CHAT.map((m, i) => ({ key: `s${i}`, ...m, kind: 'user' as const }));

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayMessages.length, room.id]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !canChat || sending) return;
    setSending(true);
    const ok = await sendMessage(text);
    setSending(false);
    if (ok) setDraft('');
    else toast.error('Não foi possível enviar a mensagem.');
  };

  return (
    <>
      {/* Header com gradiente */}
      <div className={cn('relative bg-gradient-to-br p-5', room.gradient)}>
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-background/30 backdrop-blur-sm flex items-center justify-center text-3xl shrink-0">
              <RoomIcon id={room.id} className="w-7 h-7 text-foreground/80" />
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
            {usingRealPlayers ? players.length : room.players}/{room.capacity} jogadores
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
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold flex items-center gap-1.5">
            Jogadores online ({displayPlayers.length})
            {enabled && loading && <Loader2 className="w-3 h-3 animate-spin" />}
          </p>
          {displayPlayers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Ninguém na sala agora. Sê o primeiro!
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {displayPlayers.slice(0, 8).map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-surface/60 border border-border/40"
                >
                  <LevelAvatar name={p.name} level={p.level} size="sm" online />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[9px] text-p1 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-p1" /> Online
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3" />
            Chat da sala
          </p>
          <div
            ref={scrollRef}
            className="h-32 overflow-y-auto scrollbar-custom rounded-lg bg-surface/60 border border-border/40 p-3"
          >
            {displayMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                {loading ? 'A carregar mensagens…' : 'Sem mensagens. Diz olá! 👋'}
              </p>
            ) : (
              <div className="space-y-2">
                {displayMessages.map((msg) => (
                  <div
                    key={msg.key}
                    className={cn('flex flex-col', msg.me ? 'items-end' : 'items-start')}
                  >
                    <span className="text-[9px] text-muted-foreground mb-0.5">{msg.author}</span>
                    <div
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-xs max-w-[80%] break-words',
                        msg.kind === 'announcement'
                          ? 'bg-p1/20 text-p1 border border-p1/40'
                          : msg.me
                            ? 'bg-p1 text-background'
                            : 'bg-surface-2 text-foreground',
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <form
            className="flex gap-1.5 mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              type="text"
              value={draft}
              maxLength={280}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={canChat ? 'Mensagem…' : 'Entra na tua conta para conversar'}
              disabled={!canChat}
              className="flex-1 h-9 rounded-lg bg-surface/60 border border-border/40 px-3 text-xs placeholder:text-muted-foreground/60 disabled:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!canChat || !draft.trim() || sending}
              className="w-9 h-9 rounded-lg bg-p1 text-background flex items-center justify-center disabled:bg-surface-2 disabled:text-muted-foreground"
              aria-label="Enviar mensagem"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <DialogFooter className="px-5 pb-5 pt-2 gap-2">
        <p className="text-[10px] text-muted-foreground/70 text-center w-full flex items-center justify-center gap-1.5">
          <Globe className="w-3 h-3" />
          {enabled
            ? 'Chat e partidas online em tempo real.'
            : 'Modo online em breve — redirecionado para o modo offline.'}
        </p>
        <GameButton variant="p1" className="w-full h-11" onClick={onPlay}>
          <LogIn className="w-4 h-4 mr-2" />
          Jogar
        </GameButton>
      </DialogFooter>
    </>
  );
}
