/**
 * Share — port do ShareScreen web: separador Exportar gera a mensagem PT da
 * partida e abre o partilhador nativo (React Native `Share`); separador
 * Importar mostra o estado "Em breve" (o codec de partilha fica no web por
 * agora — ver AGENTS/relatório da tarefa).
 *
 * Navegação: "Ver replay" → /replay com matchId da partida selecionada.
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import {
  EmptyState,
  Pill,
  ResultBadge,
  SegmentedControl,
  TiraButton,
  TiraCard,
  TiraHeading,
  TiraScreen,
  TiraText,
  alpha,
} from '@/components/tira';
import { useT } from '@/lib/i18n/hook';
import { useProfile, type MatchRecord } from '@/store/profile';
import { colors, spacing } from '@/theme';

type Tab = 'export' | 'import';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ShareScreen() {
  const { t } = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId?: string }>();
  const matches = useProfile((s) => s.matches);

  const paramId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const [tab, setTab] = useState<Tab>('export');
  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedId) ?? matches[0] ?? null,
    [matches, selectedId],
  );

  const message = useMemo(() => {
    if (!selected) return '';
    return buildShareMessage(selected, t);
  }, [selected, t]);

  const handleSend = useCallback(async () => {
    if (!selected) return;
    try {
      const result = await Share.share({
        title: t('share.title'),
        message,
      });
      if (result.action === Share.sharedAction) {
        setSentNote(t('share.sent'));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch {
      setSentNote(t('share.error'));
    }
  }, [selected, message, t]);

  return (
    <TiraScreen title={t('share.title')} subtitle={t('share.subtitle')} showBack>
      <SegmentedControl<Tab>
        options={[
          { value: 'export', label: t('share.export') },
          { value: 'import', label: t('share.import') },
        ]}
        value={tab}
        onChange={setTab}
        testID="share-tabs"
      />

      {tab === 'export' ? (
        <View style={{ gap: spacing[4] }}>
          {!selected ? (
            <EmptyState
              emoji="📤"
              title={t('share.empty')}
              desc={t('share.how.desc')}
              actionLabel={t('share.play_now')}
              onAction={() => router.replace('/offline')}
            />
          ) : (
            <>
              <TiraCard>
                <TiraHeading level="h3" style={{ marginBottom: spacing[2] }}>
                  {t('share.selected')}
                </TiraHeading>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <TiraText size="sm" weight="semibold">
                      {t('share.vs', { opponent: selected.opponent })}
                    </TiraText>
                    <TiraText size="xs" variant="muted">
                      {`${formatDate(selected.date)} • ${t('share.moves', { n: selected.moves.length })} • ${formatDuration(selected.durationSec)}`}
                    </TiraText>
                  </View>
                  <ResultBadge result={selected.result} playerSide={selected.playerSide} />
                </View>
                <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
                  <TiraButton
                    variant="gold"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={handleSend}
                    accessibilityLabel={t('share.send')}
                  >
                    {`📨 ${t('share.send')}`}
                  </TiraButton>
                  <TiraButton
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() =>
                      router.push({ pathname: '/replay', params: { matchId: selected.id } })
                    }
                    accessibilityLabel={t('share.view_replay')}
                  >
                    {`🎬 ${t('share.view_replay')}`}
                  </TiraButton>
                </View>
                {sentNote ? (
                  <TiraText size="xs" variant="gold" align="center" style={{ marginTop: spacing[2] }}>
                    {sentNote}
                  </TiraText>
                ) : null}
              </TiraCard>

              <TiraCard style={{ backgroundColor: alpha(colors.surfaceAlt, 0.5) }}>
                <TiraText size="xs" variant="muted" style={{ textTransform: 'uppercase', marginBottom: spacing[2] }}>
                  {t('share.message')}
                </TiraText>
                <TiraText size="xs" style={{ lineHeight: 18 }}>
                  {message}
                </TiraText>
              </TiraCard>

              {matches.length > 1 ? (
                <View style={{ gap: spacing[2] }}>
                  <TiraText size="xs" variant="muted" style={{ textTransform: 'uppercase' }}>
                    {t('share.others')}
                  </TiraText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                    {matches.slice(0, 12).map((m, i) => (
                      <Pill
                        key={m.id}
                        active={m.id === selected.id}
                        onPress={() => {
                          setSentNote(null);
                          setSelectedId(m.id);
                        }}
                      >
                        {`#${matches.length - i} ${m.opponent}`}
                      </Pill>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}

          <TiraCard>
            <TiraHeading level="h3" style={{ marginBottom: spacing[1] }}>
              {t('share.how')}
            </TiraHeading>
            <TiraText size="xs" variant="muted">
              {t('share.how.desc')}
            </TiraText>
          </TiraCard>
        </View>
      ) : (
        <EmptyState
          emoji="📥"
          title={t('share.import.title')}
          desc={t('share.import.desc')}
          actionLabel={t('share.play_now')}
          onAction={() => router.replace('/offline')}
        />
      )}
    </TiraScreen>
  );
}

/** Mensagem PT local (não usa o codec do web — ver decisão na tarefa). */
function buildShareMessage(
  match: MatchRecord,
  t: ReturnType<typeof useT>['t'],
): string {
  const resultLabel =
    match.result === 'DRAW'
      ? t('result.draw')
      : match.playerSide
        ? match.result === match.playerSide
          ? t('result.win')
          : t('result.loss')
        : `${t('result.win')} ${match.result === 'P1' ? 1 : 2}`;
  const lines = [
    `🏆 ${t('share.title')} — Tira o Cocó do Meio`,
    `${t('share.vs', { opponent: match.opponent })}${match.difficulty ? ` (${t(`diff.${match.difficulty}`)})` : ''}`,
    `${t('replay.result')}: ${resultLabel}`,
    `${t('share.moves', { n: match.moves.length })} • ${formatDuration(match.durationSec)}`,
    `${formatDate(match.date)}`,
    '',
    t('share.play_now'),
  ];
  return lines.join('\n');
}
