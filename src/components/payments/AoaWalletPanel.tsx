'use client';

/**
 * Painel da carteira de dinheiro real (AOA) — apenas consulta.
 *
 * Lê o saldo do servidor (ledger) e o extrato de movimentos.
 * Sem depósitos nem levantamentos: a carteira é somente de leitura.
 *
 * NÃO confundir com a moeda virtual do jogo (`useProfile().coins`), que é
 * separada e sem valor monetário.
 *
 * Enquanto a chave-mestra `REAL_MONEY_ENABLED` estiver desligada (D6) mostra
 * apenas um aviso "em breve" e não faz qualquer leitura ao backend.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Coins,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/app';
import { fetchAccount, fetchBalanceMinor, fetchLedger } from '@/lib/payments/client';
import { REAL_MONEY_ENABLED } from '@/lib/config/flags';
import { formatMinor, type AccountRow, type LedgerEntryRow } from '@/lib/payments/types';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { cn } from '@/lib/utils';

export function AoaWalletPanel() {
  const user = useAuth((s) => s.user);
  const initialize = useAuth((s) => s.initialize);
  const navigate = useApp((s) => s.navigate);

  const [account, setAccount] = useState<AccountRow | null>(null);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!REAL_MONEY_ENABLED || !user) return;
    setLoading(true);
    try {
      const acc = await fetchAccount('AOA');
      setAccount(acc);
      if (acc) {
        const [bal, entries] = await Promise.all([
          fetchBalanceMinor(acc.id),
          fetchLedger(acc.id, 20),
        ]);
        setBalanceMinor(bal);
        setLedger(entries);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar a carteira.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!REAL_MONEY_ENABLED || !user) return;
    (async () => {
      try {
        const acc = await fetchAccount('AOA');
        if (!active) return;
        setAccount(acc);
        if (acc) {
          const [bal, entries] = await Promise.all([
            fetchBalanceMinor(acc.id),
            fetchLedger(acc.id, 20),
          ]);
          if (!active) return;
          setBalanceMinor(bal);
          setLedger(entries);
        }
        if (active) setLoadError(null);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : 'Falha ao carregar a carteira.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (!REAL_MONEY_ENABLED) {
    return (
      <div>
        <SectionTitle title="Carteira (AOA)" />
        <GameCard className="p-5 text-center space-y-3">
          <Banknote className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Em breve. O Tira o Cocó do Meio só usa moeda virtual e ainda não movimenta dinheiro real.
          </p>
        </GameCard>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <SectionTitle title="Carteira (AOA)" />
        <GameCard className="p-5 text-center space-y-3">
          <Coins className="w-8 h-8 text-gold mx-auto" />
          <p className="text-sm text-muted-foreground">
            Inicia sessão para consultar o teu saldo real.
          </p>
          <GameButton
            variant="gold"
            onClick={() => {
              initialize();
              navigate('auth');
            }}
          >
            Iniciar sessão
          </GameButton>
        </GameCard>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        title="Carteira (AOA)"
        action={
          <button
            type="button"
            onClick={() => refresh()}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            aria-label="Atualizar saldo"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </button>
        }
      />

      {/* Saldo real */}
      <GameCard className="p-5 mb-3" glow="gold">
        <p className="text-[11px] uppercase tracking-widest text-gold font-semibold flex items-center gap-1.5">
          <Banknote className="w-3.5 h-3.5" />
          Saldo real disponível
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
          ) : (
            <>
              <span className="font-display text-4xl tracking-wide text-gold tabular-nums">
                {formatMinor(balanceMinor)}
              </span>
              <span className="font-display text-lg text-gold/70">AOA</span>
            </>
          )}
        </div>
        {loadError && <p className="text-xs text-p2 mt-2">{loadError}</p>}
      </GameCard>

      {/* Extrato real */}
      <div className="mt-4">
        <SectionTitle
          title="Movimentos"
          action={
            <span className="text-xs text-muted-foreground">
              {ledger.length} {ledger.length === 1 ? 'movimento' : 'movimentos'}
            </span>
          }
        />
        <GameCard className="divide-y divide-border/30">
          {loading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : ledger.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Ainda não tens movimentos reais.
            </div>
          ) : (
            ledger.map((e) => (
              <div key={e.id} className="p-3 flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    e.entry_type === 'credit' ? 'bg-p1/15 text-p1' : 'bg-p2/15 text-p2',
                  )}
                >
                  {e.entry_type === 'credit' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {e.description ?? (e.entry_type === 'credit' ? 'Crédito' : 'Movimento')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
                <span
                  className={cn(
                    'font-display text-sm tabular-nums',
                    e.entry_type === 'credit' ? 'text-p1' : 'text-p2',
                  )}
                >
                  {e.entry_type === 'credit' ? '+' : '−'}
                  {formatMinor(e.amount_minor)} AOA
                </span>
              </div>
            ))
          )}
        </GameCard>
      </div>

      {account?.status === 'frozen' && (
        <p className="text-xs text-p2 mt-3 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          A tua conta está congelada. Contacta o suporte.
        </p>
      )}

      <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-surface/60 border border-border/40 mt-4">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Consulta o teu saldo real e o histórico de movimentos da conta.
        </p>
      </div>
    </div>
  );
}
