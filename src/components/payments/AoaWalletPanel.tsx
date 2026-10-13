'use client';

/**
 * Painel da carteira de dinheiro real (AOA).
 *
 * Lê o saldo do servidor (ledger) e cria depósitos via Edge Function
 * `create-deposit-intent`. O crédito acontece só depois do webhook do PSP,
 * por isso a UI faz polling até o saldo refletir a confirmação.
 *
 * NÃO confundir com a moeda virtual do jogo (`useProfile().coins`), que é
 * separada e sem valor monetário.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  Coins,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/app';
import {
  createDeposit,
  fetchAccount,
  fetchBalanceMinor,
  fetchKycRecords,
  fetchLedger,
  fetchPayouts,
} from '@/lib/payments/client';
import {
  MIN_DEPOSIT_MINOR,
  aoaFromMinor,
  formatMinor,
  minorFromAoa,
  newIdempotencyKey,
  type AccountRow,
  type KycRecordRow,
  type LedgerEntryRow,
  type PaymentProviderId,
  type PayoutRow,
} from '@/lib/payments/types';
import { enabledProvidersForCurrency } from '@/lib/payments/providers';
import { KycPanel } from '@/components/payments/KycPanel';
import { PayoutPanel } from '@/components/payments/PayoutPanel';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { cn } from '@/lib/utils';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60_000;

const AOA_PROVIDERS = enabledProvidersForCurrency('AOA');

export function AoaWalletPanel() {
  const user = useAuth((s) => s.user);
  const initialize = useAuth((s) => s.initialize);
  const navigate = useApp((s) => s.navigate);

  const [account, setAccount] = useState<AccountRow | null>(null);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntryRow[]>([]);
  const [kycRecords, setKycRecords] = useState<KycRecordRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [providerId, setProviderId] = useState<PaymentProviderId>(AOA_PROVIDERS[0]?.id ?? 'mock');
  const [submitting, setSubmitting] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const pollStartedAt = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [acc, kyc] = await Promise.all([fetchAccount('AOA'), fetchKycRecords()]);
      setAccount(acc);
      setKycRecords(kyc);
      if (acc) {
        const [bal, entries, ps] = await Promise.all([
          fetchBalanceMinor(acc.id),
          fetchLedger(acc.id, 20),
          fetchPayouts(acc.id, 20),
        ]);
        setBalanceMinor(bal);
        setLedger(entries);
        setPayouts(ps);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Falha ao carregar a carteira.');
    }
  }, [user]);

  // Carregamento inicial / quando o utilizador muda.
  useEffect(() => {
    let active = true;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user, refresh]);

  // Pagamento pendente: faz polling até o saldo refletir o webhook.
  useEffect(() => {
    if (!pendingKey) return;
    pollStartedAt.current = Date.now();
    const id = setInterval(async () => {
      await refresh();
      if (pollStartedAt.current && Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
        clearInterval(id);
        setPendingKey(null);
        toast.info('Ainda não recebemos a confirmação do pagamento.', {
          description: 'Se já pagaste, o saldo atualiza assim que o PSP confirmar.',
        });
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pendingKey, refresh]);

  const amountMinor = minorFromAoa(Number(amount) || 0);
  const amountError =
    amount !== '' && amountMinor > 0 && amountMinor < MIN_DEPOSIT_MINOR
      ? `Mínimo ${formatMinor(MIN_DEPOSIT_MINOR)} AOA.`
      : null;
  const canSubmit = Boolean(user) && amountMinor >= MIN_DEPOSIT_MINOR && !submitting && AOA_PROVIDERS.length > 0;
  const kycApproved = kycRecords.some((r) => r.status === 'approved');

  const handleDeposit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const idempotencyKey = newIdempotencyKey();
    try {
      const intent = await createDeposit({
        amountMinor,
        currency: 'AOA',
        provider: providerId,
        idempotencyKey,
        returnUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}/?deposit=return`
            : undefined,
      });
      setAmount('');
      if (intent.checkout_url && typeof window !== 'undefined') {
        window.open(intent.checkout_url, '_blank', 'noopener');
      }
      setPendingKey(idempotencyKey);
      toast.success('Depósito iniciado.', {
        description: 'Conclui o pagamento na janela aberta. O saldo atualiza após confirmação.',
        duration: 6000,
      });
    } catch (err) {
      toast.error('Não foi possível iniciar o depósito.', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Sem sessão: convida a entrar.
  if (!user) {
    return (
      <div>
        <SectionTitle title="Carteira (AOA)" />
        <GameCard className="p-5 text-center space-y-3">
          <Coins className="w-8 h-8 text-gold mx-auto" />
          <p className="text-sm text-muted-foreground">
            Inicia sessão para adicionar e consultar o teu saldo real.
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
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            aria-label="Atualizar saldo"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </button>
        }
      />

      {/* Saldo real */}
      <GameCard className="p-5 mb-3" glow="gold">
        <p className="text-[10px] uppercase tracking-widest text-gold font-semibold flex items-center gap-1.5">
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
        {pendingKey && (
          <p className="text-[11px] text-gold/80 mt-2 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            À espera da confirmação do pagamento…
          </p>
        )}
        {loadError && <p className="text-[11px] text-p2 mt-2">{loadError}</p>}
      </GameCard>

      {/* Depósito */}
      <GameCard className="p-4 space-y-4">
        <div>
          <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">
            Método de depósito
          </p>
          {AOA_PROVIDERS.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Métodos de depósito em configuração.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {AOA_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border-2 text-left transition-all',
                    providerId === p.id
                      ? 'border-gold bg-gold/5'
                      : 'border-border bg-surface hover:bg-surface-2',
                  )}
                >
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    {providerId === p.id && <Check className="w-3.5 h-3.5 text-gold" />}
                    {p.label}
                  </span>
                  <span className="block text-[9px] text-muted-foreground">{p.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Valor (AOA)
          </label>
          <div className="relative mt-1.5">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(aoaFromMinor(MIN_DEPOSIT_MINOR))}
              min={aoaFromMinor(MIN_DEPOSIT_MINOR)}
              step="1"
              className={cn(
                'w-full h-12 px-4 pr-16 rounded-lg border bg-surface text-lg font-semibold tabular-nums',
                'focus:outline-none focus:border-gold transition-colors',
                amountError ? 'border-p2' : 'border-border',
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              AOA
            </span>
          </div>
          {amountError && (
            <p className="text-[11px] text-p2 mt-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              {amountError}
            </p>
          )}
        </div>

        <GameButton
          variant="p1"
          className="w-full h-12"
          onClick={handleDeposit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ArrowDownLeft className="w-4 h-4 mr-2" />
          )}
          DEPOSITAR
        </GameButton>

        <div className="flex gap-2">
          {[500, 1000, 5000, 20000].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className={cn(
                'flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors',
                amount === String(v)
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'bg-surface-2 text-muted-foreground hover:text-foreground',
              )}
            >
              {v.toLocaleString('pt-PT')}
            </button>
          ))}
        </div>
      </GameCard>

      {/* KYC + Levantamento */}
      <KycPanel records={kycRecords} onRefresh={refresh} />
      <PayoutPanel
        accountId={account?.id ?? null}
        balanceMinor={balanceMinor}
        kycApproved={kycApproved}
        payouts={payouts}
        onRefresh={refresh}
      />

      {/* Extrato real */}
      <div className="mt-4">
        <SectionTitle
          title="Movimentos"
          action={
            <span className="text-[11px] text-muted-foreground">
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
                    {e.description ?? (e.entry_type === 'credit' ? 'Depósito' : 'Movimento')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
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
        <p className="text-[11px] text-p2 mt-3 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          A tua conta está congelada. Contacta o suporte.
        </p>
      )}

      <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-surface/60 border border-border/40 mt-4">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Os depósitos são processados pelo prestador de pagamentos. O saldo só é creditado após a
          confirmação. Levantamentos requerem verificação de identidade (KYC).
        </p>
      </div>
    </div>
  );
}
