'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Coins,
  Gift,
  Lock,
  Trophy,
  Flame,
  Handshake,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  CalendarCheck,
} from 'lucide-react';
import { useProfile } from '@/store/profile';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Mission {
  id: string;
  label: string;
  icon: React.ReactNode;
  current: number;
  target: number;
  reward: number;
  color: 'p1' | 'p2' | 'gold' | 'orange';
}

interface Transaction {
  id: string;
  label: string;
  amount: number;
  date: string;
  type: 'in' | 'out';
}

export function WalletScreen() {
  const profile = useProfile();
  const addCoins = useProfile((s) => s.addCoins);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  const missions: Mission[] = useMemo(
    () => [
      {
        id: 'play3',
        label: 'Joga 3 partidas',
        icon: <Trophy className="w-4 h-4" />,
        current: Math.min(profile.totalMatches, 3),
        target: 3,
        reward: 150,
        color: 'gold',
      },
      {
        id: 'streak2',
        label: 'Vence 2 seguidas',
        icon: <Flame className="w-4 h-4" />,
        current: Math.min(profile.currentStreak, 2),
        target: 2,
        reward: 200,
        color: 'p2',
      },
      {
        id: 'draw1',
        label: 'Empata 1 partida',
        icon: <Handshake className="w-4 h-4" />,
        current: Math.min(profile.draws, 1),
        target: 1,
        reward: 50,
        color: 'orange',
      },
    ],
    [profile.totalMatches, profile.currentStreak, profile.draws],
  );

  /** Histórico simulado: bónus de boas-vindas + últimos resultados. */
  const transactions: Transaction[] = useMemo(() => {
    const txs: Transaction[] = [
      {
        id: 'welcome',
        label: 'Bónus de boas-vindas',
        amount: 5000,
        date: 'Início',
        type: 'in',
      },
    ];
    // Adicionar transações com base no histórico de partidas
    for (const m of profile.matches.slice(0, 5)) {
      const won = m.playerSide && m.result === m.playerSide;
      const draw = m.result === 'DRAW';
      let amount = 0;
      if (won) amount = 100;
      else if (draw) amount = 20;
      else amount = 10;
      txs.push({
        id: m.id,
        label: `${won ? 'Vitória' : draw ? 'Empate' : 'Partida'} vs ${m.opponent}`,
        amount,
        date: new Date(m.date).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
        }),
        type: 'in',
      });
    }
    return txs;
  }, [profile.matches]);

  const handleClaimBonus = () => {
    if (bonusClaimed) return;
    addCoins(500);
    setBonusClaimed(true);
    toast.success('Bónus diário recebido!', {
      description: '+500 KZ adicionados à tua carteira.',
    });
  };

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Saldo em destaque */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GameCard className="p-6 overflow-hidden relative" glow="gold">
          {/* Padrão decorativo */}
          <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 angolan-diamond opacity-20" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest text-gold font-semibold flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              Saldo disponível
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display text-6xl tracking-wider text-gold text-glow-gold leading-none">
                {profile.coins.toLocaleString('pt-PT')}
              </span>
              <span className="font-display text-2xl text-gold/70">KZ</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Moeda virtual · Sem valor real
            </p>
          </div>
        </GameCard>
      </motion.div>

      {/* Bónus diário */}
      <GameCard className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors',
              bonusClaimed
                ? 'bg-surface-2 text-muted-foreground'
                : 'bg-gold/15 text-gold animate-pulse-glow',
            )}
          >
            {bonusClaimed ? <CalendarCheck className="w-6 h-6" /> : <Gift className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg tracking-wide">Bónus Diário</h3>
            <p className="text-[11px] text-muted-foreground">
              {bonusClaimed
                ? 'Já recebeste o teu bónus hoje. Volta amanhã!'
                : 'Recebe 500 KZ grátis. Disponível uma vez por dia.'}
            </p>
          </div>
          <GameButton
            variant={bonusClaimed ? 'outline' : 'gold'}
            size="sm"
            onClick={handleClaimBonus}
            disabled={bonusClaimed}
            aria-label="Receber bónus diário"
          >
            {bonusClaimed ? (
              'Recebido'
            ) : (
              <>
                <Gift className="w-3.5 h-3.5 mr-1" />
                Receber
              </>
            )}
          </GameButton>
        </div>
      </GameCard>

      {/* Missões */}
      <div>
        <SectionTitle title="Missões" />
        <div className="space-y-2">
          {missions.map((m) => {
            const pct = (m.current / m.target) * 100;
            const done = m.current >= m.target;
            return (
              <GameCard key={m.id} className={cn('p-3', done && 'border-p1/40')}>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      m.color === 'p1' && 'bg-p1/15 text-p1',
                      m.color === 'p2' && 'bg-p2/15 text-p2',
                      m.color === 'gold' && 'bg-gold/15 text-gold',
                      m.color === 'orange' && 'bg-orange/15 text-orange',
                    )}
                  >
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{m.label}</p>
                      <span
                        className={cn(
                          'text-[10px] font-bold flex items-center gap-0.5 shrink-0',
                          done ? 'text-p1' : 'text-gold',
                        )}
                      >
                        <Coins className="w-3 h-3" />
                        +{m.reward}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={pct} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {m.current}/{m.target}
                      </span>
                    </div>
                  </div>
                </div>
              </GameCard>
            );
          })}
        </div>
      </div>

      {/* Histórico de transações */}
      <div>
        <SectionTitle
          title="Histórico"
          action={
            <span className="text-[11px] text-muted-foreground">{transactions.length} movimentos</span>
          }
        />
        <GameCard className="divide-y divide-border/30">
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Ainda não tens movimentos.
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-3 flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    tx.type === 'in' ? 'bg-p1/15 text-p1' : 'bg-p2/15 text-p2',
                  )}
                >
                  {tx.type === 'in' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.label}</p>
                  <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                </div>
                <span
                  className={cn(
                    'font-display text-base tabular-nums',
                    tx.type === 'in' ? 'text-p1' : 'text-p2',
                  )}
                >
                  {tx.type === 'in' ? '+' : '−'}
                  {tx.amount} KZ
                </span>
              </div>
            ))
          )}
        </GameCard>
      </div>

      {/* Comprar moedas — placeholder desativado */}
      <GameCard className="p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface-2 flex items-center justify-center text-muted-foreground shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Comprar moedas</h3>
            <p className="text-[11px] text-muted-foreground">Em breve</p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 rounded bg-surface-2">
            Em breve
          </span>
        </div>
      </GameCard>

      {/* Aviso de jogo responsável */}
      <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-surface/60 border border-border/40">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Joga com responsabilidade.</strong> O Tira o Cocó do
          Meio não envolve dinheiro real — todas as moedas são virtuais e sem valor monetário. Joga
          por diversão.
        </p>
      </div>
    </div>
  );
}
