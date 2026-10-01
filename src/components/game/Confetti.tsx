'use client';

import { useMemo } from 'react';

/**
 * Confetti de vitória — peças coloridas que caem do topo.
 * Usa cores do jogo (verde, vermelho, dourado, laranja).
 * Respeita reduceMotion (não anima se ativo).
 */
const COLORS = ['var(--p1)', 'var(--p2)', 'var(--gold)', 'var(--orange)', '#ffffff'];

export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 8,
      rotate: Math.random() * 360,
    }));
  }, [count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size * 1.5}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
            borderRadius: Math.random() > 0.5 ? '2px' : '50%',
            zIndex: 60,
          }}
        />
      ))}
    </div>
  );
}
