'use client';

import { useEffect, useState } from 'react';
import {
  UserPlus,
  Users,
  Check,
  X,
  Search,
  Loader2,
  UserMinus,
  Info,
  Wifi,
  Clock,
  Trophy,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useFriends } from '@/store/friends';
import { useAuth } from '@/store/auth';
import { GameButton, GameCard, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function FriendsScreen() {
  const navigate = useApp((s) => s.navigate);
  const isAuthed = useAuth((s) => Boolean(s.user));

  const enabled = useFriends((s) => s.enabled);
  const loaded = useFriends((s) => s.loaded);
  const loading = useFriends((s) => s.loading);
  const friends = useFriends((s) => s.friends);
  const incoming = useFriends((s) => s.incoming);
  const outgoing = useFriends((s) => s.outgoing);
  const load = useFriends((s) => s.load);
  const requestByUsername = useFriends((s) => s.requestByUsername);
  const accept = useFriends((s) => s.accept);
  const decline = useFriends((s) => s.decline);
  const remove = useFriends((s) => s.remove);
  const subscribe = useFriends((s) => s.subscribe);
  const unsubscribe = useFriends((s) => s.unsubscribe);

  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);

  const canUse = enabled && isAuthed;

  useEffect(() => {
    if (canUse) {
      void load();
      subscribe();
    }
    return () => unsubscribe();
  }, [canUse, load, subscribe, unsubscribe]);

  const handleAdd = async () => {
    const name = query.trim();
    if (!name || sending) return;
    setSending(true);
    const result = await requestByUsername(name);
    setSending(false);
    if (!result.ok) {
      toast.error('Não foi possível enviar o pedido.', {
        description:
          result.code === 'unknown_user'
            ? 'Não encontrámos nenhum jogador com esse username.'
            : 'Verifica a ligação e tenta novamente.',
      });
      return;
    }
    if (result.status === 'requested') {
      toast.success('Pedido enviado!', { description: `Espera que ${name} aceite.` });
    } else if (result.status === 'accepted') {
      toast.success(`${name} já te tinha enviado um pedido — agora são amigos!`);
    } else if (result.status === 'already_friends') {
      toast.info('Já são amigos.');
    } else {
      toast.info('Já enviaste um pedido a este jogador.');
    }
    setQuery('');
  };

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide">AMIGOS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adiciona jogadores pelo username e desafia-os para uma partida.
        </p>
      </div>

      {/* Estado online / offline */}
      <div
        className={cn(
          'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-xs leading-relaxed',
          canUse ? 'bg-p1/10 border-p1/30 text-p1' : 'bg-orange/10 border-orange/30 text-orange',
        )}
      >
        {canUse ? <Wifi className="w-4 h-4 shrink-0 mt-0.5" /> : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
        <p>
          {canUse ? (
            <>
              <strong>Amizades sincronizadas.</strong> Os pedidos novos aparecem aqui em tempo real.
            </>
          ) : (
            <>
              <strong>Inicia sessão para usar amigos.</strong> Precisas de uma conta para enviar e
              receber pedidos.
            </>
          )}
        </p>
      </div>

      {/* Pesquisar / adicionar */}
      <GameCard className="p-4">
        <SectionTitle title="Adicionar amigo" />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdd();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              maxLength={40}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Username do jogador…"
              disabled={!canUse}
              className="w-full h-11 rounded-xl bg-surface/60 border border-border/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 disabled:text-muted-foreground"
            />
          </div>
          <GameButton
            type="submit"
            variant="p1"
            className="h-11 px-4"
            disabled={!canUse || !query.trim() || sending}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </GameButton>
        </form>
      </GameCard>

      {/* Pedidos recebidos */}
      {canUse && incoming.length > 0 && (
        <div>
          <SectionTitle
            title="Pedidos recebidos"
            action={<span className="text-[11px] text-gold font-semibold">{incoming.length}</span>}
          />
          <div className="space-y-2">
            {incoming.map((r) => (
              <GameCard key={r.friendshipId} className="p-3 flex items-center gap-3" glow="gold">
                <LevelAvatar name={r.username ?? undefined} level={r.level} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.username ?? 'Jogador'}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-gold" />
                    {r.elo} Elo
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void accept(r.friendshipId)}
                  className="w-9 h-9 rounded-lg bg-p1 text-white flex items-center justify-center"
                  aria-label="Aceitar pedido"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void decline(r.friendshipId)}
                  className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center"
                  aria-label="Recusar pedido"
                >
                  <X className="w-4 h-4" />
                </button>
              </GameCard>
            ))}
          </div>
        </div>
      )}

      {/* Pedidos enviados */}
      {canUse && outgoing.length > 0 && (
        <div>
          <SectionTitle title="Pedidos enviados" />
          <div className="space-y-2">
            {outgoing.map((r) => (
              <GameCard key={r.friendshipId} className="p-3 flex items-center gap-3">
                <LevelAvatar name={r.username ?? undefined} level={r.level} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.username ?? 'Jogador'}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    À espera de resposta
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(r.userId)}
                  className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center"
                  aria-label="Cancelar pedido"
                >
                  <X className="w-4 h-4" />
                </button>
              </GameCard>
            ))}
          </div>
        </div>
      )}

      {/* Lista de amigos */}
      <div>
        <SectionTitle
          title="Os teus amigos"
          action={
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              {friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}
            </span>
          }
        />
        {friends.length === 0 ? (
          <GameCard className="p-6 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {canUse
                ? loaded
                  ? 'Ainda não tens amigos. Procura alguém pelo username!'
                  : 'A carregar amigos…'
                : 'Inicia sessão para ver os teus amigos.'}
            </p>
          </GameCard>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <GameCard key={f.friendshipId} className="p-3 flex items-center gap-3">
                <LevelAvatar name={f.username ?? undefined} level={f.level} size="sm" online />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{f.username ?? 'Jogador'}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-gold" />
                    {f.elo} Elo
                  </p>
                </div>
                <GameButton
                  variant="ghost"
                  className="h-9 px-3 text-xs"
                  onClick={() => navigate('rooms')}
                >
                  Desafiar
                </GameButton>
                <button
                  type="button"
                  onClick={() => void remove(f.userId)}
                  className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-muted-foreground"
                  aria-label={`Remover ${f.username ?? 'amigo'}`}
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              </GameCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
