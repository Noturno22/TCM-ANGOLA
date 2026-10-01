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
          setTimeout(() => navigate('welcome'), 400);
          return 100;
        }
        return p + 3.5;
      });
    }, 45);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Mesh gradient subtil de fundo */}
      <div className="pointer-events-none absolute inset-0 mesh-gradient opacity-40" />

      {/* Padrão angolano nos cantos — mais elegante */}
      <div className="pointer-events-none absolute top-0 left-0 w-40 h-40 angolan-diamond opacity-30" />
      <div className="pointer-events-none absolute top-0 right-0 w-40 h-40 angolan-diamond opacity-30" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-40 h-40 angolan-diamond opacity-30" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-40 h-40 angolan-diamond opacity-30" />

      {/* Faixas decorativas horizontais com gradiente */}
      <div className="pointer-events-none absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="pointer-events-none absolute bottom-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6 z-10"
      >
        {/* Logo com brilho pulsante */}
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <GameLogo size="lg" />
        </motion.div>

        {/* Título com animação escalonada */}
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-display text-5xl sm:text-6xl tracking-wider text-foreground leading-none"
          >
            TIRA O COCÓ
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="font-display text-3xl sm:text-4xl tracking-wider text-gold text-glow-gold leading-none mt-1"
          >
            DO MEIO
          </motion.h2>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase font-medium"
        >
          Estratégia • Movimento • Conquista
        </motion.p>

        {/* Barra de progresso premium */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.6 }}
          className="w-56 h-1 rounded-full bg-surface-2/60 overflow-hidden mt-6 relative"
        >
          <div
            className="h-full bg-gradient-to-r from-p1 via-gold to-gold-bright rounded-full transition-all duration-100 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Brilho subtil na frente da barra */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/40 blur-[1px]" />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="text-[10px] tracking-widest text-muted-foreground/60 uppercase mt-2 font-medium"
        >
          A jogar com Angola
        </motion.p>
      </motion.div>
    </div>
  );
}
