import { router } from 'expo-router';
import {
  Check,
  Clock,
  Info,
  Search,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { GameButton, GameCard, LevelAvatar, SectionTitle } from '@/components/game/ui';
import { alpha, TiraScreen } from '@/components/tira';
import { toast } from '@/lib/toast';
import { useAuth } from '@/store/auth';
import { useFriends } from '@/store/friends';
import { colors, radii, spacing, typography } from '@/theme';

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

export default function FriendsScreen() {
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
      toast('Não foi possível enviar o pedido.', {
        description:
          result.code === 'unknown_user'
            ? 'Não encontrámos nenhum jogador com esse username.'
            : 'Verifica a ligação e tenta novamente.',
      });
      return;
    }
    if (result.status === 'requested') {
      toast('Pedido enviado!', { description: `Espera que ${name} aceite.` });
    } else if (result.status === 'accepted') {
      toast(`${name} já te tinha enviado um pedido — agora são amigos!`);
    } else if (result.status === 'already_friends') {
      toast('Já são amigos.');
    } else {
      toast('Já enviaste um pedido a este jogador.');
    }
    setQuery('');
  };

  return (
    <TiraScreen>
      <View>
        <Text
          style={{
            fontFamily: DISPLAY,
            fontSize: typography.fontSize['3xl'],
            letterSpacing: 0.844,
            color: colors.text,
          }}
        >
          AMIGOS
        </Text>
        <Text
          style={{
            marginTop: spacing[1],
            fontSize: typography.fontSize.sm,
            color: colors.textMuted,
            fontFamily: BODY,
          }}
        >
          Adiciona jogadores pelo username e desafia-os para uma partida.
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingHorizontal: spacing[3],
          paddingVertical: 10,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: canUse ? alpha(colors.p1, 0.3) : alpha(colors.orange, 0.3),
          backgroundColor: canUse ? alpha(colors.p1, 0.1) : alpha(colors.orange, 0.1),
        }}
      >
        {canUse ? (
          <Wifi size={16} color={colors.p1} style={{ marginTop: 2, flexShrink: 0 }} />
        ) : (
          <Info size={16} color={colors.orange} style={{ marginTop: 2, flexShrink: 0 }} />
        )}
        <Text
          style={{
            flex: 1,
            fontSize: typography.fontSize.xs,
            lineHeight: 19,
            color: canUse ? colors.p1 : colors.orange,
            fontFamily: BODY,
          }}
        >
          {canUse ? (
            <>
              <Text style={{ fontWeight: typography.fontWeight.bold }}>Amizades sincronizadas.</Text>{' '}
              Os pedidos novos aparecem aqui em tempo real.
            </>
          ) : (
            <>
              <Text style={{ fontWeight: typography.fontWeight.bold }}>
                Inicia sessão para usar amigos.
              </Text>{' '}
              Precisas de uma conta para enviar e receber pedidos.
            </>
          )}
        </Text>
      </View>

      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle title="Adicionar amigo" />
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Search
              size={16}
              color={colors.textMuted}
              style={{ position: 'absolute', left: 12, top: 16, zIndex: 1 }}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void handleAdd()}
              maxLength={40}
              editable={canUse}
              placeholder="Username do jogador…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                height: spacing[12],
                borderRadius: radii.xl,
                backgroundColor: alpha(colors.surface, 0.6),
                borderWidth: 1,
                borderColor: alpha(colors.white, 0.04),
                paddingLeft: 36,
                paddingRight: spacing[3],
                fontSize: typography.fontSize.sm,
                color: canUse ? colors.text : colors.textMuted,
                fontFamily: BODY,
              }}
            />
          </View>
          <GameButton
            variant="p1"
            onPress={() => void handleAdd()}
            disabled={!canUse || !query.trim() || sending}
            style={{ height: spacing[12], paddingHorizontal: spacing[4] }}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <UserPlus size={16} color={colors.white} />
            )}
          </GameButton>
        </View>
      </GameCard>

      {canUse && incoming.length > 0 ? (
        <View>
          <SectionTitle
            title="Pedidos recebidos"
            action={
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.gold,
                  fontFamily: BODY,
                }}
              >
                {incoming.length}
              </Text>
            }
          />
          <View style={{ gap: spacing[2] }}>
            {incoming.map((r) => (
              <GameCard
                key={r.friendshipId}
                glow="gold"
                style={{
                  padding: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                }}
              >
                <LevelAvatar name={r.username ?? undefined} level={r.level} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.text,
                      fontFamily: BODY,
                    }}
                  >
                    {r.username ?? 'Jogador'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                    <Trophy size={12} color={colors.gold} />
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        fontFamily: BODY,
                      }}
                    >
                      {r.elo} Elo
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aceitar pedido"
                  onPress={() => void accept(r.friendshipId)}
                  style={({ pressed }) => ({
                    width: spacing[12],
                    height: spacing[12],
                    borderRadius: radii.lg,
                    backgroundColor: colors.p1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Check size={16} color={colors.white} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recusar pedido"
                  onPress={() => void decline(r.friendshipId)}
                  style={({ pressed }) => ({
                    width: spacing[12],
                    height: spacing[12],
                    borderRadius: radii.lg,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <X size={16} color={colors.text} />
                </Pressable>
              </GameCard>
            ))}
          </View>
        </View>
      ) : null}

      {canUse && outgoing.length > 0 ? (
        <View>
          <SectionTitle title="Pedidos enviados" />
          <View style={{ gap: spacing[2] }}>
            {outgoing.map((r) => (
              <GameCard
                key={r.friendshipId}
                style={{
                  padding: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                }}
              >
                <LevelAvatar name={r.username ?? undefined} level={r.level} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.text,
                      fontFamily: BODY,
                    }}
                  >
                    {r.username ?? 'Jogador'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                    <Clock size={12} color={colors.textMuted} />
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        fontFamily: BODY,
                      }}
                    >
                      À espera de resposta
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar pedido"
                  onPress={() => void remove(r.userId)}
                  style={({ pressed }) => ({
                    width: spacing[12],
                    height: spacing[12],
                    borderRadius: radii.lg,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <X size={16} color={colors.text} />
                </Pressable>
              </GameCard>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <SectionTitle
          title="Os teus amigos"
          action={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
              {loading ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  fontFamily: BODY,
                }}
              >
                {friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}
              </Text>
            </View>
          }
        />
        {friends.length === 0 ? (
          <GameCard style={{ padding: spacing[6], alignItems: 'center' }}>
            <Users size={32} color={colors.textMuted} style={{ marginBottom: spacing[2] }} />
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textMuted,
                fontFamily: BODY,
                textAlign: 'center',
              }}
            >
              {canUse
                ? loaded
                  ? 'Ainda não tens amigos. Procura alguém pelo username!'
                  : 'A carregar amigos…'
                : 'Inicia sessão para ver os teus amigos.'}
            </Text>
          </GameCard>
        ) : (
          <View style={{ gap: spacing[2] }}>
            {friends.map((f) => (
              <GameCard
                key={f.friendshipId}
                style={{
                  padding: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                }}
              >
                <LevelAvatar
                  name={f.username ?? undefined}
                  level={f.level}
                  size="sm"
                  online
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.text,
                      fontFamily: BODY,
                    }}
                  >
                    {f.username ?? 'Jogador'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                    <Trophy size={12} color={colors.gold} />
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        fontFamily: BODY,
                      }}
                    >
                      {f.elo} Elo
                    </Text>
                  </View>
                </View>
                <GameButton
                  variant="ghost"
                  onPress={() => router.push('/rooms')}
                  style={{ height: spacing[12], paddingHorizontal: spacing[3] }}
                  textStyle={{ fontSize: typography.fontSize.xs }}
                >
                  Desafiar
                </GameButton>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${f.username ?? 'amigo'}`}
                  onPress={() => void remove(f.userId)}
                  style={({ pressed }) => ({
                    width: spacing[12],
                    height: spacing[12],
                    borderRadius: radii.lg,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <UserMinus size={16} color={colors.textMuted} />
                </Pressable>
              </GameCard>
            ))}
          </View>
        )}
      </View>
    </TiraScreen>
  );
}
