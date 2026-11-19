/**
 * Área reservada para anúncios — espelho do `AdSlot` web (placeholder
 * discreto; em produção substituir por AdMob/AdSense nativo).
 */
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { alpha } from '@/components/tira/alpha';
import { colors, radii, typography } from '@/theme';

export type AdFormat = 'banner-top' | 'banner-inline' | 'square' | 'responsive';

const HEIGHTS: Record<AdFormat, number> = {
  'banner-top': 90,
  'banner-inline': 100,
  square: 250,
  responsive: 120,
};

export interface AdSlotProps {
  format?: AdFormat;
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AdSlot({ format = 'responsive', showLabel = true, style }: AdSlotProps) {
  return (
    <View
      accessibilityLabel="Espaço publicitário"
      style={[
        {
          width: '100%',
          height: HEIGHTS[format],
          borderRadius: radii.lg,
          backgroundColor: alpha(colors.surfaceAlt, 0.5),
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        format === 'square' ? { maxWidth: 300, alignSelf: 'center' } : null,
        style,
      ]}
    >
      {showLabel ? (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              fontWeight: typography.fontWeight.semibold,
              color: colors.textMuted,
              fontFamily: typography.fontFamily.body,
            }}
          >
            Anúncio
          </Text>
          <Text
            style={{
              fontSize: 8,
              color: colors.textMuted,
              fontFamily: typography.fontFamily.body,
            }}
          >
            Google Ads
          </Text>
        </View>
      ) : null}
    </View>
  );
}
