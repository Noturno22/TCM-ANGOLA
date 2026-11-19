import { useMemo, type ReactNode } from 'react';
import { router } from 'expo-router';
import { BarChart3, Clock, Flame, Target, TrendingUp, Trophy, Zap } from 'lucide-react-native';
import { Text, View, type TextStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { TiraScreen, alpha } from '@/components/tira';
import { useProfile, type MatchRecord } from '@/store/profile';
import { colors, radii, spacing, typography } from '@/theme';

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

const TINY: TextStyle = { fontSize: 10, color: colors.textMuted, fontFamily: BODY };
const TINY_UPPER: TextStyle = {
  ...TINY,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
};
const TEXT_SM: TextStyle = { fontSize: 15.75, color: colors.text, fontFamily: BODY };
const DISPLAY_2XL: TextStyle = {
  fontSize: 27,
  letterSpacing: 0.54,
  color: colors.text,
  fontFamily: DISPLAY,
  lineHeight: 36,
};

const HEAT_LOW = '#1F5C3A';
const HEAT_MID = '#2E8B57';

export default function StatsScreen() {
  const profile = useProfile();
  const stats = useMemo(() => computeStats(profile.matches), [profile.matches]);

  if (profile.matches.length === 0) {
    return (
      <TiraScreen>
        <GameCard style={{ padding: spacing[8], alignItems: 'center' }}>
          <View style={{ marginBottom: spacing[3] }}>
            <BarChart3 size={48} color={colors.textMuted} />
          </View>
          <Text
            style={{
              fontFamily: DISPLAY,
              fontSize: 22.5,
              letterSpacing: 0.45,
              color: colors.text,
              marginBottom: spacing[2],
            }}
          >
            Sem dados ainda
          </Text>
          <Text
            style={{
              fontSize: 15.75,
              color: colors.textMuted,
              fontFamily: BODY,
              textAlign: 'center',
              marginBottom: spacing[4],
            }}
          >
            Joga algumas partidas para veres as tuas estatísticas e gráficos de progresso.
          </Text>
          <GameButton variant="p1" onPress={() => router.push('/offline')}>
            Jogar agora
          </GameButton>
        </GameCard>
      </TiraScreen>
    );
  }

  return (
    <TiraScreen>
      <GameCard glow="gold" style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.gold, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trophy size={28} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={TINY_UPPER}>Resumo total</Text>
            <Text style={DISPLAY_2XL}>{profile.totalMatches} partidas</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={TINY_UPPER}>Taxa vitória</Text>
            <Text style={[DISPLAY_2XL, { color: colors.p1 }]}>{stats.winRate}%</Text>
          </View>
        </View>
      </GameCard>

      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle title="Progresso de XP" />
        <XpChart data={stats.xpCurve} />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing[2],
          }}
        >
          <Text style={TINY}>Início</Text>
          <Text style={[TINY, { color: colors.gold }]}>
            {profile.xp.toLocaleString('pt-PT')} XP total
          </Text>
          <Text style={TINY}>Agora</Text>
        </View>
      </GameCard>

      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle title="Resultados" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[6] }}>
          <ResultsDonut
            wins={profile.wins}
            losses={profile.losses}
            draws={profile.draws}
          />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <ResultRow
              label="Vitórias"
              value={profile.wins}
              total={profile.totalMatches}
              color={colors.p1}
              bg={colors.p1}
            />
            <ResultRow
              label="Derrotas"
              value={profile.losses}
              total={profile.totalMatches}
              color={colors.p2}
              bg={colors.p2}
            />
            <ResultRow
              label="Empates"
              value={profile.draws}
              total={profile.totalMatches}
              color={colors.textMuted}
              bg={colors.textMuted}
            />
          </View>
        </View>
      </GameCard>

      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle title="Por dificuldade da IA" />
        <View style={{ gap: spacing[3] }}>
          {stats.byDifficulty.map((d) => (
            <DifficultyBar key={d.difficulty} {...d} />
          ))}
        </View>
      </GameCard>

      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle
          title="Atividade (7 dias)"
          action={
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <Text style={[TINY, { color: colors.p1 }]}>{stats.activeDays} dias ativos</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Flame size={12} color={colors.gold} />
                <Text style={[TINY, { color: colors.gold }]}>
                  {stats.currentStreakDays}d streak
                </Text>
              </View>
            </View>
          }
        />
        <DailyChart data={stats.last7Days} />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing[4],
            marginTop: spacing[3],
          }}
        >
          <LegendItem color={colors.p1} label="Vitórias" />
          <LegendItem color={colors.textMuted} label="Empates" />
          <LegendItem color={colors.p2} label="Derrotas" />
        </View>
      </GameCard>

      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle title="Atividade (12 semanas)" />
        <Text style={[TINY, { marginBottom: spacing[3] }]}>
          Cada quadrado é um dia. Mais escuro = mais partidas.
        </Text>
        <ActivityHeatmap matches={profile.matches} />
      </GameCard>

      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <GameCard style={{ flex: 1, padding: spacing[4], alignItems: 'center' }}>
          <View style={{ marginBottom: spacing[1] }}>
            <Clock size={20} color={colors.textMuted} />
          </View>
          <Text style={DISPLAY_2XL}>{formatDuration(stats.totalDuration)}</Text>
          <Text style={[TINY, { textTransform: 'uppercase' }]}>Tempo total</Text>
        </GameCard>
        <GameCard style={{ flex: 1, padding: spacing[4], alignItems: 'center' }}>
          <View style={{ marginBottom: spacing[1] }}>
            <Zap size={20} color={colors.gold} />
          </View>
          <Text style={[DISPLAY_2XL, { color: colors.gold }]}>
            {stats.avgMoves > 0 ? Math.round(stats.avgMoves) : 0}
          </Text>
          <Text style={[TINY, { textTransform: 'uppercase' }]}>Jogadas/partida</Text>
        </GameCard>
      </View>

      <GameCard style={{ padding: spacing[4] }}>
        <SectionTitle title="Recordes" />
        <View style={{ gap: spacing[2] }}>
          <RecordRow
            icon={<TrendingUp size={16} color={colors.textMuted} />}
            label="Melhor sequência"
            value={`${profile.bestStreak} vitórias`}
          />
          <RecordRow
            icon={<Clock size={16} color={colors.textMuted} />}
            label="Partida mais rápida"
            value={stats.fastestMatch ? `${stats.fastestMatch}s` : '—'}
          />
          <RecordRow
            icon={<Target size={16} color={colors.textMuted} />}
            label="Menos jogadas para vencer"
            value={stats.fewestMovesWin ? `${stats.fewestMovesWin} jogadas` : '—'}
          />
          <RecordRow
            icon={<Trophy size={16} color={colors.textMuted} />}
            label="Conquistas desbloqueadas"
            value={`${profile.achievements.filter((a) => a.unlockedAt).length} / ${profile.achievements.length}`}
          />
        </View>
      </GameCard>
    </TiraScreen>
  );
}

function XpChart({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <View style={{ height: 128, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
          Joga mais {2 - data.length} partida(s) para veres o gráfico.
        </Text>
      </View>
    );
  }

  const W = 300;
  const H = 100;
  const pad = 10;
  const max = data[data.length - 1] || 1;
  const min = data[0];
  const range = Math.max(1, max - min);
  const step = (W - pad * 2) / (data.length - 1);
  const points: [number, number][] = data.map((v, i) => {
    const x = pad + i * step;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return [x, y];
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0]},${H - pad} L ${points[0][0]},${H - pad} Z`;

  return (
    <Svg
      width="100%"
      height={128}
      viewBox={`0 0 ${W} ${H}`}
      accessibilityRole="image"
      accessibilityLabel="Gráfico de progresso de XP"
    >
      <Defs>
        <LinearGradient id="xpGradient" x1={0} y1={0} x2={0} y2={1}>
          <Stop offset="0%" stopColor={colors.p1} stopOpacity={0.4} />
          <Stop offset="100%" stopColor={colors.p1} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line
          key={f}
          x1={pad}
          y1={pad + f * (H - pad * 2)}
          x2={W - pad}
          y2={pad + f * (H - pad * 2)}
          stroke={colors.border}
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
      ))}
      <Path d={areaPath} fill="url(#xpGradient)" />
      <Path
        d={linePath}
        fill="none"
        stroke={colors.p1}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={i === points.length - 1 ? 4 : 2}
          fill={i === points.length - 1 ? colors.gold : colors.p1}
        />
      ))}
    </Svg>
  );
}

function ResultsDonut({
  wins,
  losses,
  draws,
}: {
  wins: number;
  losses: number;
  draws: number;
}) {
  const total = wins + losses + draws;
  const R = 50;
  const C = 2 * Math.PI * R;
  const winPct = total > 0 ? (wins / total) * C : 0;
  const lossPct = total > 0 ? (losses / total) * C : 0;
  const drawPct = total > 0 ? (draws / total) * C : 0;

  return (
    <Svg
      width={128}
      height={128}
      viewBox="0 0 130 130"
      accessibilityRole="image"
      accessibilityLabel={`Resultados: ${wins} vitórias, ${losses} derrotas, ${draws} empates`}
    >
      <Circle cx={65} cy={65} r={R} fill="none" stroke={colors.surfaceAlt} strokeWidth={14} />
      <Circle
        cx={65}
        cy={65}
        r={R}
        fill="none"
        stroke={colors.p1}
        strokeWidth={14}
        strokeDasharray={`${winPct} ${C - winPct}`}
        strokeDashoffset={C * 0.25}
        transform="rotate(-90 65 65)"
      />
      <Circle
        cx={65}
        cy={65}
        r={R}
        fill="none"
        stroke={colors.p2}
        strokeWidth={14}
        strokeDasharray={`${lossPct} ${C - lossPct}`}
        strokeDashoffset={C * 0.25 - winPct}
        transform="rotate(-90 65 65)"
      />
      <Circle
        cx={65}
        cy={65}
        r={R}
        fill="none"
        stroke={colors.textMuted}
        strokeWidth={14}
        strokeDasharray={`${drawPct} ${C - drawPct}`}
        strokeDashoffset={C * 0.25 - winPct - lossPct}
        transform="rotate(-90 65 65)"
      />
      <SvgText
        x={65}
        y={60}
        textAnchor="middle"
        fill={colors.text}
        fontSize={22}
        fontFamily={DISPLAY}
      >
        {total}
      </SvgText>
      <SvgText
        x={65}
        y={78}
        textAnchor="middle"
        fill={colors.textMuted}
        fontSize={9}
        fontFamily={BODY}
      >
        partidas
      </SvgText>
    </Svg>
  );
}

function ResultRow({
  label,
  value,
  total,
  color,
  bg,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  bg: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: spacing[1],
        }}
      >
        <Text style={{ fontSize: 13.5, color, fontFamily: BODY }}>{label}</Text>
        <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
          {value} ({Math.round(pct)}%)
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: bg,
          }}
        />
      </View>
    </View>
  );
}

function DifficultyBar({
  difficulty,
  total,
  wins,
  losses,
  draws,
}: {
  difficulty: string;
  total: number;
  wins: number;
  losses: number;
  draws: number;
}) {
  const winPct = total > 0 ? (wins / total) * 100 : 0;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: spacing[1],
        }}
      >
        <Text style={{ fontSize: 13.5, color: colors.text, fontFamily: BODY, fontWeight: '500' }}>
          {difficulty}
        </Text>
        <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
          {total} partidas • {Math.round(winPct)}% vitória
        </Text>
      </View>
      <View
        style={{
          height: 12,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        {wins > 0 ? (
          <View
            style={{
              height: '100%',
              width: `${(wins / total) * 100}%`,
              backgroundColor: colors.p1,
            }}
          />
        ) : null}
        {draws > 0 ? (
          <View
            style={{
              height: '100%',
              width: `${(draws / total) * 100}%`,
              backgroundColor: colors.textMuted,
            }}
          />
        ) : null}
        {losses > 0 ? (
          <View
            style={{
              height: '100%',
              width: `${(losses / total) * 100}%`,
              backgroundColor: colors.p2,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function RecordRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
      <View>{icon}</View>
      <Text style={[TEXT_SM, { flex: 1 }]}>{label}</Text>
      <Text
        style={{
          fontSize: 15.75,
          fontFamily: BODY,
          fontWeight: typography.fontWeight.semibold,
          color: colors.gold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      <View style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: color }} />
      <Text style={TINY}>{label}</Text>
    </View>
  );
}

function ActivityHeatmap({ matches }: { matches: MatchRecord[] }) {
  const WEEKS = 12;
  const DAYS = 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7;
  const startMonday = new Date(today);
  startMonday.setDate(today.getDate() - dayOfWeek - (WEEKS - 1) * 7);

  const dayMap = new Map<string, number>();
  for (const m of matches) {
    const dateStr = m.date.slice(0, 10);
    dayMap.set(dateStr, (dayMap.get(dateStr) ?? 0) + 1);
  }

  const grid: { date: string; count: number }[][] = [];
  for (let d = 0; d < DAYS; d++) {
    grid[d] = [];
    for (let w = 0; w < WEEKS; w++) {
      const date = new Date(startMonday);
      date.setDate(startMonday.getDate() + w * 7 + d);
      const dateStr = date.toISOString().slice(0, 10);
      grid[d][w] = { date: dateStr, count: dayMap.get(dateStr) ?? 0 };
    }
  }

  const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const monthLabels = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  const maxCount = Math.max(1, ...grid.flat().map((c) => c.count));

  const monthCols: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const date = new Date(startMonday);
    date.setDate(startMonday.getDate() + w * 7);
    const month = date.getMonth();
    if (month !== lastMonth) {
      monthCols.push({ col: w, label: monthLabels[month] });
      lastMonth = month;
    }
  }

  return (
    <View style={{ minWidth: 280 }}>
      <View style={{ flexDirection: 'row', gap: 3, marginBottom: spacing[1], marginLeft: 28 }}>
        {Array.from({ length: WEEKS }).map((_, w) => {
          const ml = monthCols.find((m) => m.col === w);
          return (
            <View key={w} style={{ width: 10 }}>
              <Text style={{ fontSize: 8, color: colors.textMuted, fontFamily: BODY }}>
                {ml ? ml.label : ''}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing[1] }}>
        <View style={{ flexDirection: 'column', gap: 3, marginRight: spacing[1] }}>
          {dayLabels.map((label, d) => (
            <View key={d} style={{ height: 10, width: 20, justifyContent: 'center' }}>
              <Text
                style={{
                  height: 10,
                  fontSize: 8,
                  lineHeight: 10,
                  color: colors.textMuted,
                  fontFamily: BODY,
                }}
              >
                {d % 2 === 0 ? label : ''}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: WEEKS }).map((_, w) => (
            <View key={w} style={{ flexDirection: 'column', gap: 3 }}>
              {Array.from({ length: DAYS }).map((_, d) => {
                const cell = grid[d][w];
                const intensity = cell.count / maxCount;
                const backgroundColor =
                  cell.count === 0
                    ? colors.surfaceAlt
                    : intensity > 0.66
                      ? colors.p1
                      : intensity > 0.33
                        ? HEAT_MID
                        : HEAT_LOW;
                return (
                  <View
                    key={d}
                    accessibilityRole="image"
                    accessibilityLabel={`${cell.date}: ${cell.count} partidas`}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: radii.sm,
                      backgroundColor,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: spacing[1],
          marginTop: spacing[2],
        }}
      >
        <Text style={{ fontSize: 8, color: colors.textMuted, fontFamily: BODY }}>Menos</Text>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceAlt,
          }}
        />
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radii.sm,
            backgroundColor: HEAT_LOW,
          }}
        />
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radii.sm,
            backgroundColor: HEAT_MID,
          }}
        />
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radii.sm,
            backgroundColor: colors.p1,
          }}
        />
        <Text style={{ fontSize: 8, color: colors.textMuted, fontFamily: BODY }}>Mais</Text>
      </View>
    </View>
  );
}

function DailyChart({
  data,
}: {
  data: {
    date: string;
    label: string;
    total: number;
    wins: number;
    losses: number;
    draws: number;
  }[];
}) {
  const W = 300;
  const H = 100;
  const pad = 14;
  const barWidth = ((W - pad * 2) / data.length) * 0.6;
  const gap = (W - pad * 2) / data.length;
  const maxTotal = Math.max(1, ...data.map((d) => d.total));
  const chartH = H - pad * 2;

  return (
    <Svg
      width="100%"
      height={128}
      viewBox={`0 0 ${W} ${H}`}
      accessibilityRole="image"
      accessibilityLabel="Gráfico de atividade dos últimos 7 dias"
    >
      {[0.5, 1].map((f) => (
        <Line
          key={f}
          x1={pad}
          y1={pad + (1 - f) * chartH}
          x2={W - pad}
          y2={pad + (1 - f) * chartH}
          stroke={colors.border}
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
      ))}
      {data.map((d, i) => {
        const x = pad + i * gap + (gap - barWidth) / 2;
        const totalH = (d.total / maxTotal) * chartH;
        const winsH = d.total > 0 ? (d.wins / d.total) * totalH : 0;
        const drawsH = d.total > 0 ? (d.draws / d.total) * totalH : 0;
        const lossesH = d.total > 0 ? (d.losses / d.total) * totalH : 0;
        const baseY = pad + chartH;
        const isToday = i === data.length - 1;

        return (
          <G key={d.date}>
            {winsH > 0 ? (
              <Rect
                x={x}
                y={baseY - winsH}
                width={barWidth}
                height={winsH}
                fill={colors.p1}
                rx={2}
              />
            ) : null}
            {drawsH > 0 ? (
              <Rect
                x={x}
                y={baseY - winsH - drawsH}
                width={barWidth}
                height={drawsH}
                fill={colors.textMuted}
                rx={2}
              />
            ) : null}
            {lossesH > 0 ? (
              <Rect
                x={x}
                y={baseY - winsH - drawsH - lossesH}
                width={barWidth}
                height={lossesH}
                fill={colors.p2}
                rx={2}
              />
            ) : null}
            <SvgText
              x={x + barWidth / 2}
              y={H - 2}
              textAnchor="middle"
              fontSize={9}
              fill={isToday ? colors.gold : colors.textMuted}
              fontFamily={BODY}
              fontWeight={
                isToday ? typography.fontWeight.semibold : typography.fontWeight.regular
              }
            >
              {d.label}
            </SvgText>
            {d.total > 0 ? (
              <SvgText
                x={x + barWidth / 2}
                y={baseY - totalH - 4}
                textAnchor="middle"
                fontSize={9}
                fill={colors.text}
                fontFamily={BODY}
                fontWeight={typography.fontWeight.semibold}
              >
                {d.total}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

interface ComputedStats {
  winRate: number;
  xpCurve: number[];
  totalDuration: number;
  avgMoves: number;
  fastestMatch: number | null;
  fewestMovesWin: number | null;
  byDifficulty: {
    difficulty: string;
    total: number;
    wins: number;
    losses: number;
    draws: number;
  }[];
  last7Days: {
    date: string;
    label: string;
    total: number;
    wins: number;
    losses: number;
    draws: number;
  }[];
  activeDays: number;
  currentStreakDays: number;
}

function computeStats(matches: MatchRecord[]): ComputedStats {
  const humanMatches = matches.filter((m) => m.playerSide);
  const wins = humanMatches.filter((m) => m.result === m.playerSide).length;
  const winRate =
    humanMatches.length > 0 ? Math.round((wins / humanMatches.length) * 100) : 0;

  const chronological = [...humanMatches].reverse();
  const xpCurve: number[] = [0];
  let cumXp = 0;
  for (const m of chronological) {
    cumXp += xpForMatch(m);
    xpCurve.push(cumXp);
  }

  const totalDuration = matches.reduce((s, m) => s + m.durationSec, 0);
  const avgMoves =
    matches.length > 0
      ? matches.reduce((s, m) => s + m.moveCount, 0) / matches.length
      : 0;
  const fastestMatch =
    matches.length > 0 ? Math.min(...matches.map((m) => m.durationSec)) : null;
  const fewestMovesWin =
    humanMatches.length > 0
      ? Math.min(
          ...humanMatches
            .filter((m) => m.result === m.playerSide)
            .map((m) => m.moveCount),
        )
      : null;

  const diffMap = new Map<
    string,
    { total: number; wins: number; losses: number; draws: number }
  >();
  for (const m of matches) {
    if (m.mode !== 'pve' || !m.difficulty) continue;
    const key =
      m.difficulty === 'easy'
        ? 'Fácil'
        : m.difficulty === 'medium'
          ? 'Médio'
          : m.difficulty === 'hard'
            ? 'Difícil'
            : 'Perfeito';
    const entry = diffMap.get(key) ?? { total: 0, wins: 0, losses: 0, draws: 0 };
    entry.total++;
    if (m.result === m.playerSide) entry.wins++;
    else if (m.result === 'DRAW') entry.draws++;
    else entry.losses++;
    diffMap.set(key, entry);
  }
  const byDifficulty = [
    {
      difficulty: 'Fácil',
      ...(diffMap.get('Fácil') ?? { total: 0, wins: 0, losses: 0, draws: 0 }),
    },
    {
      difficulty: 'Médio',
      ...(diffMap.get('Médio') ?? { total: 0, wins: 0, losses: 0, draws: 0 }),
    },
    {
      difficulty: 'Difícil',
      ...(diffMap.get('Difícil') ?? { total: 0, wins: 0, losses: 0, draws: 0 }),
    },
    {
      difficulty: 'Perfeito',
      ...(diffMap.get('Perfeito') ?? { total: 0, wins: 0, losses: 0, draws: 0 }),
    },
  ];

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const last7Days: ComputedStats['last7Days'] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().slice(0, 10);
    const dayMatches = matches.filter((m) => m.date.slice(0, 10) === dateStr);
    const human = dayMatches.filter((m) => m.playerSide);
    const dayWins = human.filter((m) => m.result === m.playerSide).length;
    const dayDraws = human.filter((m) => m.result === 'DRAW').length;
    const dayLosses = human.length - dayWins - dayDraws;
    last7Days.push({
      date: dateStr,
      label: dayLabels[d.getDay()],
      total: human.length,
      wins: dayWins,
      losses: dayLosses,
      draws: dayDraws,
    });
  }

  const activeDays = new Set(humanMatches.map((m) => m.date.slice(0, 10))).size;
  let currentStreakDays = 0;
  const streakCursor = new Date(today);
  streakCursor.setHours(0, 0, 0, 0);
  while (true) {
    const dateStr = streakCursor.toISOString().slice(0, 10);
    const hasMatch = humanMatches.some((m) => m.date.slice(0, 10) === dateStr);
    if (hasMatch) {
      currentStreakDays++;
      streakCursor.setDate(streakCursor.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    winRate,
    xpCurve,
    totalDuration,
    avgMoves,
    fastestMatch,
    fewestMovesWin: fewestMovesWin === Infinity ? null : fewestMovesWin,
    byDifficulty,
    last7Days,
    activeDays,
    currentStreakDays,
  };
}

function xpForMatch(m: MatchRecord): number {
  if (m.result === 'DRAW') return 10;
  if (m.result === m.playerSide) return 30;
  return 5;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
