import { Check, Coins, Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { Defs, G, Line, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { alpha, TiraScreen } from '@/components/tira';
import {
  BOARD_BACKGROUNDS,
  LINE_STYLES,
  PIECE_STYLES,
  type BoardBackgroundDef,
  type LineStyleDef,
  type PieceStyleDef,
} from '@/lib/cosmetics';
import { toast } from '@/lib/toast';
import { useProfile } from '@/store/profile';
import { useSettings, type CosmeticKind } from '@/store/settings';
import { colors, radii, spacing, typography } from '@/theme';

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

const SOLID_BACKGROUNDS: Record<string, string> = {
  bg_white: colors.surfaceAlt,
  bg_paper: '#FAF7F0',
  bg_diamond: '#F4F1E8',
};

const GRADIENT_BACKGROUNDS: Record<string, { offset: string; color: string }[]> = {
  bg_sunset: [
    { offset: '0', color: '#FFF3E0' },
    { offset: '0.55', color: '#FFCC80' },
    { offset: '1', color: '#FF8A65' },
  ],
  bg_night: [
    { offset: '0', color: '#10141C' },
    { offset: '0.6', color: '#1B2233' },
    { offset: '1', color: '#26324A' },
  ],
};

const LINE_COORDS: readonly [number, number, number, number][] = [
  [14, 14, 66, 14],
  [14, 40, 66, 40],
  [14, 66, 66, 66],
  [14, 14, 14, 66],
  [40, 14, 40, 66],
  [66, 14, 66, 66],
  [14, 14, 66, 66],
  [66, 14, 14, 66],
];

const PREVIEW_BOX: ViewStyle = {
  height: 80,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: colors.border,
  overflow: 'hidden',
};

export default function ShopScreen() {
  const coins = useProfile((s) => s.coins);
  const spendCoins = useProfile((s) => s.spendCoins);
  const owned = useSettings((s) => s.ownedCosmetics);
  const backgroundId = useSettings((s) => s.backgroundId);
  const lineStyleId = useSettings((s) => s.lineStyleId);
  const pieceStyleId = useSettings((s) => s.pieceStyleId);
  const ownCosmetic = useSettings((s) => s.ownCosmetic);
  const equipCosmetic = useSettings((s) => s.equipCosmetic);

  const ownedSet = new Set(owned);
  const equippedId: Record<CosmeticKind, string> = {
    background: backgroundId,
    line: lineStyleId,
    piece: pieceStyleId,
  };

  const handleAction = (kind: CosmeticKind, id: string, price: number) => {
    if (ownedSet.has(id)) {
      equipCosmetic(kind, id);
      toast('Cosmético equipado');
      return;
    }
    if (!spendCoins(price)) {
      toast('KZ insuficiente', { description: 'Ganha mais KZ jogando partidas.' });
      return;
    }
    ownCosmetic(id);
    equipCosmetic(kind, id);
    toast('Comprado e equipado!', { description: `-${price} KZ` });
  };

  return (
    <TiraScreen>
      <View style={{ gap: spacing[6] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing[3],
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                  fontFamily: DISPLAY,
                  fontSize: typography.fontSize['3xl'],
                  letterSpacing: 0.844,
                color: colors.text,
              }}
            >
              LOJA
            </Text>
            <Text
              style={{
                marginTop: spacing[1],
                fontSize: typography.fontSize.sm,
                color: colors.textMuted,
                fontFamily: BODY,
              }}
            >
              Personaliza o teu tabuleiro, linhas e peças.
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              paddingLeft: spacing[3],
              paddingRight: 6,
              paddingVertical: spacing[2],
              flexShrink: 0,
            }}
          >
            <Coins size={16} color={colors.gold} />
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.text,
                fontVariant: ['tabular-nums'],
                fontFamily: BODY,
              }}
            >
              {coins.toLocaleString('pt-PT')}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: typography.fontWeight.medium,
                color: colors.textMuted,
                fontFamily: BODY,
              }}
            >
              KZ
            </Text>
          </View>
        </View>

        <Section title="Fundos do tabuleiro">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {BOARD_BACKGROUNDS.map((item) => (
              <View key={item.id} style={{ width: '48%' }}>
                <ShopItem
                  name={item.name}
                  price={item.price}
                  owned={ownedSet.has(item.id)}
                  equipped={equippedId.background === item.id}
                  canAfford={coins >= item.price}
                  preview={<BackgroundPreview def={item} />}
                  onAction={() => handleAction('background', item.id, item.price)}
                />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Estilo das linhas">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {LINE_STYLES.map((item) => (
              <View key={item.id} style={{ width: '48%' }}>
                <ShopItem
                  name={item.name}
                  price={item.price}
                  owned={ownedSet.has(item.id)}
                  equipped={equippedId.line === item.id}
                  canAfford={coins >= item.price}
                  preview={<LinePreview def={item} />}
                  onAction={() => handleAction('line', item.id, item.price)}
                />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Estilo das peças">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {PIECE_STYLES.map((item) => (
              <View key={item.id} style={{ width: '48%' }}>
                <ShopItem
                  name={item.name}
                  price={item.price}
                  owned={ownedSet.has(item.id)}
                  equipped={equippedId.piece === item.id}
                  canAfford={coins >= item.price}
                  preview={<PiecePreview def={item} />}
                  onAction={() => handleAction('piece', item.id, item.price)}
                />
              </View>
            ))}
          </View>
        </Section>

        <Text
          style={{
            paddingTop: spacing[2],
            fontSize: 10,
            lineHeight: 16,
            color: colors.textMuted,
            fontFamily: BODY,
            textAlign: 'center',
          }}
        >
          Os cosméticos gratuitos estão sempre disponíveis. Ganhas KZ a cada partida jogada.
        </Text>
      </View>
    </TiraScreen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <SectionTitle title={title} />
      {children}
    </View>
  );
}

function ShopItem({
  name,
  price,
  owned,
  equipped,
  canAfford,
  preview,
  onAction,
}: {
  name: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  preview: ReactNode;
  onAction: () => void;
}) {
  return (
    <GameCard
      glow={equipped ? 'gold' : null}
      style={{
        padding: spacing[3],
        gap: spacing[3],
        borderColor: equipped ? alpha(colors.gold, 0.6) : alpha(colors.white, 0.04),
      }}
    >
      <View style={{ position: 'relative' }}>
        {preview}
        {equipped ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 24,
              height: 24,
              borderRadius: radii.pill,
              backgroundColor: colors.gold,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Check size={14} color={colors.primaryForeground} />
          </View>
        ) : null}
      </View>

      <Text
        numberOfLines={2}
        style={{
          minHeight: 36,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          lineHeight: 18,
          color: colors.text,
          fontFamily: BODY,
        }}
      >
        {name}
      </Text>

      {equipped ? (
        <View
          style={{
            height: 40,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[1],
            borderRadius: radii.xl,
            backgroundColor: alpha(colors.gold, 0.15),
          }}
        >
          <Check size={16} color={colors.gold} />
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontWeight: typography.fontWeight.semibold,
              color: colors.gold,
              fontFamily: BODY,
            }}
          >
            Equipado
          </Text>
        </View>
      ) : owned ? (
        <GameButton
          variant="outline"
          onPress={onAction}
          style={{ width: '100%', height: spacing[12] }}
          textStyle={{ fontSize: typography.fontSize.xs }}
        >
          Equipar
        </GameButton>
      ) : (
        <GameButton
          variant="primary"
          onPress={onAction}
          disabled={!canAfford}
          style={{ width: '100%', height: spacing[12] }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
            {canAfford ? (
              <Coins size={14} color={colors.primaryForeground} />
            ) : (
              <Lock size={14} color={colors.primaryForeground} />
            )}
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                fontWeight: typography.fontWeight.semibold,
                color: colors.primaryForeground,
                fontFamily: BODY,
              }}
            >
              {`${price} KZ`}
            </Text>
          </View>
        </GameButton>
      )}
    </GameCard>
  );
}

function BackgroundPreview({ def }: { def: BoardBackgroundDef }) {
  const stops = GRADIENT_BACKGROUNDS[def.id];
  if (stops) {
    const gradientId = `bg-${def.id}`;
    return (
      <View style={PREVIEW_BOX}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient
              id={gradientId}
              x1={0}
              y1={0}
              x2={0}
              y2={100}
              gradientUnits="userSpaceOnUse"
            >
              {stops.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill={`url(#${gradientId})`} />
        </Svg>
      </View>
    );
  }

  return (
    <View style={PREVIEW_BOX}>
      <View style={{ flex: 1, backgroundColor: SOLID_BACKGROUNDS[def.id] ?? colors.surface }} />
    </View>
  );
}

function LinePreview({ def }: { def: LineStyleDef }) {
  const stroke = def.stroke === 'var(--board-line)' ? colors.textMuted : def.stroke;
  const dash = def.strokeDasharray
    ? def.strokeDasharray
        .split(/\s+/)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : undefined;
  const linecap = (def.strokeLinecap ?? 'round') as 'butt' | 'round' | 'square';

  return (
    <View
      style={[
        PREVIEW_BOX,
        {
          backgroundColor: colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Svg width={64} height={64} viewBox="0 0 80 80">
        <G
          stroke={stroke}
          strokeWidth={def.strokeWidth * 0.25}
          strokeLinecap={linecap}
          strokeDasharray={dash}
        >
          {LINE_COORDS.map(([x1, y1, x2, y2], index) => (
            <Line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

function PiecePreview({ def }: { def: PieceStyleDef }) {
  const p1 = cssBackgroundColor(def.p1, colors.p1);
  const p2 = cssBackgroundColor(def.p2, colors.p2);

  return (
    <View
      style={[
        PREVIEW_BOX,
        {
          backgroundColor: colors.surfaceAlt,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[3],
        },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: p1,
          borderWidth: 1,
          borderColor: 'rgba(0, 0, 0, 0.25)',
        }}
      />
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: p2,
          borderWidth: 1,
          borderColor: 'rgba(0, 0, 0, 0.25)',
        }}
      />
    </View>
  );
}

function cssBackgroundColor(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'backgroundColor' in value) {
    const background = (value as { backgroundColor?: unknown }).backgroundColor;
    if (typeof background === 'string') return background;
  }
  return fallback;
}
