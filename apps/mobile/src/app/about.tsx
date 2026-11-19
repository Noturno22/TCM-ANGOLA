/**
 * Sobre — port fiel do AboutScreen web: hero (logo/título/slogan), cartão de
 * identidade, sobre o jogo, identidade cultural angolana, ações rápidas e
 * créditos.
 */
import { router } from 'expo-router';
import { BookOpen, GraduationCap, Heart, Hash, Info, MapPin, Tag } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { motion } from '@/lib/motion';
import { GameButton, GameCard, GameLogo, SectionTitle } from '@/components/game/ui';
import { TiraScreen, alpha } from '@/components/tira';
import { colors, radii, spacing, typography } from '@/theme';

export default function AboutScreen() {
  return (
    <TiraScreen>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ alignItems: 'center', paddingTop: spacing[2] }}
      >
        <GameLogo size="md" />
        <Text
          style={{
            marginTop: spacing[3],
            color: colors.text,
            fontFamily: typography.fontFamily.display,
            fontSize: typography.fontSize['3xl'],
            letterSpacing: 1.6875,
            lineHeight: 33.75,
            textAlign: 'center',
          }}
        >
          TIRA O COCÓ DO MEIO
        </Text>
        <Text
          style={{
            marginTop: spacing[1],
            color: colors.gold,
            fontFamily: typography.fontFamily.display,
            fontSize: typography.fontSize.lg,
            letterSpacing: 0.45,
            textAlign: 'center',
            textShadowColor: alpha(colors.gold, 0.35),
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 12,
          }}
        >
          Simples de começar, difícil de dominar
        </Text>
      </motion.div>

      {/* Cartão de identidade */}
      <GameCard glow="gold" style={{ padding: spacing[5] }}>
        <SectionTitle title="Identidade" />
        <View style={{ gap: spacing[3] }}>
          <InfoRow
            icon={<Tag width={16} height={16} color={colors.textMuted} />}
            label="Nome"
            value="Tira o Cocó do Meio"
          />
          <InfoRow
            icon={<BookOpen width={16} height={16} color={colors.textMuted} />}
            label="Categoria"
            value="Jogo de estratégia · Tabuleiro"
          />
          <InfoRow
            icon={<MapPin width={16} height={16} color={colors.textMuted} />}
            label="Origem"
            value="Angola"
            highlight="gold"
          />
          <InfoRow
            icon={<Hash width={16} height={16} color={colors.textMuted} />}
            label="Versão"
            value="1.0"
          />
        </View>
      </GameCard>

      {/* Sobre o jogo */}
      <GameCard style={{ padding: spacing[5] }}>
        <SectionTitle title="Sobre o Jogo" />
        <View style={{ gap: spacing[3] }}>
          <Text style={PARAGRAPH}>
            <Text style={STRONG}>Tira o Cocó do Meio</Text> é um clássico jogo de estratégia para 2
            jogadores, enraizado na tradição angolana. Cada jogador comanda três peças num tabuleiro
            3x3 e tenta ser o primeiro a formar uma linha de três.
          </Text>
          <Text style={PARAGRAPH}>
            Com regras simples mas profundidade estratégica, o jogo pertence à mesma família dos
            jogos de alinhamento africanos — onde cada jogada conta e um pequeno erro pode decidir a
            partida.
          </Text>
        </View>
      </GameCard>

      {/* Identidade cultural angolana */}
      <GameCard style={{ padding: spacing[5] }}>
        <SectionTitle title="Identidade Angolana" />
        <View style={{ gap: spacing[3] }}>
          <Text style={PARAGRAPH}>
            Este jogo é uma <Text style={STRONG}>homenagem contemporânea</Text> à cultura angolana. A
            paleta de cores — verdes, vermelhos e dourados — evoca a bandeira nacional e os tecidos
            tradicionais, sem cair em estereótipos.
          </Text>
          <Text style={PARAGRAPH}>
            Os padrões geométricos que decoram a interface inspiram-se na arte visual angolana
            contemporânea: linhas limpas, simetria e contrastes fortes. O objetivo é celebrar uma
            Angola <Text style={STRONG}>moderna, urbana e digital</Text>, nem rural-arcaica nem
            exotizada.
          </Text>
          <Text style={PARAGRAPH}>
            Tira o Cocó do Meio é um convite a conhecer um pedaço do património lúdico angolano — de
            forma leve, competitiva e orgulhosa.
          </Text>
        </View>
      </GameCard>

      {/* Ações rápidas */}
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <GameButton
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => router.push('/how-to-play')}
          accessibilityLabel="Abrir como jogar"
        >
          <BookOpen width={16} height={16} color={colors.text} />
          <Text style={ACTION_TEXT}>Como Jogar</Text>
        </GameButton>
        <GameButton
          variant="p1"
          style={{ flex: 1 }}
          onPress={() => router.push('/tutorial')}
          accessibilityLabel="Abrir tutorial"
        >
          <GraduationCap width={16} height={16} color={colors.white} />
          <Text style={[ACTION_TEXT, { color: colors.white }]}>Tutorial</Text>
        </GameButton>
      </View>

      {/* Créditos */}
      <View
        style={{
          alignItems: 'center',
          paddingTop: spacing[4],
          paddingBottom: spacing[2],
          gap: spacing[1] + 2,
        }}
      >
        <View style={CREDITS_ROW}>
          <Heart width={14} height={14} color={colors.p2} />
          <Text style={CREDIT_TEXT}>
            Inspirado na cultura angolana.{' '}
            <Text
              style={{
                color: colors.text,
                fontWeight: typography.fontWeight.medium,
              }}
            >
              Feito com orgulho.
            </Text>
          </Text>
        </View>
        <View style={CREDITS_ROW}>
          <Info width={12} height={12} color={colors.textMuted} />
          <Text style={SMALL_CREDIT_TEXT}>Moeda virtual · Sem dinheiro real</Text>
        </View>
      </View>
    </TiraScreen>
  );
}

const PARAGRAPH = {
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
  fontSize: typography.fontSize.sm,
  lineHeight: 22.75,
} as const;

const STRONG = {
  color: colors.text,
  fontWeight: typography.fontWeight.bold,
} as const;

const ACTION_TEXT = {
  color: colors.text,
  fontFamily: typography.fontFamily.body,
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.semibold,
} as const;

const CREDITS_ROW = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing[1] + 2,
} as const;

const CREDIT_TEXT = {
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
  fontSize: typography.fontSize.xs,
} as const;

const SMALL_CREDIT_TEXT = {
  color: colors.textMuted,
  fontFamily: typography.fontFamily.body,
  fontSize: 10,
  letterSpacing: 1,
  textTransform: 'uppercase',
} as const;

function InfoRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  highlight?: 'gold' | 'p1' | 'p2';
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radii.lg,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: spacing[3],
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.body,
            fontSize: typography.fontSize.xs,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <Text
          style={
            highlight === 'gold'
              ? {
                  color: colors.gold,
                  fontFamily: typography.fontFamily.display,
                  fontSize: typography.fontSize.base,
                  letterSpacing: 0.4,
                }
              : {
                  color: colors.text,
                  fontFamily: typography.fontFamily.body,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                }
          }
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
