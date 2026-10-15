'use client';

import { useEffect, useState } from 'react';
import {
  Trophy,
  Check,
  Globe,
  Plus,
  LogIn,
  LogOut,
  Play,
  Loader2,
  Users,
  Info,
  Wifi,
  Crown,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';
import { useTournament } from '@/store/tournament';
import { useMatch } from '@/store/match';
import { useOnlineTournaments } from '@/store/onlineTournaments';
import {
  bracketRoundCount,
  findMyOpenMatch,
  groupMatchesByRound,
  roundLabel,
  tournamentStatusLabel,
  type BracketMatch,
  type TournamentDetail,
  type TournamentErrorCode,
} from '@/lib/online/tournaments';
import {
  getEntrant,
  getFirstHumanMatchId,
  type TournamentBracket,
  type TournamentMatch,
} from '@/lib/tournament';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { AgeGateDialog } from '@/components/game/AgeGateDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tab = 'online' | 'weekly';

export function TournamentScreen() {
  const [tab, setTab] = useState<Tab>('online');

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      <div className="flex gap-1.5 p-1 rounded-xl bg-surface/50 border border-border/40">
        <TabButton active={tab === 'online'} onClick={() => setTab('online')} icon={<Globe className="w-4 h-4" />}>
          Online
        </TabButton>
        <TabButton active={tab === 'weekly'} onClick={() => setTab('weekly')} icon={<Trophy className="w-4 h-4" />}>
          Semanal
        </TabButton>
      </div>

      {tab === 'online' ? <OnlineTournaments /> : <WeeklyTournament />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-colors',
        active ? 'bg-gold/15 text-gold' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ============================ Torneios Online ============================

const ERROR_MESSAGES: Partial<Record<TournamentErrorCode, string>> = {
  not_authenticated: 'Inicia sessão para jogar torneios online.',
  not_enough_coins: 'Não tens moedas suficientes para a inscrição.',
  age_restricted: 'Torneios com aposta são só para maiores de 18 anos.',
  tournament_full: 'O torneio já está cheio.',
  tournament_not_open: 'Este torneio já não aceita inscrições.',
  tournament_already_started: 'O torneio já começou.',
  not_tournament_owner: 'Só o criador pode iniciar o torneio.',
  not_enough_players: 'Precisas de pelo menos 2 jogadores para iniciar.',
  match_not_ready: 'Este jogo ainda não está pronto.',
  not_a_participant: 'Não participas neste jogo.',
};

function errorMessage(code: TournamentErrorCode | undefined): string {
  return (code && ERROR_MESSAGES[code]) || 'Ocorreu um erro. Tenta novamente.';
}

function OnlineTournaments() {
  const navigate = useApp((s) => s.navigate);
  const uid = useAuth((s) => s.user?.id ?? null);
  const isAuthed = useAuth((s) => Boolean(s.user));

  const enabled = useOnlineTournaments((s) => s.enabled);
  const list = useOnlineTournaments((s) => s.list);
  const listLoaded = useOnlineTournaments((s) => s.listLoaded);
  const listLoading = useOnlineTournaments((s) => s.listLoading);
  const selectedId = useOnlineTournaments((s) => s.selectedId);
  const detail = useOnlineTournaments((s) => s.detail);
  const detailLoading = useOnlineTournaments((s) => s.detailLoading);
  const profiles = useOnlineTournaments((s) => s.profiles);
  const load = useOnlineTournaments((s) => s.load);
  const open = useOnlineTournaments((s) => s.open);
  const close = useOnlineTournaments((s) => s.close);
  const create = useOnlineTournaments((s) => s.create);
  const join = useOnlineTournaments((s) => s.join);
  const leave = useOnlineTournaments((s) => s.leave);
  const start = useOnlineTournaments((s) => s.start);
  const playMatch = useOnlineTournaments((s) => s.playMatch);
  const unsubscribe = useOnlineTournaments((s) => s.unsubscribe);

  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  /** Torneio com aposta à espera de verificação 18+. */
  const [ageJoinId, setAgeJoinId] = useState<string | null>(null);

  const canUse = enabled && isAuthed;

  useEffect(() => {
    if (!canUse) return;
    void load();
    if (selectedId) void open(selectedId);
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  const nameFor = (id: string | null): string => {
    if (!id) return '—';
    return profiles[id]?.username ?? `Jogador ${id.slice(0, 4)}`;
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      toast.error('Dá um nome ao torneio (mín. 2 letras).');
      return;
    }
    setBusy('create');
    const res = await create({ name, entryFee: 0, prize: 1000, maxPlayers: 8 });
    setBusy(null);
    if (!res.ok) {
      toast.error(errorMessage(res.code));
      return;
    }
    setNewName('');
    toast.success('Torneio criado!', { description: 'Inscreve-te e convida os amigos.' });
  };

  const handleJoin = async (id: string) => {
    setBusy(`join:${id}`);
    const res = await join(id);
    setBusy(null);
    if (!res.ok) {
      // Torneio com aposta e ainda sem idade verificada → pedir data de nascimento.
      if (res.code === 'age_restricted') {
        setAgeJoinId(id);
        return;
      }
      toast.error(errorMessage(res.code));
      return;
    }
    toast.success(res.status === 'already_joined' ? 'Já estavas inscrito.' : 'Inscrição feita!');
  };

  const handleLeave = async (id: string) => {
    setBusy(`leave:${id}`);
    const ok = await leave(id);
    setBusy(null);
    if (!ok) {
      toast.error('Não foi possível sair do torneio.');
      return;
    }
    toast.info('Saíste do torneio.');
  };

  const handleStart = async (id: string) => {
    setBusy(`start:${id}`);
    const ok = await start(id);
    setBusy(null);
    if (!ok) {
      toast.error('Não foi possível iniciar o torneio.');
      return;
    }
    toast.success('Torneio iniciado!');
  };

  const handlePlay = async (bracketMatchId: string) => {
    setBusy(`play:${bracketMatchId}`);
    const res = await playMatch(bracketMatchId);
    setBusy(null);
    if (!res.ok) {
      toast.error(errorMessage(res.code));
      return;
    }
    await useMatch.getState().loadMatchById(res.matchId, 'tournament');
    navigate('match');
  };

  // ---------------------------- Sem sessão ----------------------------
  if (!canUse) {
    return (
      <>
        <GameCard className="p-5" glow="gold">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center">
              <Globe className="w-7 h-7 text-gold" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-2xl tracking-wide">TORNEIOS ONLINE</h2>
              <p className="text-xs text-muted-foreground">Eliminatórias entre jogadores reais</p>
            </div>
          </div>
        </GameCard>
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border bg-orange/10 border-orange/30 text-orange text-xs leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>Inicia sessão para jogar torneios online.</strong> Precisas de uma conta para
            criar, entrar e competir por prémios.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <GameCard className="p-5" glow="gold">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center">
            <Globe className="w-7 h-7 text-gold" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl tracking-wide">TORNEIOS ONLINE</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              Eliminatórias entre jogadores reais
            </p>
          </div>
        </div>
        <form
          className="flex gap-2 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <input
            type="text"
            value={newName}
            maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo torneio…"
            className="flex-1 h-11 rounded-xl bg-surface/60 border border-border/40 px-3 text-sm placeholder:text-muted-foreground/60"
          />
          <GameButton
            type="submit"
            variant="primary"
            className="h-11 px-4"
            disabled={busy === 'create' || newName.trim().length < 2}
          >
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </GameButton>
        </form>
      </GameCard>

      {/* Catálogo */}
      <div>
        <SectionTitle
          title="Torneios"
          action={
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              {listLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {list.length}
            </span>
          }
        />
        {list.length === 0 ? (
          <GameCard className="p-6 text-center">
            <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {listLoaded ? 'Não há torneios abertos. Cria o primeiro!' : 'A carregar torneios…'}
            </p>
          </GameCard>
        ) : (
          <div className="space-y-2">
            {list.map((t) => (
              <GameCard
                key={t.id}
                className={cn(
                  'p-3.5 flex items-center gap-3 cursor-pointer transition-colors',
                  selectedId === t.id ? 'border-gold/40' : 'hover:border-border',
                )}
                onClick={() => void open(t.id)}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    t.status === 'in_progress' ? 'bg-p1/15 text-p1' : 'bg-gold/15 text-gold',
                  )}
                >
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>{tournamentStatusLabel(t.status)}</span>
                    <span className="flex items-center gap-0.5">
                      <Users className="w-3 h-3" />
                      {t.maxPlayers}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-muted-foreground">Prémio</p>
                  <p className="text-sm font-semibold text-gold">{t.pot > 0 ? t.pot : t.prize} KZ</p>
                </div>
              </GameCard>
            ))}
          </div>
        )}
      </div>

      {/* Detalhe / chave */}
      {selectedId && (
        <div className="space-y-3">
          {detailLoading && !detail ? (
            <GameCard className="p-6 text-center">
              <Loader2 className="w-6 h-6 text-gold animate-spin mx-auto" />
            </GameCard>
          ) : detail ? (
            <TournamentDetailPanel
              detail={detail}
              uid={uid}
              nameFor={nameFor}
              busy={busy}
              onJoin={handleJoin}
              onLeave={handleLeave}
              onStart={handleStart}
              onPlay={handlePlay}
              onClose={close}
            />
          ) : null}
        </div>
      )}

      {/* Verificação 18+ (torneios com aposta) */}
      <AgeGateDialog
        open={!!ageJoinId}
        onOpenChange={(open) => !open && setAgeJoinId(null)}
        onVerified={() => {
          const id = ageJoinId;
          setAgeJoinId(null);
          if (id) void handleJoin(id);
        }}
      />
    </>
  );
}

function TournamentDetailPanel({
  detail,
  uid,
  nameFor,
  busy,
  onJoin,
  onLeave,
  onStart,
  onPlay,
  onClose,
}: {
  detail: TournamentDetail;
  uid: string | null;
  nameFor: (id: string | null) => string;
  busy: string | null;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onStart: (id: string) => void;
  onPlay: (bracketMatchId: string) => void;
  onClose: () => void;
}) {
  const { tournament: t, matches, entries, playerCount } = detail;
  const iJoined = Boolean(uid && entries.some((e) => e.userId === uid));
  const isOwner = Boolean(uid && t.createdBy === uid);
  const rounds = groupMatchesByRound(matches);
  const totalRounds = bracketRoundCount(matches);
  const myOpen = findMyOpenMatch(matches, uid);
  const championName = t.championId ? nameFor(t.championId) : null;

  return (
    <>
      <GameCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-xl tracking-wide truncate">{t.name}</h3>
            <p className="text-[11px] text-muted-foreground">
              {tournamentStatusLabel(t.status)} • {playerCount}/{t.maxPlayers} jogadores
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
          >
            Fechar
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
          <Trophy className="w-3 h-3 text-gold" />
          Prémio: <span className="text-gold font-semibold">{t.pot > 0 ? t.pot : t.prize} KZ</span>
          {t.entryFee > 0 && <span className="ml-2">• Inscrição: {t.entryFee} KZ</span>}
        </div>

        {/* Ações */}
        <div className="mt-3 space-y-2">
          {t.status === 'open' && !iJoined && (
            <GameButton
              variant="primary"
              className="w-full"
              disabled={busy === `join:${t.id}`}
              onClick={() => onJoin(t.id)}
            >
              {busy === `join:${t.id}` ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Inscrever-me
            </GameButton>
          )}
          {t.status === 'open' && iJoined && (
            <div className="flex gap-2">
              <GameButton
                variant="outline"
                className="flex-1"
                disabled={busy === `leave:${t.id}`}
                onClick={() => onLeave(t.id)}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </GameButton>
              {isOwner && (
                <GameButton
                  variant="primary"
                  className="flex-1"
                  disabled={playerCount < 2 || busy === `start:${t.id}`}
                  onClick={() => onStart(t.id)}
                >
                  {busy === `start:${t.id}` ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Iniciar
                </GameButton>
              )}
            </div>
          )}
          {t.status === 'open' && isOwner && !iJoined && playerCount >= 2 && (
            <GameButton variant="outline" className="w-full" onClick={() => onStart(t.id)}>
              <Play className="w-4 h-4 mr-2" />
              Iniciar torneio
            </GameButton>
          )}
          {t.status === 'in_progress' && myOpen && (
            <GameButton
              variant="primary"
              className="w-full"
              disabled={busy === `play:${myOpen.id}`}
              onClick={() => onPlay(myOpen.id)}
            >
              {busy === `play:${myOpen.id}` ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {myOpen.status === 'playing' ? 'Retomar jogo' : `Jogar ${roundLabel(myOpen.round, totalRounds)}`}
            </GameButton>
          )}
        </div>

        {t.status === 'in_progress' && !myOpen && iJoined && (
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            À espera do próximo jogo. A chave atualiza automaticamente.
          </p>
        )}
      </GameCard>

      {t.status === 'completed' && (
        <GameCard className="p-4 bg-gold/5 border-gold/30 text-center">
          <Crown className="w-8 h-8 text-gold mx-auto mb-2" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campeão</p>
          <p className="font-display text-xl text-gold">{championName ?? '—'}</p>
        </GameCard>
      )}

      {rounds.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Chave</h3>
          <div className="space-y-3">
            {rounds.map((r) => (
              <div key={r.round}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {roundLabel(r.round, totalRounds)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {r.matches.map((m) => (
                    <OnlineMatchCard
                      key={m.id}
                      match={m}
                      uid={uid}
                      nameFor={nameFor}
                      onPlay={onPlay}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function OnlineMatchCard({
  match,
  uid,
  nameFor,
  onPlay,
  busy,
}: {
  match: BracketMatch;
  uid: string | null;
  nameFor: (id: string | null) => string;
  onPlay: (bracketMatchId: string) => void;
  busy: string | null;
}) {
  const isMine = Boolean(uid && (match.p1Id === uid || match.p2Id === uid));
  const canPlay = isMine && match.winnerId === null && match.status === 'ready' && match.p1Id && match.p2Id;

  return (
    <GameCard
      className={cn('p-2 text-[11px]', match.winnerId && 'border-p1/30', isMine && 'ring-1 ring-gold/30')}
    >
      <div className="space-y-1">
        <Slot name={nameFor(match.p1Id)} winner={match.winnerId === match.p1Id && !!match.winnerId} />
        <Slot name={nameFor(match.p2Id)} winner={match.winnerId === match.p2Id && !!match.winnerId} />
      </div>
      {match.status === 'bye' && (
        <p className="text-[10px] text-muted-foreground mt-1 text-center">Passa direto</p>
      )}
      {canPlay && (
        <button
          type="button"
          disabled={busy === `play:${match.id}`}
          onClick={() => onPlay(match.id)}
          className="mt-1.5 w-full h-7 rounded-md bg-gold/15 text-gold text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {busy === `play:${match.id}` ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          Jogar
        </button>
      )}
    </GameCard>
  );
}

// ============================== Torneio Semanal ==============================

function WeeklyTournament() {
  const navigate = useApp((s) => s.navigate);
  const setTournamentMatchId = useApp((s) => s.setTournamentMatchId);
  const join = useTournament((s) => s.join);
  const leave = useTournament((s) => s.leave);
  const bracket = useTournament((s) => s.bracket);
  const joined = useTournament((s) => s.joined);

  const playNext = () => {
    if (!bracket) return;
    const id = getFirstHumanMatchId(bracket);
    if (!id) return;
    setTournamentMatchId(id);
    navigate('tournament-play');
  };

  const handleJoin = () => {
    if (!joined) join();
    playNext();
  };

  return (
    <>
      <GameCard className="p-5" glow="gold">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center">
            <Trophy className="w-7 h-7 text-gold" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl tracking-wide">TORNEIO SEMANAL</h2>
            <p className="text-xs text-muted-foreground">Eliminatória simples • 8 jogadores</p>
            <p className="text-xs text-gold mt-1">Prémio: {bracket?.prize ?? 50000} KZ</p>
          </div>
        </div>
        {!joined ? (
          <GameButton variant="primary" className="w-full mt-4" onClick={handleJoin}>
            Participar agora
          </GameButton>
        ) : (
          <GameButton variant="primary" className="w-full mt-4" onClick={playNext}>
            Jogar o teu próximo jogo
          </GameButton>
        )}
      </GameCard>

      {joined && bracket && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Chave</h3>
          <div className="grid grid-cols-3 gap-2">
            <WeeklyRound
              title="1/4 Final"
              matches={bracket.matchOrder.filter((m) => bracket.matches[m]?.round === 1)}
              bracket={bracket}
            />
            <WeeklyRound
              title="Meias-finais"
              matches={bracket.matchOrder.filter((m) => bracket.matches[m]?.round === 2)}
              bracket={bracket}
            />
            <WeeklyRound
              title="Final"
              matches={bracket.matchOrder.filter((m) => bracket.matches[m]?.round === 3)}
              bracket={bracket}
            />
          </div>
          {bracket.status === 'completed' && <ChampionCard bracket={bracket} />}
          <GameButton variant="p2" className="w-full" onClick={leave}>
            Abandonar torneio
          </GameButton>
        </div>
      )}
    </>
  );
}

function ChampionCard({ bracket }: { bracket: TournamentBracket }) {
  const champion = getEntrant(bracket, bracket.matches[bracket.finalMatchId]?.winnerId);
  return (
    <GameCard className="p-4 bg-gold/5 border-gold/30 text-center">
      <Trophy className="w-8 h-8 text-gold mx-auto mb-2" />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campeão</p>
      <p className="font-display text-xl text-gold">{champion?.name ?? '—'}</p>
    </GameCard>
  );
}

function WeeklyRound({
  title,
  matches,
  bracket,
}: {
  title: string;
  matches: string[];
  bracket: TournamentBracket;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase text-muted-foreground text-center">{title}</p>
      {matches.map((id) => (
        <WeeklyMatchCard key={id} match={bracket.matches[id]} bracket={bracket} />
      ))}
    </div>
  );
}

function WeeklyMatchCard({
  match,
  bracket,
}: {
  match: TournamentMatch;
  bracket: TournamentBracket;
}) {
  const p1 = getEntrant(bracket, match.p1Id);
  const p2 = getEntrant(bracket, match.p2Id);
  return (
    <GameCard className={cn('p-2 text-[11px]', match.winnerId && 'border-p1/30')}>
      <div className="space-y-1">
        <Slot name={p1?.name ?? '—'} winner={!!match.winnerId && match.winnerId === p1?.id} />
        <Slot name={p2?.name ?? '—'} winner={!!match.winnerId && match.winnerId === p2?.id} />
      </div>
    </GameCard>
  );
}

function Slot({ name, winner }: { name: string; winner?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-1 py-0.5 rounded',
        winner && 'bg-p1/10',
      )}
    >
      <span className={cn('truncate', winner ? 'text-p1' : 'text-muted-foreground')}>{name}</span>
      {winner && <Check className="w-3 h-3 text-p1 shrink-0" />}
    </div>
  );
}
