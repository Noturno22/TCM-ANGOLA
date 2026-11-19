/**
 * Tournament — port mobile de `TournamentScreen` (web).
 *
 * Duas abas: torneios online (Supabase) e Torneio Semanal (offline, chave de
 * 8 jogadores). Mantém o conteúdo, ordem, cores e dimensões do ecrã web,
 * adaptando apenas primitivas DOM → React Native.
 */
import {
  Check,
  Crown,
  Globe,
  Info,
  LogIn,
  LogOut,
  Pencil,
  Play,
  Plus,
  Trophy,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import {
  GameButton,
  GameCard,
  LevelAvatar,
  SectionTitle,
} from '@/components/game/ui';
import {
  SegmentedControl,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { AgeGateSheet } from '@/components/tira/AgeGateSheet';
import { useAuth } from '@/store/auth';
import { useFriends } from '@/store/friends';
import { useMatch } from '@/store/match';
import { useOnlineTournaments } from '@/store/onlineTournaments';
import { useTournament } from '@/store/tournament';
import {
  bracketRoundCount,
  findMyOpenMatch,
  groupMatchesByRound,
  roundLabel,
  tournamentStatusLabel,
  type BracketMatch,
  type Tournament,
  type TournamentDetail,
  type TournamentErrorCode,
} from '@/lib/online/tournaments';
import {
  getEntrant,
  getFirstHumanMatchId,
  type TournamentBracket,
  type TournamentMatch,
} from '@/lib/tournament';
import { colors, radii, spacing, typography } from '@/theme';

type Tab = 'online' | 'weekly';

export default function TournamentScreen() {
  const [tab, setTab] = useState<Tab>('online');

  return (
    <TiraScreen>
      <View style={{ gap: spacing[5] }}>
        <SegmentedControl
          options={[
            { value: 'online', label: 'Online' },
            { value: 'weekly', label: 'Semanal' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'online' ? <OnlineTournaments /> : <WeeklyTournament />}
      </View>
    </TiraScreen>
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
  not_tournament_owner: 'Só o criador do torneio pode fazer isto.',
  not_enough_players: 'Precisas de pelo menos 2 jogadores para iniciar.',
  match_not_ready: 'Este jogo ainda não está pronto.',
  not_a_participant: 'Não participas neste jogo.',
  invalid_name: 'Dá um nome ao torneio (mín. 2 letras).',
  too_many_invites: 'Demasiados convites de uma vez. Envia em lotes.',
};

function errorMessage(code: TournamentErrorCode | undefined): string {
  return (code && ERROR_MESSAGES[code]) || 'Ocorreu um erro. Tenta novamente.';
}

function notifyError(message: string): void {
  Alert.alert('Erro', message);
}

function notifySuccess(title: string, description?: string): void {
  Alert.alert(title, description);
}

function BtnText({ color, children }: { color: string; children: ReactNode }) {
  return (
    <TiraText
      size="sm"
      weight="semibold"
      numberOfLines={1}
      style={{ color, fontFamily: typography.fontFamily.body }}
    >
      {children}
    </TiraText>
  );
}

function BtnRow({
  icon,
  color,
  children,
}: {
  icon: ReactNode;
  color: string;
  children: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
      {icon}
      <BtnText color={color}>{children}</BtnText>
    </View>
  );
}

function OnlineTournaments() {
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
  const [newDescription, setNewDescription] = useState('');
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
      notifyError('Dá um nome ao torneio (mín. 2 letras).');
      return;
    }
    setBusy('create');
    const res = await create({
      name,
      description: newDescription.trim(),
      entryFee: 0,
      prize: 1000,
      maxPlayers: 8,
    });
    setBusy(null);
    if (!res.ok) {
      notifyError(errorMessage(res.code));
      return;
    }
    setNewName('');
    setNewDescription('');
    notifySuccess('Torneio criado!', 'Inscreve-te e convida os amigos.');
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
      notifyError(errorMessage(res.code));
      return;
    }
    notifySuccess(res.status === 'already_joined' ? 'Já estavas inscrito.' : 'Inscrição feita!');
  };

  const handleLeave = async (id: string) => {
    setBusy(`leave:${id}`);
    const ok = await leave(id);
    setBusy(null);
    if (!ok) {
      notifyError('Não foi possível sair do torneio.');
      return;
    }
    notifySuccess('Saíste do torneio.');
  };

  const handleStart = async (id: string) => {
    setBusy(`start:${id}`);
    const ok = await start(id);
    setBusy(null);
    if (!ok) {
      notifyError('Não foi possível iniciar o torneio.');
      return;
    }
    notifySuccess('Torneio iniciado!');
  };

  const handlePlay = async (bracketMatchId: string) => {
    setBusy(`play:${bracketMatchId}`);
    const res = await playMatch(bracketMatchId);
    setBusy(null);
    if (!res.ok) {
      notifyError(errorMessage(res.code));
      return;
    }
    // Mobile: a partida ativa é carregada pelo ecrã /match. Limpamos a
    // partida em memória para garantir que essa sincronização acontece.
    useMatch.getState().leave();
    router.push('/match');
  };

  // ---------------------------- Sem sessão ----------------------------
  if (!canUse) {
    return (
      <View style={{ gap: spacing[5] }}>
        <GameCard style={{ padding: spacing[5] }} glow="gold">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.xl,
                backgroundColor: alpha(colors.gold, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe width={28} height={28} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <TiraHeading level="h2" style={{ letterSpacing: 0.675, lineHeight: 36 }}>TORNEIOS ONLINE</TiraHeading>
              <TiraText size="xs" variant="muted">
                Eliminatórias entre jogadores reais
              </TiraText>
            </View>
          </View>
        </GameCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            paddingHorizontal: spacing[3],
            paddingVertical: 10,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: alpha(colors.orange, 0.3),
            backgroundColor: alpha(colors.orange, 0.1),
          }}
        >
          <View style={{ marginTop: 2 }}>
            <Info width={16} height={16} color={colors.orange} />
          </View>
          <TiraText size="xs" variant="orange" style={{ flex: 1, lineHeight: 18 }}>
            <TiraText size="xs" weight="bold" variant="orange">
              Inicia sessão para jogar torneios online.
            </TiraText>{' '}
            Precisas de uma conta para criar, entrar e competir por prémios.
          </TiraText>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[5] }}>
      <GameCard style={{ padding: spacing[5] }} glow="gold">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Globe width={28} height={28} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <TiraHeading level="h2" style={{ letterSpacing: 0.675, lineHeight: 36 }}>TORNEIOS ONLINE</TiraHeading>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
              <Wifi width={12} height={12} color={colors.textMuted} />
              <TiraText size="xs" variant="muted">
                Eliminatórias entre jogadores reais
              </TiraText>
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing[4], gap: spacing[2] }}>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <TextInput
              value={newName}
              maxLength={60}
              onChangeText={setNewName}
              placeholder="Nome do novo torneio…"
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                height: 48,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: alpha(colors.surface, 0.6),
                paddingHorizontal: spacing[3],
                color: colors.text,
                fontSize: 15.75,
                fontFamily: typography.fontFamily.body,
              }}
            />
            <GameButton
              variant="primary"
              style={{ height: 48, paddingHorizontal: spacing[4] }}
              disabled={busy === 'create' || newName.trim().length < 2}
              onPress={() => void handleCreate()}
              accessibilityLabel="Criar torneio"
            >
              {busy === 'create' ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Plus width={16} height={16} color={colors.primaryForeground} />
              )}
            </GameButton>
          </View>
          <TextInput
            value={newDescription}
            maxLength={140}
            multiline
            onChangeText={setNewDescription}
            placeholder="Descrição (opcional): regras, prémio, hora…"
            placeholderTextColor={colors.textMuted}
            style={{
              minHeight: 68,
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: alpha(colors.surface, 0.6),
              paddingHorizontal: spacing[3],
              paddingVertical: 10,
              color: colors.text,
              fontSize: 15.75,
              textAlignVertical: 'top',
              fontFamily: typography.fontFamily.body,
            }}
          />
        </View>
      </GameCard>

      {/* Catálogo */}
      <View>
        <SectionTitle
          title="Torneios"
          action={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
              {listLoading ? <ActivityIndicator size="small" color={colors.gold} /> : null}
              <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
                {list.length}
              </TiraText>
            </View>
          }
        />
        {list.length === 0 ? (
          <GameCard style={{ padding: spacing[6], alignItems: 'center' }}>
            <Globe width={32} height={32} color={colors.textMuted} style={{ marginBottom: spacing[2] }} />
            <TiraText size="sm" variant="muted" align="center">
              {listLoaded ? 'Não há torneios abertos. Cria o primeiro!' : 'A carregar torneios…'}
            </TiraText>
          </GameCard>
        ) : (
          <View style={{ gap: spacing[2] }}>
            {list.map((t) => (
              <Pressable key={t.id} onPress={() => void open(t.id)}>
                <GameCard
                  style={{
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    borderColor:
                      selectedId === t.id ? alpha(colors.gold, 0.4) : colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        t.status === 'in_progress'
                          ? alpha(colors.p1, 0.15)
                          : alpha(colors.gold, 0.15),
                    }}
                  >
                    <Trophy
                      width={20}
                      height={20}
                      color={t.status === 'in_progress' ? colors.p1 : colors.gold}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <TiraText size="sm" weight="semibold" numberOfLines={1}>
                      {t.name}
                    </TiraText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                      <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
                        {tournamentStatusLabel(t.status)}
                      </TiraText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Users width={12} height={12} color={colors.textMuted} />
                        <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
                          {t.maxPlayers}
                        </TiraText>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
                      Prémio
                    </TiraText>
                    <TiraText size="sm" weight="semibold" variant="gold">
                      {t.pot > 0 ? t.pot : t.prize} KZ
                    </TiraText>
                  </View>
                </GameCard>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Detalhe / chave */}
      {selectedId ? (
        <View style={{ gap: spacing[3] }}>
          {detailLoading && !detail ? (
            <GameCard style={{ padding: spacing[6], alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.gold} />
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
        </View>
      ) : null}

      {/* Verificação 18+ (torneios com aposta) */}
      <AgeGateSheet
        visible={!!ageJoinId}
        onClose={() => setAgeJoinId(null)}
        onVerified={() => {
          const id = ageJoinId;
          setAgeJoinId(null);
          if (id) void handleJoin(id);
        }}
      />
    </View>
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
  const canInvite = t.status === 'open' && (isOwner || iJoined);
  const joinedIds = new Set(entries.map((e) => e.userId));
  const [mode, setMode] = useState<'idle' | 'edit' | 'invite'>('idle');

  return (
    <View style={{ gap: spacing[3] }}>
      <GameCard style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TiraHeading level="h3" numberOfLines={1} style={{ fontSize: 22.5, letterSpacing: 0.5625, lineHeight: 31.5 }}>
              {t.name}
            </TiraHeading>
            <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
              {tournamentStatusLabel(t.status)} • {playerCount}/{t.maxPlayers} jogadores
            </TiraText>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
              Fechar
            </TiraText>
          </Pressable>
        </View>

        {t.description ? (
          <TiraText
            size="xs"
            variant="muted"
            style={{ marginTop: spacing[2], lineHeight: 18 }}
          >
            {t.description}
          </TiraText>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[1],
            marginTop: spacing[2],
            flexWrap: 'wrap',
          }}
        >
          <Trophy width={12} height={12} color={colors.gold} />
          <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
            Prémio:{' '}
            <TiraText size="xs" weight="semibold" variant="gold" style={{ fontSize: 11 }}>
              {t.pot > 0 ? t.pot : t.prize} KZ
            </TiraText>
          </TiraText>
          {t.entryFee > 0 ? (
            <TiraText size="xs" variant="muted" style={{ fontSize: 11, marginLeft: spacing[2] }}>
              • Inscrição: {t.entryFee} KZ
            </TiraText>
          ) : null}
        </View>

        {/* Editar (só o criador) / Convidar amigos */}
        {(isOwner || canInvite) && (
          <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
            {isOwner && t.status === 'open' ? (
              <GameButton
                variant="outline"
                style={{ flex: 1, paddingHorizontal: spacing[3] }}
                onPress={() => setMode(mode === 'edit' ? 'idle' : 'edit')}
              >
                <BtnRow icon={<Pencil width={16} height={16} color={colors.text} />} color={colors.text}>
                  {mode === 'edit' ? 'Fechar' : 'Editar'}
                </BtnRow>
              </GameButton>
            ) : null}
            {canInvite ? (
              <GameButton
                variant="outline"
                style={{ flex: 1, paddingHorizontal: spacing[3] }}
                onPress={() => setMode(mode === 'invite' ? 'idle' : 'invite')}
              >
                <BtnRow
                  icon={<UserPlus width={16} height={16} color={colors.text} />}
                  color={colors.text}
                >
                  {mode === 'invite' ? 'Fechar' : 'Convidar'}
                </BtnRow>
              </GameButton>
            ) : null}
          </View>
        )}

        {isOwner && t.status === 'open' && mode === 'edit' ? (
          <TournamentEditForm tournament={t} onDone={() => setMode('idle')} />
        ) : null}
        {canInvite && mode === 'invite' ? (
          <TournamentInviteList
            tournament={t}
            joinedIds={joinedIds}
            onDone={() => setMode('idle')}
          />
        ) : null}

        {/* Ações */}
        <View style={{ marginTop: spacing[3], gap: spacing[2] }}>
          {t.status === 'open' && !iJoined ? (
            <GameButton
              variant="primary"
              style={{ width: '100%' }}
              disabled={busy === `join:${t.id}`}
              onPress={() => onJoin(t.id)}
            >
              {busy === `join:${t.id}` ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <BtnRow
                  icon={<LogIn width={16} height={16} color={colors.primaryForeground} />}
                  color={colors.primaryForeground}
                >
                  Inscrever-me
                </BtnRow>
              )}
            </GameButton>
          ) : null}
          {t.status === 'open' && iJoined ? (
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <GameButton
                variant="outline"
                style={{ flex: 1 }}
                disabled={busy === `leave:${t.id}`}
                onPress={() => onLeave(t.id)}
              >
                <BtnRow icon={<LogOut width={16} height={16} color={colors.text} />} color={colors.text}>
                  Sair
                </BtnRow>
              </GameButton>
              {isOwner ? (
                <GameButton
                  variant="primary"
                  style={{ flex: 1 }}
                  disabled={playerCount < 2 || busy === `start:${t.id}`}
                  onPress={() => onStart(t.id)}
                >
                  {busy === `start:${t.id}` ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <BtnRow
                      icon={<Play width={16} height={16} color={colors.primaryForeground} />}
                      color={colors.primaryForeground}
                    >
                      Iniciar
                    </BtnRow>
                  )}
                </GameButton>
              ) : null}
            </View>
          ) : null}
          {t.status === 'open' && isOwner && !iJoined && playerCount >= 2 ? (
            <GameButton variant="outline" style={{ width: '100%' }} onPress={() => onStart(t.id)}>
              <BtnRow icon={<Play width={16} height={16} color={colors.text} />} color={colors.text}>
                Iniciar torneio
              </BtnRow>
            </GameButton>
          ) : null}
          {t.status === 'in_progress' && myOpen ? (
            <GameButton
              variant="primary"
              style={{ width: '100%' }}
              disabled={busy === `play:${myOpen.id}`}
              onPress={() => onPlay(myOpen.id)}
            >
              {busy === `play:${myOpen.id}` ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <BtnRow
                  icon={<Play width={16} height={16} color={colors.primaryForeground} />}
                  color={colors.primaryForeground}
                >
                  {myOpen.status === 'playing'
                    ? 'Retomar jogo'
                    : `Jogar ${roundLabel(myOpen.round, totalRounds)}`}
                </BtnRow>
              )}
            </GameButton>
          ) : null}
        </View>

        {t.status === 'in_progress' && !myOpen && iJoined ? (
          <TiraText
            size="xs"
            variant="muted"
            align="center"
            style={{ marginTop: spacing[3], fontSize: 11 }}
          >
            À espera do próximo jogo. A chave atualiza automaticamente.
          </TiraText>
        ) : null}
      </GameCard>

      {t.status === 'completed' ? (
        <GameCard
          style={{
            padding: spacing[4],
            alignItems: 'center',
            backgroundColor: alpha(colors.gold, 0.05),
            borderColor: alpha(colors.gold, 0.3),
          }}
        >
          <Crown width={32} height={32} color={colors.gold} style={{ marginBottom: spacing[2] }} />
          <TiraText
            size="xs"
            variant="muted"
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}
          >
            Campeão
          </TiraText>
          <TiraHeading level="h3" color="gold" style={{ fontSize: 22.5, letterSpacing: 0.45, lineHeight: 31.5 }}>
                {championName ?? '-'}
              </TiraHeading>
        </GameCard>
      ) : null}

      {rounds.length > 0 ? (
        <View>
          <TiraText
            size="sm"
            weight="semibold"
            variant="muted"
            style={{ marginBottom: spacing[2] }}
          >
            Chave
          </TiraText>
          <View style={{ gap: spacing[3] }}>
            {rounds.map((r) => (
              <View key={r.round}>
                <TiraText
                  size="xs"
                  variant="muted"
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  {roundLabel(r.round, totalRounds)}
                </TiraText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
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
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Editar nome e descrição — só o criador, enquanto o torneio está aberto. */
function TournamentEditForm({
  tournament,
  onDone,
}: {
  tournament: Tournament;
  onDone: () => void;
}) {
  const update = useOnlineTournaments((s) => s.update);
  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      notifyError(errorMessage('invalid_name'));
      return;
    }
    setBusy(true);
    const res = await update({
      tournamentId: tournament.id,
      name: trimmed,
      description: description.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      notifyError(errorMessage(res.code));
      return;
    }
    notifySuccess('Torneio atualizado.');
    onDone();
  };

  return (
    <View
      style={{
        marginTop: spacing[3],
        gap: spacing[2],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: alpha(colors.surface, 0.5),
        padding: spacing[3],
      }}
    >
      <TextInput
        value={name}
        maxLength={60}
        onChangeText={setName}
        placeholder="Nome do torneio"
        placeholderTextColor={colors.textMuted}
        style={{
          width: '100%',
          height: 48,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: alpha(colors.surface, 0.6),
          paddingHorizontal: spacing[3],
          color: colors.text,
          fontSize: 15.75,
          fontFamily: typography.fontFamily.body,
        }}
      />
      <TextInput
        value={description}
        maxLength={140}
        multiline
        onChangeText={setDescription}
        placeholder="Descrição (máx. 140 caracteres)"
        placeholderTextColor={colors.textMuted}
        style={{
          minHeight: 84,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: alpha(colors.surface, 0.6),
          paddingHorizontal: spacing[3],
          paddingVertical: 10,
          color: colors.text,
          fontSize: 15.75,
          textAlignVertical: 'top',
          fontFamily: typography.fontFamily.body,
        }}
      />
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <GameButton
          variant="primary"
          style={{ flex: 1, paddingHorizontal: spacing[3] }}
          disabled={busy || name.trim().length < 2}
          onPress={() => void submit()}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <BtnRow
              icon={<Check width={16} height={16} color={colors.primaryForeground} />}
              color={colors.primaryForeground}
            >
              Guardar
            </BtnRow>
          )}
        </GameButton>
        <GameButton
          variant="ghost"
          style={{ paddingHorizontal: spacing[3] }}
          disabled={busy}
          onPress={onDone}
        >
          <BtnText color={colors.text}>Cancelar</BtnText>
        </GameButton>
      </View>
    </View>
  );
}

/** Convidar amigos por notificação (criador ou inscrito, torneio aberto). */
function TournamentInviteList({
  tournament,
  joinedIds,
  onDone,
}: {
  tournament: Tournament;
  joinedIds: ReadonlySet<string>;
  onDone: () => void;
}) {
  const uid = useAuth((s) => s.user?.id ?? null);
  const invite = useOnlineTournaments((s) => s.invite);
  const friends = useFriends((s) => s.friends);
  const loaded = useFriends((s) => s.loaded);
  const loadingFriends = useFriends((s) => s.loading);
  const loadFriends = useFriends((s) => s.load);

  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded && !loadingFriends) void loadFriends();
  }, [loaded, loadingFriends, loadFriends]);

  const candidates = friends.filter((f) => f.userId !== uid && !joinedIds.has(f.userId));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const send = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    const res = await invite(tournament.id, selected);
    setBusy(false);
    if (!res.ok) {
      notifyError(errorMessage(res.code));
      return;
    }
    if (res.invited === 0) {
      notifySuccess('Nenhum convite enviado.');
    } else {
      notifySuccess(
        'Convites enviados!',
        `${res.invited} ${res.invited === 1 ? 'amigo convidado' : 'amigos convidados'}.`,
      );
    }
    setSelected([]);
    onDone();
  };

  if (candidates.length === 0) {
    return (
      <View
        style={{
          marginTop: spacing[3],
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: alpha(colors.surface, 0.5),
          padding: spacing[3],
          alignItems: 'center',
        }}
      >
        <Users width={24} height={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
        <TiraText size="xs" variant="muted" align="center" style={{ marginBottom: spacing[2] }}>
          {friends.length === 0
            ? 'Ainda não tens amigos para convidar.'
            : 'Todos os teus amigos já estão inscritos.'}
        </TiraText>
        {friends.length === 0 ? (
          <GameButton
            variant="ghost"
            style={{ height: 48, paddingHorizontal: spacing[4] }}
            onPress={() => router.push('/friends')}
          >
            <BtnRow icon={<UserPlus width={16} height={16} color={colors.text} />} color={colors.text}>
              Procurar amigos
            </BtnRow>
          </GameButton>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        marginTop: spacing[3],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: alpha(colors.surface, 0.5),
        padding: spacing[3],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
          marginBottom: spacing[2],
        }}
      >
        <TiraText size="xs" variant="muted" style={{ fontSize: 11 }}>
          {loadingFriends && !loaded
            ? 'A carregar amigos…'
            : `${candidates.length} amigos disponíveis`}
        </TiraText>
        <Pressable
          onPress={() =>
            setSelected(
              selected.length === candidates.length ? [] : candidates.map((f) => f.userId),
            )
          }
          style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing[2] }}
        >
          <TiraText size="xs" variant="gold" style={{ fontSize: 11 }}>
            {selected.length === candidates.length ? 'Limpar' : 'Selecionar todos'}
          </TiraText>
        </Pressable>
      </View>

      <ScrollView
        style={{ maxHeight: 224 }}
        contentContainerStyle={{ gap: spacing[1] }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {candidates.map((f) => {
          const isSelected = selected.includes(f.userId);
          const displayName = f.username ?? `Jogador ${f.userId.slice(0, 4)}`;
          return (
            <Pressable
              key={f.userId}
              onPress={() => toggle(f.userId)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={{
                width: '100%',
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                paddingHorizontal: spacing[2],
                borderRadius: radii.lg,
                backgroundColor: isSelected ? alpha(colors.gold, 0.15) : colors.transparent,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: radii.sm,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.gold : colors.border,
                  backgroundColor: isSelected ? colors.gold : colors.transparent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSelected ? (
                  <Check width={14} height={14} color={colors.primaryForeground} />
                ) : null}
              </View>
              <LevelAvatar name={displayName} level={f.level} size="sm" />
              <TiraText
                size="sm"
                weight="medium"
                numberOfLines={1}
                style={{ flex: 1, color: isSelected ? colors.gold : colors.text }}
              >
                {displayName}
              </TiraText>
            </Pressable>
          );
        })}
      </ScrollView>

      <GameButton
        variant="primary"
        style={{ width: '100%', marginTop: spacing[2] }}
        disabled={busy || selected.length === 0}
        onPress={() => void send()}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <BtnRow
            icon={<UserPlus width={16} height={16} color={colors.primaryForeground} />}
            color={colors.primaryForeground}
          >
            {selected.length === 0
              ? 'Seleciona amigos'
              : `Enviar convites (${selected.length})`}
          </BtnRow>
        )}
      </GameButton>
    </View>
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
  const canPlay = Boolean(
    isMine &&
      match.winnerId === null &&
      match.status === 'ready' &&
      match.p1Id &&
      match.p2Id,
  );

  return (
    <GameCard
      style={{
        width: '48%',
        padding: spacing[2],
        borderColor: match.winnerId
          ? alpha(colors.p1, 0.3)
          : isMine
            ? alpha(colors.gold, 0.3)
            : colors.border,
      }}
    >
      <View style={{ gap: spacing[1] }}>
        <Slot
          name={nameFor(match.p1Id)}
          winner={match.winnerId === match.p1Id && !!match.winnerId}
        />
        <Slot
          name={nameFor(match.p2Id)}
          winner={match.winnerId === match.p2Id && !!match.winnerId}
        />
      </View>
      {match.status === 'bye' ? (
        <TiraText
          size="xs"
          variant="muted"
          align="center"
          style={{ fontSize: 10, marginTop: spacing[1] }}
        >
          Passa direto
        </TiraText>
      ) : null}
      {canPlay ? (
        <Pressable
          disabled={busy === `play:${match.id}`}
          onPress={() => onPlay(match.id)}
          style={{
            marginTop: 6,
            width: '100%',
            height: 48,
            borderRadius: radii.md,
            backgroundColor: alpha(colors.gold, 0.15),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[1],
            opacity: busy === `play:${match.id}` ? 0.5 : 1,
          }}
        >
          {busy === `play:${match.id}` ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : (
            <Play width={12} height={12} color={colors.gold} />
          )}
          <TiraText size="xs" weight="semibold" variant="gold" style={{ fontSize: 11 }}>
            Jogar
          </TiraText>
        </Pressable>
      ) : null}
    </GameCard>
  );
}

// ============================== Torneio Semanal ==============================

function WeeklyTournament() {
  const join = useTournament((s) => s.join);
  const leave = useTournament((s) => s.leave);
  const bracket = useTournament((s) => s.bracket);
  const joined = useTournament((s) => s.joined);
  const setCurrentMatchId = useTournament((s) => s.setCurrentMatchId);

  const playNext = (source: TournamentBracket | null = bracket) => {
    if (!source) return;
    const id = getFirstHumanMatchId(source);
    if (!id) return;
    setCurrentMatchId(id);
    router.push('/tournament-play');
  };

  const handleJoin = () => {
    if (!joined) {
      join();
      // O estado do store é atualizado de forma síncrona pelo zustand.
      playNext(useTournament.getState().bracket);
      return;
    }
    playNext();
  };

  return (
    <View style={{ gap: spacing[5] }}>
      <GameCard style={{ padding: spacing[5] }} glow="gold">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trophy width={28} height={28} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <TiraHeading level="h2" style={{ letterSpacing: 0.675, lineHeight: 36 }}>TORNEIO SEMANAL</TiraHeading>
            <TiraText size="xs" variant="muted">
              Eliminatória simples • 8 jogadores
            </TiraText>
            <TiraText size="xs" variant="gold" style={{ marginTop: spacing[1] }}>
              Prémio: {bracket?.prize ?? 50000} KZ
            </TiraText>
          </View>
        </View>
        {!joined ? (
          <GameButton variant="primary" style={{ width: '100%', marginTop: spacing[4] }} onPress={handleJoin}>
            Participar agora
          </GameButton>
        ) : (
          <GameButton
            variant="primary"
            style={{ width: '100%', marginTop: spacing[4] }}
            onPress={() => playNext()}
          >
            Jogar o teu próximo jogo
          </GameButton>
        )}
      </GameCard>

      {joined && bracket ? (
        <View style={{ gap: spacing[3] }}>
          <TiraText size="sm" weight="semibold" variant="muted">
            Chave
          </TiraText>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
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
          </View>
          {bracket.status === 'completed' ? <ChampionCard bracket={bracket} /> : null}
          <GameButton variant="p2" style={{ width: '100%' }} onPress={leave}>
            Abandonar torneio
          </GameButton>
        </View>
      ) : null}
    </View>
  );
}

function ChampionCard({ bracket }: { bracket: TournamentBracket }) {
  const champion = getEntrant(bracket, bracket.matches[bracket.finalMatchId]?.winnerId);
  return (
    <GameCard
      style={{
        padding: spacing[4],
        alignItems: 'center',
        backgroundColor: alpha(colors.gold, 0.05),
        borderColor: alpha(colors.gold, 0.3),
      }}
    >
      <Trophy width={32} height={32} color={colors.gold} style={{ marginBottom: spacing[2] }} />
      <TiraText
        size="xs"
        variant="muted"
        style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}
      >
        Campeão
      </TiraText>
      <TiraHeading level="h3" color="gold" style={{ fontSize: 22.5, letterSpacing: 0.45, lineHeight: 31.5 }}>
            {champion?.name ?? '-'}
          </TiraHeading>
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
    <View style={{ flex: 1, gap: spacing[2] }}>
      <TiraText
        size="xs"
        variant="muted"
        align="center"
        style={{ fontSize: 10, textTransform: 'uppercase' }}
      >
        {title}
      </TiraText>
      {matches.map((id) => (
        <WeeklyMatchCard key={id} match={bracket.matches[id]} bracket={bracket} />
      ))}
    </View>
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
    <GameCard
      style={{
        padding: spacing[2],
        borderColor: match.winnerId ? alpha(colors.p1, 0.3) : colors.border,
      }}
    >
      <View style={{ gap: spacing[1] }}>
        <Slot name={p1?.name ?? '—'} winner={!!match.winnerId && match.winnerId === p1?.id} />
        <Slot name={p2?.name ?? '—'} winner={!!match.winnerId && match.winnerId === p2?.id} />
      </View>
    </GameCard>
  );
}

function Slot({ name, winner }: { name: string; winner?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing[1],
        paddingVertical: 2,
        borderRadius: radii.sm,
        backgroundColor: winner ? alpha(colors.p1, 0.1) : colors.transparent,
      }}
    >
      <TiraText
        size="xs"
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 11,
          color: winner ? colors.p1 : colors.textMuted,
        }}
      >
        {name}
      </TiraText>
      {winner ? <Check width={12} height={12} color={colors.p1} /> : null}
    </View>
  );
}
