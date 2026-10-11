/**
 * HowToPlay — port do HowToPlayScreen web: referência completa de regras
 * (secções ilustradas, as 8 linhas vencedoras de @tira/engine e tabela
 * resumo), com CTA para o modo offline.
 */
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { WINNING_LINES } from '@tira/engine';
import {
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { colors, radii, spacing, typography, type ColorToken } from '@/theme';

type SectionTint = 'p1' | 'p2' | 'gold' | 'orange';

function P({ children }: { children: ReactNode }) {
  return (
    <TiraText size="sm" variant="muted" style={{ lineHeight: 20 }}>
      {children}
    </TiraText>
  );
}

function B({ children }: { children: ReactNode }) {
  return <TiraText size="sm" weight="semibold">{children}</TiraText>;
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing[2] }}>
      <TiraText size="sm" variant="muted">
        •
      </TiraText>
      <View style={{ flex: 1 }}>
        <P>{children}</P>
      </View>
    </View>
  );
}

function SectionCard({
  emoji,
  title,
  tint,
  children,
}: {
  emoji: string;
  title: string;
  tint: SectionTint;
  children: ReactNode;
}) {
  return (
    <TiraCard>
      <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.lg,
            backgroundColor: alpha(colors[tint], 0.15),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TiraText size="sm">{emoji}</TiraText>
        </View>
        <View style={{ flex: 1, gap: spacing[2] }}>
          <TiraHeading level="h3">{title}</TiraHeading>
          {children}
        </View>
      </View>
    </TiraCard>
  );
}

export default function HowToPlayScreen() {
  const { t } = useT();

  return (
    <TiraScreen title={t('howto.title')} subtitle={t('howto.subtitle')} showBack>
      <SectionCard emoji="🎯" title="Objetivo" tint="gold">
        <P>
          Ser o primeiro a alinhar as <B>3 peças da tua cor</B> numa das 8 linhas vencedoras (3
          horizontais, 3 verticais, 2 diagonais).
        </P>
      </SectionCard>

      <SectionCard emoji="🔲" title="Tabuleiro" tint="p1">
        <P>
          Tabuleiro <B>3x3</B> com 9 casas numeradas de 1 a 9.
        </P>
        <NumberedBoard />
      </SectionCard>

      <SectionCard emoji="🧩" title="Posição Inicial" tint="p1">
        <Bullet>
          <B>Jogador 1 (verde ▲)</B> — casas 1, 2, 3 (topo)
        </Bullet>
        <Bullet>
          <B>Jogador 2 (vermelho ●)</B> — casas 7, 8, 9 (base)
        </Bullet>
        <Bullet>Casas 4, 5, 6 começam vazias</Bullet>
      </SectionCard>

      <SectionCard emoji="🔁" title="Turnos" tint="p1">
        <P>
          O <B>Jogador 1 começa sempre</B>. Os jogadores alternam turnos, movendo uma peça por
          turno.
        </P>
      </SectionCard>

      <SectionCard emoji="↔️" title="Movimento" tint="gold">
        <Bullet>
          Escolhe uma peça tua e move-a para uma casa <B>vazia</B>.
        </Bullet>
        <Bullet>
          Só podes mover para uma casa <B>vizinha</B> (adjacente).
        </Bullet>
        <Bullet>Podes mover em qualquer direção: horizontal, vertical ou diagonal.</Bullet>
        <Bullet>
          <B>Não podes saltar peças.</B>
        </Bullet>
      </SectionCard>

      <SectionCard emoji="🧱" title="Regras de Ocupação" tint="orange">
        <Bullet>
          Cada casa pode conter no máximo <B>uma peça</B>.
        </Bullet>
        <Bullet>Não podes ocupar uma casa já ocupada (nem tua nem do adversário).</Bullet>
        <Bullet>
          Cada jogador mantém sempre <B>3 peças</B> em jogo.
        </Bullet>
      </SectionCard>

      <SectionCard emoji="👑" title="Vitória — 8 linhas vencedoras" tint="gold">
        <P>Vences quando as tuas 3 peças formam uma destas 8 linhas:</P>
        <WinningLinesGrid />
      </SectionCard>

      <SectionCard emoji="🛡️" title="Bloqueio" tint="p2">
        <P>
          Se o adversário tiver <B>duas peças alinhadas</B> com a terceira casa livre, ele tem uma{' '}
          <TiraText size="sm" weight="semibold" variant="p2">
            ameaça
          </TiraText>
          . Tens de bloquear a casa que falta, ou ele vence no próximo turno.
        </P>
      </SectionCard>

      <SectionCard emoji="⚠️" title="Ameaças Múltiplas" tint="p2">
        <P>
          Se o adversário criar{' '}
          <TiraText size="sm" weight="semibold" variant="p2">
            duas ameaças simultâneas
          </TiraText>{' '}
          (uma "forquilha"), só podes bloquear uma. A derrota é praticamente inevitável — evita
          chegar a esta situação.
        </P>
      </SectionCard>

      <SectionCard emoji="🤝" title="Empate" tint="orange">
        <P>
          O jogo empata se a <B>mesma posição se repetir 3 vezes</B> (com o mesmo jogador a jogar).
          Isto evita ciclos infinitos.
        </P>
      </SectionCard>

      <SectionCard emoji="📝" title="Estados do Jogo" tint="p1">
        <View style={{ gap: spacing[1] }}>
          <StatusRow code="READY" label="Pronto para começar" color="gold" />
          <StatusRow code="PLAYER_1_TURN" label="Vez do Jogador 1" color="p1" />
          <StatusRow code="PLAYER_2_TURN" label="Vez do Jogador 2" color="p2" />
          <StatusRow code="WIN_P1" label="Vitória do Jogador 1" color="gold" />
          <StatusRow code="WIN_P2" label="Vitória do Jogador 2" color="gold" />
          <StatusRow code="DRAW" label="Empate por repetição" color="textMuted" />
        </View>
      </SectionCard>

      {/* Tabela resumo */}
      <TiraCard>
        <TiraHeading level="h3" style={{ marginBottom: spacing[3] }}>
          {t('howto.summary')}
        </TiraHeading>
        <SummaryRow k="Tabuleiro" v="3×3 (9 casas)" />
        <SummaryRow k="Peças por jogador" v="3" />
        <SummaryRow k="Jogador inicial" v="P1 (verde)" />
        <SummaryRow k="Movimento" v="Casa vizinha, sem saltar" />
        <SummaryRow k="Linhas vencedoras" v="8" />
        <SummaryRow k="Empate" v="3ª repetição" />
        <SummaryRow k="Duração média" v="2-5 min" last />
      </TiraCard>

      <TiraButton
        variant="p1"
        size="lg"
        fullWidth
        onPress={() => router.push('/offline')}
        accessibilityLabel={t('profile.play_now')}
      >
        {`▶️ ${t('profile.play_now')}`}
      </TiraButton>
    </TiraScreen>
  );
}

function StatusRow({
  code,
  label,
  color,
}: {
  code: string;
  label: string;
  color: ColorToken;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center' }}>
      <TiraText
        size="xs"
        weight="semibold"
        style={{ fontFamily: typography.fontFamily.mono, color: colors[color] }}
      >
        {code}
      </TiraText>
      <TiraText size="xs" variant="muted">
        {`— ${label}`}
      </TiraText>
    </View>
  );
}

function SummaryRow({ k, v, last = false }: { k: string; v: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing[3],
        paddingVertical: spacing[2],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <TiraText size="xs" variant="muted">
        {k}
      </TiraText>
      <TiraText size="xs" weight="semibold">
        {v}
      </TiraText>
    </View>
  );
}

function NumberedBoard() {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[1],
        maxWidth: 160,
        padding: spacing[2],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignSelf: 'center',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
        <View
          key={n}
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: n === 5 ? alpha(colors.gold, 0.15) : colors.surfaceAlt,
            borderWidth: 1,
            borderColor: n === 5 ? alpha(colors.gold, 0.4) : colors.border,
          }}
        >
          <TiraHeading level="h3" color={n === 5 ? 'gold' : 'textMuted'}>
            {n}
          </TiraHeading>
        </View>
      ))}
    </View>
  );
}

function WinningLinesGrid() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] }}>
      {WINNING_LINES.map((line, idx) => (
        <View
          key={idx}
          style={{
            width: 66,
            padding: spacing[1],
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            gap: 2,
          }}
          accessibilityLabel={`Linha ${idx + 1}: casas ${line.join(', ')}`}
        >
          {[0, 1, 2].map((row) => (
            <View key={row} style={{ flexDirection: 'row', gap: 2 }}>
              {[0, 1, 2].map((col) => {
                const n = row * 3 + col + 1;
                const inLine = (line as readonly number[]).includes(n);
                return (
                  <View
                    key={col}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: radii.sm,
                      backgroundColor: inLine ? colors.gold : alpha(colors.surfaceAlt, 0.6),
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
