'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/store/app';
import { GameLogo } from '@/components/game/ui';

export function SplashScreen() {
  const navigate = useApp((s) => s.navigate);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => navigate('welcome'), 300);
          return 100;
        }
        return p + 4;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Brilho de fundo subtil */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 40% at 50% 38%, oklch(0.83 0.14 85 / 0.10), transparent 70%)',
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative flex flex-col items-center gap-6"
      >
        <GameLogo size="lg" />

        <div className="text-center">
          <h1 className="font-display text-5xl sm:text-6xl tracking-wide text-foreground leading-none">
            TIRA O COCÓ
          </h1>
          <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-gold leading-none mt-1">
            DO MEIO
          </h2>
        </div>

        <p className="text-xs tracking-[0.28em] text-muted-foreground uppercase font-medium">
          Estratégia • Movimento • Conquista
        </p>

        <div className="w-56 h-1.5 rounded-full bg-surface-2 overflow-hidden mt-6">
          <div
            className="h-full bg-gold rounded-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[11px] tracking-[0.2em] text-muted-foreground/70 uppercase">
          A jogar com Angola
        </p>
      </motion.div>
    </div>
  );
}
