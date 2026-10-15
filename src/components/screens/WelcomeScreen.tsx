'use client';

import { motion } from 'framer-motion';
import { Users, Bot, Swords, Gift } from 'lucide-react';
import { useApp } from '@/store/app';
import { GameButton, GameLogo } from '@/components/game/ui';

export function WelcomeScreen() {
  const navigate = useApp((s) => s.navigate);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-y-auto">
      {/* Padrão de fundo */}
      <div className="pointer-events-none absolute inset-0 angolan-pattern" />
      {/* Brilho superior */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            'radial-gradient(70% 100% at 50% 0%, oklch(0.83 0.14 85 / 0.10), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-full px-6 py-10 max-w-md mx-auto w-full">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center gap-3 mb-8"
        >
          <GameLogo size="lg" />
          <h1 className="font-display text-4xl tracking-wide mt-3 leading-none">
            TIRA O COCÓ DO MEIO
          </h1>
          <p className="text-gold text-base font-medium">Joga, desafia, ganha!</p>
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
          <BenefitRow icon={<Bot className="w-4 h-4" />} text="Joga online ou offline" />
          <BenefitRow icon={<Users className="w-4 h-4" />} text="Salas e torneios" />
          <BenefitRow icon={<Gift className="w-4 h-4" />} text="Bónus e modo gratuito" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full space-y-2.5"
        >
          <GameButton
            variant="primary"
            className="w-full h-12 text-base"
            onClick={() => navigate('auth')}
          >
            <Swords className="w-5 h-5 mr-2" />
            Criar conta
          </GameButton>
          <GameButton
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => navigate('auth')}
          >
            Entrar
          </GameButton>
          <button
            type="button"
            onClick={() => navigate('home')}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2.5"
          >
            Continuar como convidado
          </button>
        </motion.div>

        <p className="mt-6 text-xs text-muted-foreground/70 text-center max-w-xs">
          Bónus de boas-vindas até 5.000 KZ. Moeda virtual, sem dinheiro real.
        </p>
      </div>
    </div>
  );
}

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-border">
      <div className="w-9 h-9 rounded-xl bg-gold/12 text-gold flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground">{text}</span>
    </div>
  );
}
