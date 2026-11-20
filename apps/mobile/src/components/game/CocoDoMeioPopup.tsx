import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, View, type ViewStyle } from 'react-native';
import { alpha } from '@/components/tira/alpha';
import { playSound } from '@/lib/sound';
import { useSettings } from '@/store/settings';
import { colors, radii, spacing, typography } from '@/theme';

const MESSAGES = [
  '🥥 Tira o coco do meio!',
  'Só te resta sair do meio!',
  'Tira o coco do meio, rápido!',
] as const;

const useNativeDriver = Platform.OS !== 'web';

export function CocoDoMeioPopup({ active }: { active: boolean }) {
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const [activation, setActivation] = useState(0);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active && !wasActive.current) {
      setActivation((v) => v + 1);
      playSound('coco');
    }
    wasActive.current = active;
  }, [active]);

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 96,
        zIndex: 60,
        alignItems: 'center',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
      }}
    >
      {MESSAGES.map((message, index) => (
        <PopupMessage
          key={`${activation}-${index}`}
          message={message}
          index={index}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

function PopupMessage({
  message,
  index,
  reduceMotion,
}: {
  message: string;
  index: number;
  reduceMotion: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(reduceMotion ? 0 : 40));
  const [scale] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.9));

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }

    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay: index * 250,
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: index * 250,
        useNativeDriver,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 320,
        delay: index * 250,
        useNativeDriver,
      }),
    ]);

    let pulse: Animated.CompositeAnimation | null = null;
    entrance.start(({ finished }) => {
      if (!finished) return;
      pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0.55, duration: 520, useNativeDriver }),
            Animated.timing(translateY, { toValue: -8, duration: 520, useNativeDriver }),
            Animated.timing(scale, { toValue: 0.97, duration: 520, useNativeDriver }),
          ]),
          Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver }),
            Animated.timing(translateY, { toValue: 0, duration: 520, useNativeDriver }),
            Animated.timing(scale, { toValue: 1, duration: 520, useNativeDriver }),
          ]),
        ]),
      );
      pulse.start();
    });

    return () => {
      entrance.stop();
      pulse?.stop();
    };
  }, [index, reduceMotion, opacity, translateY, scale]);

  const style: ViewStyle = {
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: alpha(colors.gold, 0.85),
    backgroundColor: alpha(colors.bg, 0.92),
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  };

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY }, { scale }] }]}
      accessibilityRole="text"
    >
      <Text
        style={{
          color: colors.gold,
          fontFamily: typography.fontFamily.display,
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.bold,
          letterSpacing: 0.5,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}
