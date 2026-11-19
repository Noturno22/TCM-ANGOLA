/**
 * ArenaBackground — port do src/components/game/ArenaBackground.tsx (web).
 * Fundo "game premium": raios diagonais neon, brilhos radiais, painéis tech,
 * estrelas cintilantes e chevron dourado na base. SVG nativo (rn-svg).
 *
 * Nota: os `feGaussianBlur` do web não existem em rn-svg nativo — o brilho é
 * aproximado com gradientes radiais/lineares já suaves. No expo web os
 * filtros SVG do DOM funcionam quando suportados.
 */
import { useId } from 'react';
import { useWindowDimensions, View } from 'react-native';
import {
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Svg,
} from 'react-native-svg';
import { useSettings } from '@/store/settings';

const SPARKLES: { x: number; y: number; s: number; c: string; d: number }[] = [
  { x: 118, y: 322, s: 1.15, c: '#eafff2', d: 0 },
  { x: 252, y: 168, s: 0.75, c: '#45ff95', d: 0.7 },
  { x: 402, y: 428, s: 0.6, c: '#eafff2', d: 1.4 },
  { x: 868, y: 246, s: 1.0, c: '#45ff95', d: 0.3 },
  { x: 986, y: 468, s: 0.7, c: '#eafff2', d: 1.9 },
  { x: 692, y: 132, s: 0.85, c: '#ffd76a', d: 1.1 },
  { x: 64, y: 742, s: 0.9, c: '#45ff95', d: 2.2 },
  { x: 1016, y: 862, s: 1.05, c: '#eafff2', d: 0.5 },
  { x: 154, y: 1118, s: 0.8, c: '#45ff95', d: 1.6 },
  { x: 928, y: 1172, s: 0.95, c: '#eafff2', d: 2.6 },
  { x: 542, y: 1326, s: 0.7, c: '#ffd76a', d: 0.9 },
  { x: 318, y: 636, s: 0.55, c: '#eafff2', d: 2.0 },
  { x: 796, y: 604, s: 0.65, c: '#45ff95', d: 1.3 },
  { x: 48, y: 512, s: 0.7, c: '#eafff2', d: 2.9 },
  { x: 1042, y: 168, s: 0.8, c: '#ffd76a', d: 0.2 },
  { x: 620, y: 262, s: 0.5, c: '#45ff95', d: 2.4 },
];

const STAR_D =
  'M0 -6 C1 -1.9 1.9 -1 6 0 C1.9 1 1 1.9 0 6 C-1 1.9 -1.9 1 -6 0 C-1.9 -1 -1 -1.9 0 -6 Z';

export function ArenaBackground() {
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const rawId = useId();
  const uid = rawId.replace(/:/g, '').replace(/[^a-zA-Z0-9]/g, '');
  const { width, height } = useWindowDimensions();

  // viewBox fixo do web (1080×1440) com slice — escala para o ecrã
  const vbW = 1080;
  const vbH = 1440;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id={`${uid}-base`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#061009" />
            <Stop offset="0.42" stopColor="#030705" />
            <Stop offset="1" stopColor="#050d08" />
          </LinearGradient>
          <RadialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#2DFF7E" stopOpacity="0.55" />
            <Stop offset="0.55" stopColor="#17B35A" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#0A5A30" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={`${uid}-beam`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#45FF95" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#1DE06E" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#0A5A30" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`${uid}-neon`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#45FF95" stopOpacity="0" />
            <Stop offset="0.4" stopColor="#8DFFC0" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#45FF95" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE9A3" />
            <Stop offset="0.5" stopColor="#F5B426" />
            <Stop offset="1" stopColor="#9A6D12" />
          </LinearGradient>
          <LinearGradient id={`${uid}-bottom`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2DFF7E" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#2DFF7E" stopOpacity="0.75" />
            <Stop offset="1" stopColor="#2DFF7E" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id={`${uid}-vig`} cx="0.5" cy="0.45" r="0.75">
            <Stop offset="0.55" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.62" />
          </RadialGradient>
        </Defs>

        {/* Base */}
        <Rect width={vbW} height={vbH} fill={`url(#${uid}-base)`} />

        {/* Brilhos verdes — cantos e base */}
        <Ellipse cx={120} cy={140} rx={520} ry={330} fill={`url(#${uid}-glow)`} opacity={0.75} />
        <Ellipse cx={980} cy={90} rx={460} ry={300} fill={`url(#${uid}-glow)`} opacity={0.6} />
        <Ellipse cx={540} cy={1460} rx={720} ry={330} fill={`url(#${uid}-glow)`} opacity={0.55} />
        <Ellipse cx={-40} cy={820} rx={320} ry={420} fill={`url(#${uid}-glow)`} opacity={0.35} />
        <Ellipse cx={1120} cy={760} rx={320} ry={420} fill={`url(#${uid}-glow)`} opacity={0.3} />

        {/* Raios diagonais neon (topo) — sem blur: gradientes já suaves */}
        <G opacity={0.85}>
          <Path d="M-80 250 L340 -70 L430 -10 L10 320 Z" fill={`url(#${uid}-beam)`} opacity={0.8} />
          <Path d="M-80 430 L250 180 L315 232 L-20 486 Z" fill={`url(#${uid}-beam)`} opacity={0.5} />
          <Path d="M1160 190 L740 -70 L650 -6 L1075 268 Z" fill={`url(#${uid}-beam)`} opacity={0.75} />
          <Path d="M1160 520 L930 366 L884 424 L1120 586 Z" fill={`url(#${uid}-beam)`} opacity={0.45} />
          <Path d="M-60 1180 L240 1380 L180 1440 L-60 1300 Z" fill={`url(#${uid}-beam)`} opacity={0.5} />
          <Path d="M1140 1120 L880 1360 L950 1420 L1140 1260 Z" fill={`url(#${uid}-beam)`} opacity={0.5} />
        </G>

        {/* Fios de neon finos (sem filter glow — stroke por cima mais larga) */}
        <G stroke={`url(#${uid}-neon)`} strokeLinecap="round" fill="none">
          <Line x1={-20} y1={268} x2={360} y2={-20} strokeWidth={7} opacity={0.2} />
          <Line x1={-20} y1={268} x2={360} y2={-20} strokeWidth={3} opacity={0.85} />
          <Line x1={-20} y1={352} x2={280} y2={130} strokeWidth={5} opacity={0.15} />
          <Line x1={-20} y1={352} x2={280} y2={130} strokeWidth={2} opacity={0.5} />
          <Line x1={1100} y1={214} x2={720} y2={-30} strokeWidth={7} opacity={0.2} />
          <Line x1={1100} y1={214} x2={720} y2={-30} strokeWidth={3} opacity={0.8} />
          <Line x1={1110} y1={470} x2={900} y2={322} strokeWidth={5} opacity={0.12} />
          <Line x1={1110} y1={470} x2={900} y2={322} strokeWidth={2} opacity={0.45} />
          <Line x1={-20} y1={1210} x2={250} y2={1392} strokeWidth={6} opacity={0.15} />
          <Line x1={-20} y1={1210} x2={250} y2={1392} strokeWidth={2.5} opacity={0.55} />
          <Line x1={1100} y1={1180} x2={870} y2={1372} strokeWidth={6} opacity={0.15} />
          <Line x1={1100} y1={1180} x2={870} y2={1372} strokeWidth={2.5} opacity={0.55} />
        </G>

        {/* Painéis tech (chevrons escuros com contorno verde) */}
        <G fill="none" stroke="#2DFF7E" strokeOpacity={0.16} strokeWidth={2.5}>
          <Path d="M40 60 L210 60 L286 150 L210 240 L40 240" />
          <Path d="M1040 60 L870 60 L794 150 L870 240 L1040 240" />
          <Path d="M40 1240 L200 1240 L270 1330 L200 1420 L40 1420" opacity={0.7} />
          <Path d="M1040 1240 L880 1240 L810 1330 L880 1420 L1040 1420" opacity={0.7} />
        </G>
        <G fill="#0A1A12" fillOpacity={0.55}>
          <Path d="M40 60 L210 60 L286 150 L210 240 L40 240 Z" />
          <Path d="M1040 60 L870 60 L794 150 L870 240 L1040 240 Z" />
        </G>

        {/* Brilho de base (linha verde) */}
        <Rect x={0} y={1424} width={vbW} height={10} fill={`url(#${uid}-bottom)`} opacity={0.8} />
        <Ellipse cx={540} cy={1440} rx={420} ry={60} fill="#2DFF7E" opacity={0.28} />

        {/* Chevron dourado da base (marca) */}
        <G fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M452 1352 L540 1414 L628 1352" stroke={`url(#${uid}-gold)`} strokeWidth={9} />
          <Path d="M486 1348 L540 1386 L594 1348" stroke="#FFE9A3" strokeOpacity={0.55} strokeWidth={3.5} />
        </G>

        {/* Vinheta */}
        <Rect width={vbW} height={vbH} fill={`url(#${uid}-vig)`} />

        {/* Estrelas cintilantes */}
        <G>
          {SPARKLES.map((sp, i) => (
            <Path
              key={i}
              d={STAR_D}
              transform={`translate(${sp.x} ${sp.y}) scale(${sp.s})`}
              fill={sp.c}
              opacity={reduceMotion ? 0.7 : 0.85}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}
