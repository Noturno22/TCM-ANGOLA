'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export type RobotVariant = 'human' | 'ai';

/**
 * Avatares robot em SVG (sem imagens/emoji):
 * - `human`: robot branco amigável com viseira e olhos verdes neon (o "Tu")
 * - `ai`: robot escuro ameaçador com olhos vermelhos (a IA)
 */
export function RobotAvatar({
  variant,
  className,
}: {
  variant: RobotVariant;
  className?: string;
}) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-full w-full', className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7faf8" />
          <stop offset="0.55" stopColor="#d7dedb" />
          <stop offset="1" stopColor="#aab4b0" />
        </linearGradient>
        <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2f33" />
          <stop offset="0.55" stopColor="#15181b" />
          <stop offset="1" stopColor="#08090b" />
        </linearGradient>
        <radialGradient id={`${uid}-eyeG`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#eafff2" />
          <stop offset="0.45" stopColor="#45ff95" />
          <stop offset="1" stopColor="#0fae4f" />
        </radialGradient>
        <radialGradient id={`${uid}-eyeR`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#ffd9d9" />
          <stop offset="0.4" stopColor="#ff3b3b" />
          <stop offset="1" stopColor="#a30f0f" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={`${uid}-rim`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {variant === 'human' ? (
        <g>
          {/* antena */}
          <path d="M32 13 L32 7" stroke="#8b9591" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="5" r="3" fill={`url(#${uid}-eyeG)`} filter={`url(#${uid}-soft)`} />
          <circle cx="32" cy="5" r="2.2" fill="#45ff95" />

          {/* orelhas */}
          <rect x="7" y="22" width="7" height="16" rx="3.5" fill={`url(#${uid}-metal)`} stroke="#7d8783" strokeWidth="1.2" />
          <rect x="50" y="22" width="7" height="16" rx="3.5" fill={`url(#${uid}-metal)`} stroke="#7d8783" strokeWidth="1.2" />

          {/* corpo */}
          <path d="M15 56 C15 49 22 46 32 46 C42 46 49 49 49 56 Z" fill={`url(#${uid}-metal)`} stroke="#7d8783" strokeWidth="1.2" />
          <circle cx="32" cy="52" r="3" fill="#45ff95" opacity="0.9" />

          {/* cabeça */}
          <rect x="13" y="12" width="38" height="33" rx="11" fill={`url(#${uid}-metal)`} stroke="#7d8783" strokeWidth="1.4" />
          <rect x="16.5" y="15" width="31" height="9" rx="4.5" fill="#ffffff" opacity="0.55" />

          {/* viseira */}
          <rect x="18.5" y="20.5" width="27" height="16" rx="8" fill="#04100a" />
          <rect x="21.5" y="23.5" width="8" height="9" rx="4" fill={`url(#${uid}-eyeG)`} filter={`url(#${uid}-soft)`} />
          <rect x="34.5" y="23.5" width="8" height="9" rx="4" fill={`url(#${uid}-eyeG)`} filter={`url(#${uid}-soft)`} />
          <rect x="22.8" y="24.8" width="5.4" height="6.4" rx="2.7" fill="#8dffc0" />
          <rect x="35.8" y="24.8" width="5.4" height="6.4" rx="2.7" fill="#8dffc0" />

          {/* boca */}
          <path d="M27 39.5 Q32 42 37 39.5" stroke="#0fae4f" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <g>
          {/* crista vermelha */}
          <path d="M32 4 L37 13 L27 13 Z" fill="#ff3b3b" />
          <path d="M32 7.5 L34.6 12.4 L29.4 12.4 Z" fill="#ffd9d9" opacity="0.85" />

          {/* chifres laterais */}
          <path d="M12 18 L4 14 L9 24 Z" fill={`url(#${uid}-dark)`} stroke="#3a4045" strokeWidth="1.2" />
          <path d="M52 18 L60 14 L55 24 Z" fill={`url(#${uid}-dark)`} stroke="#3a4045" strokeWidth="1.2" />

          {/* corpo escuro */}
          <path d="M14 57 C14 50 21 46.5 32 46.5 C43 46.5 50 50 50 57 Z" fill={`url(#${uid}-dark)`} stroke="#3a4045" strokeWidth="1.2" />
          <path d="M26 50 L32 56 L38 50" fill="none" stroke="#ff3b3b" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />

          {/* cabeça angular */}
          <path
            d="M13 20 L24 9 L40 9 L51 20 L49 40 L32 51 L15 40 Z"
            fill={`url(#${uid}-dark)`}
            stroke="#454c51"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M24.5 12 L39.5 12 L47.5 20 L16.5 20 Z" fill="#ffffff" opacity="0.07" />

          {/* olhos vermelhos inclinados */}
          <g filter={`url(#${uid}-rim)`}>
            <path d="M17.5 25.5 L29.5 28.8 L28.2 35.4 L16.4 32 Z" fill={`url(#${uid}-eyeR)`} />
            <path d="M46.5 25.5 L34.5 28.8 L35.8 35.4 L47.6 32 Z" fill={`url(#${uid}-eyeR)`} />
          </g>
          <path d="M18.6 27 L28.4 29.7 L27.7 33.4 L18 30.8 Z" fill="#ffe3e3" opacity="0.9" />
          <path d="M45.4 27 L35.6 29.7 L36.3 33.4 L46 30.8 Z" fill="#ffe3e3" opacity="0.9" />

          {/* grelha da boca */}
          <g stroke="#ff3b3b" strokeWidth="1.4" strokeLinecap="round" opacity="0.8">
            <path d="M25 41 L39 41" />
            <path d="M26.5 44 L37.5 44" />
            <path d="M28.5 47 L35.5 47" />
          </g>
        </g>
      )}
    </svg>
  );
}
