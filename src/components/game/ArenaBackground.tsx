'use client';

import { useId } from 'react';
import { useSettings } from '@/store/settings';
import { cn } from '@/lib/utils';

/**
 * Fundo de arena "game premium" — SVG escuro com:
 * - raios diagonais neon verdes (topo-esquerda / topo-direita)
 * - brilhos radiais verdes nos cantos e base
 * - painéis tech com chevrons dourados/verdes
 * - estrelas cintilantes
 * - chevron dourado na base (marca)
 */
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

export function ArenaBackground({ className }: { className?: string }) {
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1080 1440"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-base`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#061009" />
            <stop offset="0.42" stopColor="#030705" />
            <stop offset="1" stopColor="#050d08" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#2dff7e" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#17b35a" stopOpacity="0.18" />
            <stop offset="1" stopColor="#0a5a30" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#45ff95" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#1de06e" stopOpacity="0.22" />
            <stop offset="1" stopColor="#0a5a30" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-neon`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#45ff95" stopOpacity="0" />
            <stop offset="0.4" stopColor="#8dffc0" stopOpacity="0.9" />
            <stop offset="1" stopColor="#45ff95" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9a3" />
            <stop offset="0.5" stopColor="#f5b426" />
            <stop offset="1" stopColor="#9a6d12" />
          </linearGradient>
          <linearGradient id={`${uid}-bottom`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2dff7e" stopOpacity="0" />
            <stop offset="0.5" stopColor="#2dff7e" stopOpacity="0.75" />
            <stop offset="1" stopColor="#2dff7e" stopOpacity="0" />
          </linearGradient>
          <filter id={`${uid}-blur24`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
          <filter id={`${uid}-blur8`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id={`${uid}-glowline`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`${uid}-vig`} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
          </radialGradient>
        </defs>

        {/* Base */}
        <rect width="1080" height="1440" fill={`url(#${uid}-base)`} />

        {/* Brilhos verdes — cantos e base */}
        <ellipse cx="120" cy="140" rx="520" ry="330" fill={`url(#${uid}-glow)`} opacity="0.75" />
        <ellipse cx="980" cy="90" rx="460" ry="300" fill={`url(#${uid}-glow)`} opacity="0.6" />
        <ellipse cx="540" cy="1460" rx="720" ry="330" fill={`url(#${uid}-glow)`} opacity="0.55" />
        <ellipse cx="-40" cy="820" rx="320" ry="420" fill={`url(#${uid}-glow)`} opacity="0.35" />
        <ellipse cx="1120" cy="760" rx="320" ry="420" fill={`url(#${uid}-glow)`} opacity="0.3" />

        {/* Raios diagonais neon (topo) */}
        <g filter={`url(#${uid}-blur24)`}>
          <path d="M-80 250 L340 -70 L430 -10 L10 320 Z" fill={`url(#${uid}-beam)`} opacity="0.8" />
          <path d="M-80 430 L250 180 L315 232 L-20 486 Z" fill={`url(#${uid}-beam)`} opacity="0.5" />
          <path d="M1160 190 L740 -70 L650 -6 L1075 268 Z" fill={`url(#${uid}-beam)`} opacity="0.75" />
          <path d="M1160 520 L930 366 L884 424 L1120 586 Z" fill={`url(#${uid}-beam)`} opacity="0.45" />
          <path d="M-60 1180 L240 1380 L180 1440 L-60 1300 Z" fill={`url(#${uid}-beam)`} opacity="0.5" />
          <path d="M1140 1120 L880 1360 L950 1420 L1140 1260 Z" fill={`url(#${uid}-beam)`} opacity="0.5" />
        </g>

        {/* Fios de neon finos */}
        <g filter={`url(#${uid}-glowline)`} stroke={`url(#${uid}-neon)`} strokeLinecap="round">
          <path d="M-20 268 L360 -20" strokeWidth="3" fill="none" opacity="0.85" />
          <path d="M-20 352 L280 130" strokeWidth="2" fill="none" opacity="0.5" />
          <path d="M1100 214 L720 -30" strokeWidth="3" fill="none" opacity="0.8" />
          <path d="M1110 470 L900 322" strokeWidth="2" fill="none" opacity="0.45" />
          <path d="M-20 1210 L250 1392" strokeWidth="2.5" fill="none" opacity="0.55" />
          <path d="M1100 1180 L870 1372" strokeWidth="2.5" fill="none" opacity="0.55" />
        </g>

        {/* Painéis tech (chevrons escuros com contorno verde) */}
        <g fill="none" stroke="#2dff7e" strokeOpacity="0.16" strokeWidth="2.5">
          <path d="M40 60 L210 60 L286 150 L210 240 L40 240" />
          <path d="M1040 60 L870 60 L794 150 L870 240 L1040 240" />
          <path d="M40 1240 L200 1240 L270 1330 L200 1420 L40 1420" opacity="0.7" />
          <path d="M1040 1240 L880 1240 L810 1330 L880 1420 L1040 1420" opacity="0.7" />
        </g>
        <g fill="#0a1a12" fillOpacity="0.55">
          <path d="M40 60 L210 60 L286 150 L210 240 L40 240 Z" />
          <path d="M1040 60 L870 60 L794 150 L870 240 L1040 240 Z" />
        </g>

        {/* Brilho de base (linha verde) */}
        <rect x="0" y="1424" width="1080" height="10" fill={`url(#${uid}-bottom)`} filter={`url(#${uid}-blur8)`} />
        <ellipse cx="540" cy="1440" rx="420" ry="60" fill="#2dff7e" opacity="0.28" filter={`url(#${uid}-blur24)`} />

        {/* Chevron dourado da base (marca) */}
        <g
          filter={`url(#${uid}-glowline)`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M452 1352 L540 1414 L628 1352" stroke={`url(#${uid}-gold)`} strokeWidth="9" />
          <path d="M486 1348 L540 1386 L594 1348" stroke="#ffe9a3" strokeOpacity="0.55" strokeWidth="3.5" />
        </g>

        {/* Vinheta */}
        <rect width="1080" height="1440" fill={`url(#${uid}-vig)`} />

        {/* Estrelas cintilantes */}
        <g>
          {SPARKLES.map((sp, i) => (
            <path
              key={i}
              d={STAR_D}
              transform={`translate(${sp.x} ${sp.y}) scale(${sp.s})`}
              fill={sp.c}
              className={cn('arena-star', !reduceMotion && 'arena-star-animated')}
              style={reduceMotion ? { opacity: 0.7 } : { animationDelay: `${sp.d}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
