/**
 * Rooms — port do RoomsScreen web (sem Globe3D/Ads/Dialog de chat —
 * fora do escopo mobile nesta fase): secção online, aviso "em breve",
 * filtros, sala em destaque (Angola), lista de salas e nota da Global.
 * Entrar → Alert que redireciona para o modo offline.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { useT } from '@/lib/i18n/hook';
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

const ROOMS: Room[] = [
  {
    id: 'angola',
    name: 'Angola',
    emoji: '🇦🇴',
    tint: 'gold',
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
    tint: 'gold',
    players: 32,
    capacity: 50,
    stake: 100,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'benguela',
    name: 'Benguela',
    emoji: '🌊',
    tint: 'p1',
    players: 18,
    capacity: 40,
    stake: 50,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'huambo',
    name: 'Huambo',
    emoji: '⛰️',
    tint: 'orange',
    players: 12,
    capacity: 30,
    stake: 25,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'cabinda',
    name: 'Cabinda',
    emoji: '🌴',
    tint: 'p1',
    players: 8,
    capacity: 20,
    stake: 10,
    tags: ['all', 'online', 'bets'],
  },
  {
    id: 'global',
    name: 'Global (Free)',
    emoji: '🌍',
    tint: 'surfaceAlt',
    players: 64,
    capacity: 100,
    stake: 0,
    tags: ['all', 'online'],
  },
];

const FILTERS: { id: Filter; labelKey: 'rooms.filter.all' | 'rooms.filter.online' | 'rooms.filter.bets' | 'rooms.filter.friends' }[] = [
  { id: 'all', labelKey: 'rooms.filter.all' },
  { id: 'online', labelKey: 'rooms.filter.online' },
  { id: 'bets', labelKey: 'rooms.filter.bets' },
  { id: 'friends', labelKey: 'rooms.filter.friends' },
];

export default function RoomsScreen() {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>('all');

  const filteredRooms = useMemo(() => {
    if (filter === 'all') {
      // Em "Todas", a sala em destaque (Angola) é cartão próprio; o resto na lista.
      return ROOMS.filter((r) => !r.featured);
    }
    if (filter === 'friends') {
      // Amigos: simulado — sem salas privadas por agora.
      return [];
    }
    return ROOMS.filter((r) => r.tags.includes(filter) && !r.featured);
  }, [filter]);

  const featured = ROOMS[0]; // Angola

  const enterRoom = (room: Room) => {
    Alert.alert(t('rooms.alert.title'), t('rooms.alert.desc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('rooms.play'), onPress: () => router.push('/offline') },
    ]);
    void room;
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <TiraText size="xs" variant="p1" weight="semibold">
              {`📍 ${t('rooms.real_time')}`}
            </TiraText>
          </View>
        </View>
        <View
          style={{
            alignItems: 'center',
            gap: spacing[2],
            paddingVertical: spacing[3],
          }}
        >
          <TiraText style={{ fontSize: 44 }}>🌍</TiraText>
          <Pill>{t('common.soon')}</Pill>
        </View>
      </TiraCard>

      {/* Aviso "modo online em breve" */}
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
        <TiraText size="sm" variant="orange">
          ℹ️
        </TiraText>
        <TiraText size="xs" variant="orange" style={{ flex: 1 }}>
          {`${t('rooms.soon')} ${t('rooms.soon.desc')}`}
        </TiraText>
      </View>

      {/* Filtros */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {FILTERS.map((f) => (
          <Pill key={f.id} active={filter === f.id} onPress={() => setFilter(f.id)}>
            {t(f.labelKey)}
          </Pill>
        ))}
      </View>

      {/* Sala em destaque (Angola) */}
      {filter === 'all' ? (
        <TiraCard glow="gold" padded={false}>
          <View
            style={{
              backgroundColor: alpha(colors.gold, 0.08),
              padding: spacing[5],
              gap: spacing[4],
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: spacing[3],
                right: spacing[3],
                backgroundColor: colors.gold,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
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
                <TiraText size="xs" variant="muted">
                  {t('rooms.angola.desc')}
                </TiraText>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <TiraText size="xs" variant="muted">
                  {`👥 ${featured.players}/${featured.capacity}`}
                </TiraText>
                <TiraText size="xs" variant="gold" weight="semibold">
                  {`🪙 ${featured.stake} KZ`}
                </TiraText>
              </View>
              <TiraButton variant="gold" size="sm" onPress={() => enterRoom(featured)}>
                {`🔑 ${t('rooms.enter')}`}
              </TiraButton>
            </View>
          </View>
        </TiraCard>
      ) : null}

      {/* Lista de salas */}
      <View style={{ gap: spacing[2] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TiraHeading level="h3">
            {filter === 'friends' ? t('rooms.friends') : t('rooms.all')}
          </TiraHeading>
          <TiraText size="xs" variant="muted">
            {t('rooms.count', { n: filteredRooms.length })}
          </TiraText>
        </View>
        {filteredRooms.length === 0 ? (
          <TiraCard>
            <TiraText size="sm" variant="muted" align="center">
              {t('rooms.empty')}
            </TiraText>
          </TiraCard>
        ) : (
          filteredRooms.map((room) => <RoomCard key={room.id} room={room} onEnter={() => enterRoom(room)} />)
        )}
      </View>

      {/* Nota da Sala Global */}
      {filter === 'all' ? (
        <TiraText size="xs" variant="muted" align="center">
          {t('rooms.global_note')}
        </TiraText>
      ) : null}
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
      {/* Miniatura */}
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
          <TiraText size="sm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {room.name}
          </TiraText>
          {full ? (
            <View
              style={{
                backgroundColor: colors.p2,
                borderRadius: radii.sm,
                paddingHorizontal: spacing[1],
                paddingVertical: 1,
              }}
            >
              <TiraText size="xs" weight="bold" variant="inverse" style={{ fontSize: 8 }}>
                {t('rooms.full')}
              </TiraText>
            </View>
          ) : null}
          {room.stake === 0 ? (
            <View
              style={{
                backgroundColor: alpha(colors.p1, 0.15),
                borderRadius: radii.sm,
                paddingHorizontal: spacing[1],
                paddingVertical: 1,
              }}
            >
              <TiraText size="xs" weight="bold" variant="p1" style={{ fontSize: 8 }}>
                {t('rooms.free')}
              </TiraText>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <TiraText size="xs" variant="muted">
            {`👥 ${room.players}/${room.capacity}`}
          </TiraText>
          <TiraText size="xs" variant={room.stake === 0 ? 'muted' : 'gold'} weight="semibold">
            {room.stake === 0 ? t('rooms.no_stake') : `🪙 ${room.stake} KZ`}
          </TiraText>
        </View>
        {/* Barra de ocupação */}
        <View
          style={{
            height: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceAlt,
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: radii.pill,
              backgroundColor: colors[barColor],
            }}
          />
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
