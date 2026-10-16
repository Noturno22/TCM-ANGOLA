/**
 * Rooms — port do RoomsScreen web (sem Globe3D/Ads/Dialog de chat).
 *
 * Quando o backend está configurado, carrega o catálogo real de salas da BD e
 * o botão "Entrar" passa pelo fluxo online: sessão → saldo → gate 18+ (salas
 * com aposta) → fila de matchmaking → partida ao vivo. Sem backend, mantém as
 * salas simuladas e reencaminha para o modo offline.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Pill,
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { AgeGateSheet } from '@/components/tira/AgeGateSheet';
import type { RoomSummary } from '@/lib/online/rooms';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useT } from '@/lib/i18n/hook';
import { useAge } from '@/store/age';
import { useAuth } from '@/store/auth';
import { useMatch } from '@/store/match';
import { useOnlineRooms } from '@/store/onlineRooms';
import { useProfile } from '@/store/profile';
import { colors, radii, spacing, type ColorToken } from '@/theme';

type Filter = 'all' | 'online' | 'bets' | 'friends';

interface Room {
  id: string;
  name: string;
  emoji: string;
  tint: ColorToken;
  players: number;
  capacity: number;
  stake: number;
  featured?: boolean;
  tags: Filter[];
}

/** Metadados visuais das salas conhecidas (emoji/cor/jogadores simulados). */
const ROOM_META: Record<string, { emoji: string; tint: ColorToken; players: number }> = {
  angola: { emoji: '🇦🇴', tint: 'gold', players: 47 },
  luanda: { emoji: '🏙️', tint: 'gold', players: 32 },
  benguela: { emoji: '🌊', tint: 'p1', players: 18 },
  huambo: { emoji: '⛰️', tint: 'orange', players: 12 },
  cabinda: { emoji: '🌴', tint: 'p1', players: 8 },
  global: { emoji: '🌍', tint: 'surfaceAlt', players: 64 },
  portugal: { emoji: '🇵🇹', tint: 'gold', players: 24 },
  brasil: { emoji: '🇧🇷', tint: 'p1', players: 38 },
  mocambique: { emoji: '🇲🇿', tint: 'orange', players: 14 },
  caboverde: { emoji: '🇨🇻', tint: 'p1', players: 9 },
  africa: { emoji: '🌍', tint: 'gold', players: 41 },
  europa: { emoji: '🇪🇺', tint: 'p1', players: 27 },
  america: { emoji: '🌎', tint: 'orange', players: 22 },
  mundo: { emoji: '🌐', tint: 'surfaceAlt', players: 55 },
};

const FALLBACK_ROOMS: Room[] = [
  { id: 'angola', name: 'Angola', emoji: '🇦🇴', tint: 'gold', players: 47, capacity: 50, stake: 200, featured: true, tags: ['all', 'online', 'bets'] },
  { id: 'luanda', name: 'Luanda', emoji: '🏙️', tint: 'gold', players: 32, capacity: 50, stake: 100, tags: ['all', 'online', 'bets'] },
  { id: 'benguela', name: 'Benguela', emoji: '🌊', tint: 'p1', players: 18, capacity: 40, stake: 50, tags: ['all', 'online', 'bets'] },
  { id: 'huambo', name: 'Huambo', emoji: '⛰️', tint: 'orange', players: 12, capacity: 30, stake: 25, tags: ['all', 'online', 'bets'] },
  { id: 'cabinda', name: 'Cabinda', emoji: '🌴', tint: 'p1', players: 8, capacity: 20, stake: 10, tags: ['all', 'online', 'bets'] },
  { id: 'global', name: 'Global (Free)', emoji: '🌍', tint: 'surfaceAlt', players: 64, capacity: 100, stake: 0, tags: ['all', 'online'] },
];

const FILTERS: { id: Filter; labelKey: 'rooms.filter.all' | 'rooms.filter.online' | 'rooms.filter.bets' | 'rooms.filter.friends' }[] = [
  { id: 'all', labelKey: 'rooms.filter.all' },
  { id: 'online', labelKey: 'rooms.filter.online' },
  { id: 'bets', labelKey: 'rooms.filter.bets' },
  { id: 'friends', labelKey: 'rooms.filter.friends' },
];

/** Converte uma sala da BD na forma de apresentação. */
function toDisplayRoom(r: RoomSummary): Room {
  const meta = ROOM_META[r.id] ?? { emoji: r.region === 'international' ? '🌍' : '🎲', tint: 'surfaceAlt' as ColorToken, players: 0 };
  return {
    id: r.id,
    name: r.name,
    emoji: meta.emoji,
    tint: meta.tint,
    players: meta.players,
    capacity: r.capacity,
    stake: r.stake,
    featured: r.isFeatured,
    tags: r.stake > 0 ? ['all', 'online', 'bets'] : ['all', 'online'],
  };
}

export default function RoomsScreen() {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const [ageRoom, setAgeRoom] = useState<Room | null>(null);

  const dbRooms = useOnlineRooms((s) => s.rooms);
  const loadRooms = useOnlineRooms((s) => s.loadRooms);
  const user = useAuth((s) => s.user);
  const isAdult = useAge((s) => s.isAdult);
  const coins = useProfile((s) => s.coins);
  const joinQueue = useMatch((s) => s.joinQueue);

  useEffect(() => {
    if (isSupabaseConfigured) void loadRooms();
  }, [loadRooms]);

  const rooms = useMemo<Room[]>(
    () => (dbRooms.length > 0 ? dbRooms.map(toDisplayRoom) : FALLBACK_ROOMS),
    [dbRooms],
  );

  const featured = rooms.find((r) => r.featured) ?? rooms[0];
  const filteredRooms = useMemo(() => {
    if (filter === 'all') return rooms.filter((r) => !r.featured);
    if (filter === 'friends') return [];
    return rooms.filter((r) => r.tags.includes(filter) && !r.featured);
  }, [filter, rooms]);

  /** Fluxo online: sessão → saldo → gate 18+ → fila → partida. */
  const proceedPlay = (room: Room) => {
    if (room.stake > 0 && !isAdult) {
      setAgeRoom(room);
      return;
    }
    if (room.stake > 0 && coins < room.stake) {
      Alert.alert('Moedas insuficientes', `Precisas de ${room.stake} KZ para apostar nesta sala.`);
      return;
    }
    void joinQueue(room.id, room.stake);
    router.push('/match');
  };

  const handlePlay = (room: Room) => {
    if (!isSupabaseConfigured) {
      Alert.alert(t('rooms.alert.title'), t('rooms.alert.desc'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('rooms.play'), onPress: () => router.push('/offline') },
      ]);
      return;
    }
    if (!user) {
      Alert.alert('Entrar para jogar', 'Precisas de sessão para jogar online.', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Entrar', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    proceedPlay(room);
  };

  return (
    <TiraScreen title={t('nav.rooms')} subtitle={t('rooms.subtitle')} showBack>
      {/* Jogadores online (substitui Globe3D) */}
      <TiraCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[3],
          }}
        >
          <TiraHeading level="h3">{t('rooms.online')}</TiraHeading>
          <TiraText size="xs" variant="p1" weight="semibold">
            {`📍 ${t('rooms.real_time')}`}
          </TiraText>
        </View>
        <View style={{ alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] }}>
          <TiraText style={{ fontSize: 44 }}>🌍</TiraText>
          {isSupabaseConfigured ? (
            <Pill active>{`🟢 ${dbRooms.length} ${t('rooms.all')}`}</Pill>
          ) : (
            <Pill>{t('common.soon')}</Pill>
          )}
        </View>
      </TiraCard>

      {/* Aviso quando não há backend */}
      {!isSupabaseConfigured ? (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing[3],
            padding: spacing[3],
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: alpha(colors.orange, 0.3),
            backgroundColor: alpha(colors.orange, 0.1),
          }}
        >
          <TiraText size="sm" variant="orange">ℹ️</TiraText>
          <TiraText size="xs" variant="orange" style={{ flex: 1 }}>
            {`${t('rooms.soon')} ${t('rooms.soon.desc')}`}
          </TiraText>
        </View>
      ) : null}

      {/* Filtros */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {FILTERS.map((f) => (
          <Pill key={f.id} active={filter === f.id} onPress={() => setFilter(f.id)}>
            {t(f.labelKey)}
          </Pill>
        ))}
      </View>

      {/* Sala em destaque */}
      {filter === 'all' && featured ? (
        <TiraCard glow="gold" padded={false}>
          <View style={{ backgroundColor: alpha(colors.gold, 0.08), padding: spacing[5], gap: spacing[4] }}>
            <View
              style={{
                position: 'absolute',
                top: spacing[3],
                right: spacing[3],
                backgroundColor: colors.gold,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
              }}
            >
              <TiraText size="xs" weight="bold" variant="inverse" style={{ textTransform: 'uppercase' }}>
                {`✨ ${t('rooms.featured')}`}
              </TiraText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radii.xl,
                  backgroundColor: alpha(colors.bg, 0.3),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TiraText style={{ fontSize: 32 }}>{featured.emoji}</TiraText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <TiraText size="xs" variant="gold" weight="bold" style={{ textTransform: 'uppercase' }}>
                  {t('rooms.official')}
                </TiraText>
                <TiraHeading level="h2">{featured.name.toUpperCase()}</TiraHeading>
                <TiraText size="xs" variant="muted">{t('rooms.angola.desc')}</TiraText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <TiraText size="xs" variant="muted">{`👥 ${featured.players}/${featured.capacity}`}</TiraText>
                <TiraText size="xs" variant="gold" weight="semibold">{`🪙 ${featured.stake} KZ`}</TiraText>
              </View>
              <TiraButton variant="gold" size="sm" onPress={() => handlePlay(featured)}>
                {`🔑 ${t('rooms.enter')}`}
              </TiraButton>
            </View>
          </View>
        </TiraCard>
      ) : null}

      {/* Lista de salas */}
      <View style={{ gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TiraHeading level="h3">{filter === 'friends' ? t('rooms.friends') : t('rooms.all')}</TiraHeading>
          <TiraText size="xs" variant="muted">{t('rooms.count', { n: filteredRooms.length })}</TiraText>
        </View>
        {filteredRooms.length === 0 ? (
          <TiraCard>
            <TiraText size="sm" variant="muted" align="center">{t('rooms.empty')}</TiraText>
          </TiraCard>
        ) : (
          filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} onEnter={() => handlePlay(room)} />
          ))
        )}
      </View>

      {filter === 'all' ? (
        <TiraText size="xs" variant="muted" align="center">{t('rooms.global_note')}</TiraText>
      ) : null}

      <AgeGateSheet
        visible={ageRoom !== null}
        onClose={() => setAgeRoom(null)}
        onVerified={() => {
          const room = ageRoom;
          setAgeRoom(null);
          if (room) proceedPlay(room);
        }}
      />
    </TiraScreen>
  );
}

function RoomCard({ room, onEnter }: { room: Room; onEnter: () => void }) {
  const { t } = useT();
  const pct = Math.round((room.players / room.capacity) * 100);
  const full = room.players >= room.capacity;
  const barColor: ColorToken = pct > 90 ? 'p2' : pct > 60 ? 'gold' : 'p1';
  return (
    <TiraCard style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radii.xl,
          backgroundColor: alpha(colors[room.tint], 0.15),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TiraText style={{ fontSize: 24 }}>{room.emoji}</TiraText>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <TiraText size="sm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{room.name}</TiraText>
          {full ? (
            <View style={{ backgroundColor: colors.p2, borderRadius: radii.sm, paddingHorizontal: spacing[1], paddingVertical: 1 }}>
              <TiraText size="xs" weight="bold" variant="inverse" style={{ fontSize: 8 }}>{t('rooms.full')}</TiraText>
            </View>
          ) : null}
          {room.stake === 0 ? (
            <View style={{ backgroundColor: alpha(colors.p1, 0.15), borderRadius: radii.sm, paddingHorizontal: spacing[1], paddingVertical: 1 }}>
              <TiraText size="xs" weight="bold" variant="p1" style={{ fontSize: 8 }}>{t('rooms.free')}</TiraText>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <TiraText size="xs" variant="muted">{`👥 ${room.players}/${room.capacity}`}</TiraText>
          <TiraText size="xs" variant={room.stake === 0 ? 'muted' : 'gold'} weight="semibold">
            {room.stake === 0 ? t('rooms.no_stake') : `🪙 ${room.stake} KZ`}
          </TiraText>
        </View>
        <View style={{ height: 4, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginTop: 2 }}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: radii.pill, backgroundColor: colors[barColor] }} />
        </View>
      </View>

      <TiraButton
        variant="p1"
        size="sm"
        disabled={full}
        onPress={onEnter}
        accessibilityLabel={`${t('rooms.enter')} — ${room.name}`}
      >
        {`🔑 ${t('rooms.enter')}`}
      </TiraButton>
    </TiraCard>
  );
}
