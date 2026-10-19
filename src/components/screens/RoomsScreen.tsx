'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Coins, LogIn, MessageCircle, Send, Globe, Loader2 } from 'lucide-react';
import { useApp } from '@/store/app';
import { useOnline } from '@/store/online';
import { useAuth } from '@/store/auth';
import { useMatch } from '@/store/match';
import { useProfile } from '@/store/profile';
import { useAge } from '@/store/age';
import { GameButton, GameCard, LevelAvatar } from '@/components/game/ui';
import { RoomIcon } from '@/components/game/icons';
import { Globe3D } from '@/components/game/Globe3D';
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

interface Room {
  id: string;
  name: string;
  region: 'national' | 'international';
  gradient: string;
  players: number;
  capacity: number;
  stake: number;
  featured?: boolean;
  tags: string[];
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

/**
 * Cada cidade real do globo abre a sala correspondente (país/região).
 * Os ids coincidem com os `id` de `Globe3D`.
 */
const LOCATION_ROOM: Record<string, string> = {
  luanda: 'luanda',
  benguela: 'benguela',
  huambo: 'huambo',
  cabinda: 'cabinda',
  lisboa: 'portugal',
  porto: 'portugal',
  'sao-paulo': 'brasil',
  'rio-de-janeiro': 'brasil',
  paris: 'europa',
  londres: 'europa',
  'nova-iorque': 'america',
  maputo: 'mocambique',
  praia: 'caboverde',
  johannesburgo: 'africa',
};

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
      merged.push({
        id: o.id,
        name: o.name,
        region: o.region,
        gradient: 'from-surface-2 to-surface',
        players: 0,
        capacity: o.capacity,
        stake: o.stake,
        featured: o.isFeatured,
        tags: o.stake > 0 ? ['all', 'online', 'bets'] : ['all', 'online'],
      });
    }
    return merged;
  }, [onlineRooms]);

  // Clicar numa localização real do globo abre a sala dessa região.
  const openLocation = (locationId: string) => {
    const roomId = LOCATION_ROOM[locationId];
    const room = roomId ? rooms.find((r) => r.id === roomId) : undefined;
    if (room) setSelectedRoom(room);
    else toast.info('Sala em breve', { description: 'Ainda não há sala para esta região.' });
  };

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-3xl tracking-wide">SALAS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toca num ponto do globo para entrares na sala daquela região.
        </p>
      </div>

      {/* Globo 3D com jogadores online — única forma de escolher sala */}
      <GameCard className="p-4">
        <Globe3D onLocationClick={(loc) => openLocation(loc.id)} />
        <div className="flex items-center justify-center gap-5 mt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3AA855] ring-1 ring-white/40" />
            Movimento baixo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F0B90B] ring-1 ring-white/40" />
            Movimento alto
          </span>
        </div>
      </GameCard>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        Arrasta para rodar, faz scroll ou usa o zoom para aproximar um país. Cada ponto é uma cidade real com jogadores à espera.
      </p>

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
              className="flex-1 h-12 rounded-lg bg-surface/60 border border-border/40 px-3 text-xs placeholder:text-muted-foreground disabled:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!canChat || !draft.trim() || sending}
              className="w-12 h-12 rounded-lg bg-p1 text-background flex items-center justify-center disabled:bg-surface-2 disabled:text-muted-foreground"
              aria-label="Enviar mensagem"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <DialogFooter className="px-5 pb-5 pt-2 gap-2">
        <p className="text-[10px] text-muted-foreground text-center w-full flex items-center justify-center gap-1.5">
          <Globe className="w-3 h-3" />
          {enabled
            ? 'Chat e partidas online em tempo real.'
            : 'Modo online em breve — redirecionado para o modo offline.'}
        </p>
        <GameButton variant="p1" className="w-full h-12" onClick={onPlay}>
          <LogIn className="w-4 h-4 mr-2" />
          Jogar
        </GameButton>
      </DialogFooter>
    </>
  );
}
