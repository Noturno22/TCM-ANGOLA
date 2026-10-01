'use client';

import { motion } from 'framer-motion';
import { Users, Bot, Swords, Gift, Check } from 'lucide-react';
import { useApp } from '@/store/app';
import { GameButton, GameLogo } from '@/components/game/ui';

export function WelcomeScreen() {
  const navigate = useApp((s) => s.navigate);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-y-auto">
      {/* Padrão de fundo */}
      <div className="pointer-events-none absolute inset-0 angolan-pattern opacity-50" />
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-1 angolan-border" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 angolan-border" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-full px-6 py-10 max-w-md mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center gap-2 mb-8"
        >
          <GameLogo size="lg" />
          <h1 className="font-display text-4xl tracking-wider mt-4 leading-none">
            TIRA O COCÓ DO MEIO
          </h1>
          <p className="text-gold font-display text-xl tracking-wide text-glow-gold">
            Joga, desafia, ganha!
          </p>
        </motion.div>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-sm text-muted-foreground text-center mb-6 max-w-xs"
        >
          O clássico jogo de estratégia angolano. Agora online, com pessoas reais!
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full space-y-2.5 mb-8"
        >
          <BenefitRow icon={<Bot className="w-4 h-4" />} text="Joga Online ou Offline" />
          <BenefitRow icon={<Users className="w-4 h-4" />} text="Salas e Torneios" />
          <BenefitRow icon={<Gift className="w-4 h-4" />} text="Apostas e Gratuito" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full space-y-2.5"
        >
          <GameButton variant="p2" className="w-full h-12 text-base" onClick={() => navigate('home')}>
            <Swords className="w-4 h-4 mr-2" />
            CRIAR CONTA
          </GameButton>
          <GameButton variant="outline" className="w-full h-12 text-base" onClick={() => navigate('home')}>
            ENTRAR
          </GameButton>
          <button
            type="button"
            onClick={() => navigate('home')}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline py-2"
          >
            Continuar como convidado
          </button>
        </motion.div>

        <p className="mt-6 text-[10px] text-muted-foreground/60 text-center max-w-xs">
          Bónus de boas-vindas até 5.000 KZ. Moeda virtual, sem dinheiro real.
        </p>
      </div>
    </div>
  );
}

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface/60 border border-border/40">
      <div className="w-8 h-8 rounded-full bg-p1/15 text-p1 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm text-foreground">{text}</span>
      <Check className="w-4 h-4 text-p1 ml-auto" />
    </div>
  );
}
