/**
 * Welcome — port fiel do WelcomeScreen web (ecrã full-screen, sem chrome
 * global): padrão de fundo, brilho superior, logo, título, benefícios e CTAs.
 */
import { router } from 'expo-router';
import { Bot, Gift, Swords, Users } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, Line, Pattern, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { GameButton, GameLogo } from '@/components/game/ui';
import { TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { motion } from '@/lib/motion';
import { colors, radii, spacing, typography } from '@/theme';

const BODY = typography.fontFamily.body;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <TiraScreen
      chrome={false}
      style={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing[6],
        paddingTop: spacing[10],
        paddingBottom: spacing[10] + insets.bottom,
        gap: 0,
      }}
    >
      <WelcomeBackdrop />

      {/* Logo + título */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ alignItems: 'center', gap: spacing[3], marginBottom: spacing[8] }}
      >
        <GameLogo size="lg" />
        <TiraHeading level="h1" align="center" style={{ marginTop: spacing[3], letterSpacing: 1.0125, lineHeight: 40.5 }}>
          TIRA O COCÓ DO MEIO
        </TiraHeading>
        <TiraText variant="gold" size="md" weight="medium">
          Joga, desafia, ganha!
        </TiraText>
      </motion.div>

      {/* Descrição */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ alignSelf: 'center', maxWidth: 320, marginBottom: spacing[6] }}
      >
        <TiraText size="sm" variant="muted" align="center">
          O clássico jogo de estratégia angolano. Agora online, com pessoas reais!
        </TiraText>
      </motion.div>

      {/* Benefícios */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ width: '100%', gap: 10, marginBottom: spacing[8] }}
      >
        <BenefitRow icon={<Bot size={16} color={colors.gold} />} text="Joga online ou offline" />
        <BenefitRow icon={<Users size={16} color={colors.gold} />} text="Salas e torneios" />
        <BenefitRow icon={<Gift size={16} color={colors.gold} />} text="Bónus e modo gratuito" />
      </motion.div>

      {/* Ações */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{ width: '100%', gap: 10 }}
      >
        <GameButton
          variant="primary"
          style={{ width: '100%', height: spacing[12] }}
          onPress={() => router.push('/auth')}
          accessibilityLabel="Criar conta"
        >
          <Swords size={20} color={colors.primaryForeground} />
          <Text style={{ fontSize: 15.75, fontWeight: '600', color: colors.primaryForeground, fontFamily: BODY }}>
            Criar conta
          </Text>
        </GameButton>
        <GameButton
          variant="outline"
          style={{ width: '100%', height: spacing[12] }}
          textStyle={{ fontSize: 15.75 }}
          onPress={() => router.push('/auth')}
          accessibilityLabel="Entrar"
        >
          Entrar
        </GameButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuar como convidado"
          onPress={() => router.push('/')}
          style={{ width: '100%', paddingVertical: 10 }}
        >
          <Text style={{ textAlign: 'center', fontSize: 15.75, color: colors.textMuted, fontFamily: BODY }}>
            Continuar como convidado
          </Text>
        </Pressable>
      </motion.div>

      {/* Nota */}
      <TiraText
        size="xs"
        variant="muted"
        align="center"
        style={{ marginTop: spacing[6], maxWidth: 320, alignSelf: 'center' }}
      >
        Bónus de boas-vindas até 5.000 KZ. Moeda virtual, sem dinheiro real.
      </TiraText>
    </TiraScreen>
  );
}

/** Padrão geométrico + brilho superior (réplica do `.angolan-pattern` e do
 *  radial-gradient do topo da web). */
function WelcomeBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="angolan" patternUnits="userSpaceOnUse" width={30} height={30}>
            <Line
              x1={0}
              y1={0}
              x2={30}
              y2={30}
              stroke={colors.gold}
              strokeWidth={2.4}
              strokeOpacity={0.018}
            />
            <Line
              x1={0}
              y1={30}
              x2={30}
              y2={0}
              stroke={colors.gold}
              strokeWidth={2.4}
              strokeOpacity={0.018}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#angolan)" />
      </Svg>

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 288 }}>
        <Svg width="100%" height={288}>
          <Defs>
            <RadialGradient id="welcomeGlow" cx="50%" cy="0%" r="70%">
              <Stop offset="0" stopColor={colors.gold} stopOpacity={0.1} />
              <Stop offset="0.7" stopColor={colors.gold} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#welcomeGlow)" />
        </Svg>
      </View>
    </View>
  );
}

function BenefitRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        borderRadius: radii.cardLg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.xl,
          backgroundColor: alpha(colors.gold, 0.12),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 15.75, fontWeight: '500', color: colors.text, fontFamily: BODY }}>
        {text}
      </Text>
    </View>
  );
}
