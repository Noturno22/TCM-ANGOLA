'use client';

/**
 * Depósitos e levantamentos de dinheiro real (fluxo manual com comprovativo).
 *
 * Portado do `depositos.tsx` do TMT (tabs depositar/levantar + histórico).
 * O utilizador escolhe método, valor e anexa o comprovativo; o pedido fica
 * pendente até um administrador aprovar (Edge Function `admin-manage`).
 *
 * Gated pela chave-mestra `REAL_MONEY_ENABLED` (D6) e por sessão iniciada.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Clock,
  Landmark,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/app';
import { useWalletMovements, type WalletMovement } from '@/store/walletMovements';
import { REAL_MONEY_ENABLED } from '@/lib/config/flags';
import { fetchAccount, fetchBalanceMinor } from '@/lib/payments/client';
import {
  MAX_DEPOSIT,
  MAX_WITHDRAWAL,
  MIN_DEPOSIT,
  MIN_WITHDRAWAL,
  formatMoney,
  fileToReceipt,
  hasPendingDeposit,
  methodsForCurrency,
  saveReceipt,
  submitWithdrawal,
  uploadReceipt,
  type ManualCurrency,
  type PaymentMethodId,
} from '@/lib/payments/manual';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentModal } from '@/components/payments/PaymentModal';
import { ReceiptSuccessModal } from '@/components/payments/ReceiptSuccessModal';
import { cn } from '@/lib/utils';

const CURRENCIES: ManualCurrency[] = ['aoa', 'usd'];

const METHOD_ICONS: Record<PaymentMethodId, React.ReactNode> = {
  binance: <Landmark className="w-5 h-5" />,
  rodotpay: <Smartphone className="w-5 h-5" />,
  express: <Smartphone className="w-5 h-5" />,
};

const STATUS_LABEL: Record<WalletMovement['status'], string> = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  recusado: 'Recusado',
};

const STATUS_CLASS: Record<WalletMovement['status'], string> = {
  pendente: 'bg-orange/15 text-orange border-orange/30',
  concluido: 'bg-p1/15 text-p1 border-p1/30',
  recusado: 'bg-p2/15 text-p2 border-p2/30',
};

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

export function DepositScreen() {
  const user = useAuth((s) => s.user);
  const initialize = useAuth((s) => s.initialize);
  const navigate = useApp((s) => s.navigate);
  const tab = useApp((s) => s.depositTab);
  const setTab = useApp((s) => s.setDepositTab);

  const movements = useWalletMovements((s) => s.movements);
  const movementsLoading = useWalletMovements((s) => s.loading);
  const loadMovements = useWalletMovements((s) => s.load);
  const addMovement = useWalletMovements((s) => s.addMovement);
  const deleteMovement = useWalletMovements((s) => s.deleteMovement);

  const [currency, setCurrency] = useState<ManualCurrency>('aoa');
  const [amountStr, setAmountStr] = useState('');
  const [method, setMethod] = useState<PaymentMethodId>('rodotpay');
  const [details, setDetails] = useState('');

  const [proofOpen, setProofOpen] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; currency: ManualCurrency } | null>(null);

  const [balanceMinor, setBalanceMinor] = useState(0);
  const [pendingDeposit, setPendingDeposit] = useState(false);
  const [busy, setBusy] = useState(false);

  const amount = parseAmount(amountStr);
  const methods = methodsForCurrency(currency);
  const activeMethod = methods.find((m) => m.id === method) ?? methods[0];

  const refreshBalance = useCallback(async () => {
    try {
      const acc = await fetchAccount(currency === 'usd' ? 'USD' : 'AOA');
      setBalanceMinor(acc ? await fetchBalanceMinor(acc.id) : 0);
    } catch {
      setBalanceMinor(0);
    }
  }, [currency]);

  const refreshPending = useCallback(async () => {
    if (!user) return setPendingDeposit(false);
    try {
      setPendingDeposit(await hasPendingDeposit(user.id));
    } catch {
      setPendingDeposit(false);
    }
  }, [user]);

  useEffect(() => {
    if (!REAL_MONEY_ENABLED || !user) return;
    void loadMovements(user.id);
    void refreshBalance();
    void refreshPending();
  }, [user, loadMovements, refreshBalance, refreshPending]);

  // Mudar de moeda recalcula o saldo e, se o método ativo não suportar a
  // moeda nova, escolhe o primeiro suportado.
  useEffect(() => {
    if (!methods.some((m) => m.id === method) && methods[0]) setMethod(methods[0].id);
    if (!REAL_MONEY_ENABLED || !user) return;
    void refreshBalance();
  }, [currency, methods, method, user, refreshBalance]);

  const depositError = useMemo(() => {
    if (!amountStr) return null;
    if (amount <= 0) return 'Indica um valor válido.';
    if (amount < MIN_DEPOSIT[currency])
      return `Depósito mínimo: ${formatMoney(MIN_DEPOSIT[currency], currency)}.`;
    if (amount > MAX_DEPOSIT[currency])
      return `Depósito máximo: ${formatMoney(MAX_DEPOSIT[currency], currency)}.`;
    return null;
  }, [amountStr, amount, currency]);

  const withdrawError = useMemo(() => {
    if (!amountStr) return null;
    if (amount <= 0) return 'Indica um valor válido.';
    if (amount < MIN_WITHDRAWAL[currency])
      return `Levantamento mínimo: ${formatMoney(MIN_WITHDRAWAL[currency], currency)}.`;
    if (amount > MAX_WITHDRAWAL[currency])
      return `Levantamento máximo: ${formatMoney(MAX_WITHDRAWAL[currency], currency)}.`;
    const balance = balanceMinor / 100;
    if (amount > balance)
      return `Saldo insuficiente (${formatMoney(balance, currency)} disponíveis).`;
    return null;
  }, [amountStr, amount, currency, balanceMinor]);

  /** Submissão do comprovativo (chamada pelo PaymentModal). */
  const handleProofSubmit = async (file: File) => {
    if (!user) throw new Error('Sessão expirada. Volta a entrar.');
    if (!activeMethod) throw new Error('Escolhe um método de pagamento.');

    const { url, error } = await uploadReceipt(user.id, fileToReceipt(file));
    if (error || !url) throw new Error(error || 'Falha no upload do comprovativo.');

    const receiptId = await saveReceipt({
      userId: user.id,
      userEmail: user.email ?? '',
      proofUrl: url,
      method: activeMethod.id,
      amount,
      currency,
      plan: 'wallet',
    });

    await addMovement(user.id, {
      type: 'deposit',
      method: activeMethod.id,
      amount,
      currency,
      plan: 'wallet',
      status: 'pendente',
      receiptId,
    });

    await refreshPending();
    setSuccess({ amount, currency });
    setAmountStr('');
  };

  const handleWithdraw = async () => {
    if (!user) return;
    if (withdrawError) {
      toast.error(withdrawError);
      return;
    }
    if (!details.trim()) {
      toast.error('Indica os dados de destino.', {
        description: 'Ex.: NIF, telefone ou IBAN conforme o método escolhido.',
      });
      return;
    }
    setBusy(true);
    try {
      const requestId = await submitWithdrawal({
        userId: user.id,
        method: activeMethod.id,
        amount,
        currency,
        details: details.trim(),
      });
      await addMovement(user.id, {
        type: 'withdrawal',
        method: activeMethod.id,
        amount,
        currency,
        status: 'pendente',
        requestId,
      });
      await refreshBalance();
      toast.success('Pedido de levantamento enviado!', {
        description: 'Vais ser notificado quando for processado.',
      });
      setAmountStr('');
      setDetails('');
    } catch (err) {
      toast.error('Falha ao pedir o levantamento.', {
        description: err instanceof Error ? err.message : 'Tenta novamente.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (m: WalletMovement) => {
    if (!user) return;
    await deleteMovement(user.id, m.id);
    await refreshPending();
    toast.success('Movimento removido.');
  };

  // --------------------------------- Gates ---------------------------------

  if (!REAL_MONEY_ENABLED) {
    return (
      <div className="space-y-5 animate-slide-up pb-6">
        <SectionTitle title="Depósitos e levantamentos" />
        <GameCard className="p-5 text-center space-y-3">
          <Banknote className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Em breve. O Tira o Cocó do Meio ainda não movimenta dinheiro real.
          </p>
        </GameCard>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-5 animate-slide-up pb-6">
        <SectionTitle title="Depósitos e levantamentos" />
        <GameCard className="p-5 text-center space-y-3">
          <Lock className="w-8 h-8 text-gold mx-auto" />
          <p className="text-sm text-muted-foreground">
            Inicia sessão para depositar ou levantar dinheiro real.
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

  const pendingCount = movements.filter((m) => m.status === 'pendente').length;

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      {/* Saldo real */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <GameCard className="p-5" glow="gold">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-gold font-semibold flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5" />
                Saldo real disponível
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-display text-4xl tracking-wide text-gold tabular-nums">
                  {(balanceMinor / 100).toLocaleString('pt-PT', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="font-display text-lg text-gold">
                  {currency.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshBalance();
                if (user) void loadMovements(user.id);
                void refreshPending();
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              aria-label="Atualizar saldo"
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Depósitos e levantamentos manuais com comprovativo.
          </p>
        </GameCard>
      </motion.div>

      {/* Aviso de depósito pendente */}
      {pendingDeposit && (
        <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-orange/10 border border-orange/30">
          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-orange" aria-hidden />
          <p className="text-xs leading-relaxed text-orange">
            Tens um comprovativo <strong>pendente de revisão</strong>. Podes enviar outro depois de
            aprovado ou recusado.
          </p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'deposit' | 'withdraw')}>
        <TabsList className="w-full">
          <TabsTrigger value="deposit" className="flex-1">
            Depositar
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="flex-1">
            Levantar
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ Depósito ------------------------------ */}
        <TabsContent value="deposit" className="space-y-4">
          {/* Moeda */}
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <GameButton
                  key={c}
                  variant={currency === c ? 'gold' : 'ghost'}
                  className="flex-1 h-12 text-sm"
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                >
                  {c.toUpperCase()}
                </GameButton>
              ))}
            </div>
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label htmlFor="deposit-amount">Valor a depositar</Label>
            <div className="relative">
              <Input
                id="deposit-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="h-12 pr-20 font-display text-lg"
                disabled={pendingDeposit}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                {currency.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo {formatMoney(MIN_DEPOSIT[currency], currency)} · Máximo{' '}
              {formatMoney(MAX_DEPOSIT[currency], currency)}
            </p>
            {depositError && (
              <p className="text-xs text-p2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden />
                {depositError}
              </p>
            )}
          </div>

          {/* Método */}
          <div className="space-y-1.5">
            <Label>Método de pagamento</Label>
            <div className="grid grid-cols-1 gap-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  disabled={pendingDeposit}
                  aria-pressed={method === m.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors min-h-12',
                    method === m.id
                      ? 'border-gold/60 bg-gold/10'
                      : 'border-border/50 bg-surface/60 hover:border-gold/40',
                    pendingDeposit && 'opacity-60 pointer-events-none',
                  )}
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: m.color }}
                    aria-hidden
                  >
                    {METHOD_ICONS[m.id]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{m.label}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {m.details}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full border-2 shrink-0',
                      method === m.id ? 'border-gold bg-gold' : 'border-muted-foreground/50',
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>

          <GameButton
            variant="gold"
            className="w-full"
            disabled={!amount || !!depositError || pendingDeposit || !activeMethod}
            onClick={() => setProofOpen(true)}
            aria-label="Continuar para envio de comprovativo"
          >
            <Send className="w-4 h-4 mr-2" />
            {pendingDeposit ? 'Já tens um depósito pendente' : 'Continuar'}
          </GameButton>
        </TabsContent>

        {/* ---------------------------- Levantamento ---------------------------- */}
        <TabsContent value="withdraw" className="space-y-4">
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <GameButton
                  key={c}
                  variant={currency === c ? 'gold' : 'ghost'}
                  className="flex-1 h-12 text-sm"
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                >
                  {c.toUpperCase()}
                </GameButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">Valor a levantar</Label>
            <div className="relative">
              <Input
                id="withdraw-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="h-12 pr-20 font-display text-lg"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                {currency.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Disponível: {formatMoney(balanceMinor / 100, currency)} · Mínimo{' '}
              {formatMoney(MIN_WITHDRAWAL[currency], currency)}
            </p>
            {withdrawError && (
              <p className="text-xs text-p2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden />
                {withdrawError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Método de recebimento</Label>
            <div className="grid grid-cols-1 gap-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  aria-pressed={method === m.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors min-h-12',
                    method === m.id
                      ? 'border-gold/60 bg-gold/10'
                      : 'border-border/50 bg-surface/60 hover:border-gold/40',
                  )}
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: m.color }}
                    aria-hidden
                  >
                    {METHOD_ICONS[m.id]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{m.label}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {m.details}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full border-2 shrink-0',
                      method === m.id ? 'border-gold bg-gold' : 'border-muted-foreground/50',
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-details">Dados de destino</Label>
            <Textarea
              id="withdraw-details"
              placeholder="NIF, telefone ou IBAN conforme o método escolhido"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>

          <GameButton
            variant="gold"
            className="w-full"
            disabled={!amount || !!withdrawError || busy}
            onClick={handleWithdraw}
            aria-label="Pedir levantamento"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />A enviar…
              </>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Pedir levantamento
              </>
            )}
          </GameButton>
        </TabsContent>
      </Tabs>

      {/* Histórico */}
      <div>
        <SectionTitle
          title="Histórico"
          action={
            <span className="text-xs text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`
                : `${movements.length} movimentos`}
            </span>
          }
        />
        <GameCard className="divide-y divide-border/30">
          {movementsLoading && movements.length === 0 ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Ainda não tens movimentos.
            </div>
          ) : (
            movements.map((m) => (
              <div key={m.id} className="p-3 flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    m.type === 'deposit' ? 'bg-p1/15 text-p1' : 'bg-p2/15 text-p2',
                  )}
                >
                  {m.type === 'deposit' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.type === 'deposit' ? 'Depósito' : 'Levantamento'} ·{' '}
                    <span className="text-muted-foreground capitalize">{m.method}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString('pt-PT')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap',
                      STATUS_CLASS[m.status],
                    )}
                  >
                    {STATUS_LABEL[m.status]}
                  </span>
                  <span
                    className={cn(
                      'font-display text-sm tabular-nums',
                      m.type === 'deposit' ? 'text-p1' : 'text-p2',
                    )}
                  >
                    {m.type === 'deposit' ? '+' : '−'}
                    {formatMoney(m.amount, m.currency)}
                  </span>
                  {m.status === 'pendente' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m)}
                      className="w-12 h-12 rounded-md flex items-center justify-center text-muted-foreground hover:text-p2 hover:bg-p2/10 transition-colors"
                      aria-label="Remover movimento pendente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </GameCard>
      </div>

      {/* Modal de pagamento */}
      {activeMethod && (
        <PaymentModal
          open={proofOpen}
          onClose={() => setProofOpen(false)}
          method={activeMethod}
          currency={currency}
          amount={amount}
          onSubmit={handleProofSubmit}
        />
      )}

      {/* Confirmação */}
      <ReceiptSuccessModal
        open={success !== null && !proofOpen}
        onClose={() => setSuccess(null)}
        amount={success?.amount ?? 0}
        currency={success?.currency ?? 'aoa'}
      />
    </div>
  );
}
