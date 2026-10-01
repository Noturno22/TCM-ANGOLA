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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6"
      >
        <GameLogo size="lg" />

        <div className="text-center">
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide text-foreground leading-none">
            TIRA O COCÓ
          </h1>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-gold leading-none mt-1">
            DO MEIO
          </h2>
        </div>

        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase font-medium">
          Estratégia • Movimento • Conquista
        </p>

        <div className="w-48 h-1 rounded-full bg-surface-2 overflow-hidden mt-6">
          <div
            className="h-full bg-p1 rounded-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[10px] tracking-widest text-muted-foreground/60 uppercase mt-1">
          A jogar com Angola
        </p>
      </motion.div>
    </div>
  );
}
