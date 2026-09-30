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
      {/* Padrão angolano nos cantos */}
      <div className="pointer-events-none absolute top-0 left-0 w-32 h-32 angolan-diamond opacity-40" />
      <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 angolan-diamond opacity-40" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-32 h-32 angolan-diamond opacity-40" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-32 h-32 angolan-diamond opacity-40" />

      {/* Faixa decorativa horizontal */}
      <div className="pointer-events-none absolute top-1/4 left-0 right-0 h-1 angolan-border opacity-30" />
      <div className="pointer-events-none absolute bottom-1/4 left-0 right-0 h-1 angolan-border opacity-30" />

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6 z-10"
      >
        <GameLogo size="lg" />

        <div className="text-center">
          <h1 className="font-display text-5xl sm:text-6xl tracking-wider text-foreground leading-none">
            TIRA O COCÓ
          </h1>
          <h2 className="font-display text-3xl sm:text-4xl tracking-wider text-gold text-glow-gold leading-none mt-1">
            DO MEIO
          </h2>
        </div>

        <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
          Estratégia • Movimento • Conquista
        </p>

        <div className="w-48 h-1 rounded-full bg-surface-2 overflow-hidden mt-8">
          <motion.div
            className="h-full bg-gradient-to-r from-p1 to-gold"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[10px] tracking-widest text-muted-foreground/70 uppercase mt-2">
          A jogar com Angola
        </p>
      </motion.div>
    </div>
  );
}
