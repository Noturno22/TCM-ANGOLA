/** Mini-logo 3×3 (grelha p1/surf/p2 com alvo dourado ao centro). */
import { View } from 'react-native';
import { colors, radii } from '@/theme';

export function TiraLogo({ size = 40 }: { size?: number }) {
  const cell = (size - 2) / 3; // gap de 1 entre células
  const cells: ('p1' | 'surfaceAlt' | 'p2')[] = [
    'p1',
    'p1',
    'p1',
    'surfaceAlt',
    'surfaceAlt',
    'surfaceAlt',
    'p2',
    'p2',
    'p2',
  ];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.lg,
        borderWidth: 2,
        borderColor: colors.gold,
        overflow: 'hidden',
        backgroundColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
        {cells.map((c, i) => (
          <View
            key={i}
            style={{
              width: cell,
              height: cell,
              backgroundColor: colors[c],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i === 4 ? (
              <View
                style={{
                  width: cell * 0.55,
                  height: cell * 0.55,
                  borderRadius: radii.pill,
                  borderWidth: 1.5,
                  borderColor: colors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: cell * 0.18,
                    height: cell * 0.18,
                    borderRadius: radii.pill,
                    backgroundColor: colors.gold,
                  }}
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
