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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Clock,
  Copy,
  Landmark,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/app';
import { useWalletMovements, type WalletMovement } from '@/store/walletMovements';
import { REAL_MONEY_ENABLED } from '@/lib/config/flags';
import { fetchAccount, fetchBalanceMinor } from '@/lib/payments/client';
import { enabledProvidersForCurrency, getProviderInfo } from '@/lib/payments/providers';
import {
  autoErrorMessage,
  autoProviderCandidates,
  fetchIntentById,
  findResumableAutoIntent,
  isNotConfiguredError,
  normalizeAutoPhone,
  startAutoDeposit,
  type AutoCheckoutInfo,
  type AutoDepositMethod,
  type AutoProviderId,
} from '@/lib/payments/auto';
import type { PaymentIntentRow } from '@/lib/payments/types';
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

  // Depósito automático (AppyPay / BitPay)
  const [autoMethod, setAutoMethod] = useState<AutoDepositMethod>('gpo');
  const [autoProviderChoice, setAutoProviderChoice] = useState<AutoProviderId | null>(null);
  const [phone, setPhone] = useState('');
  const [autoStart, setAutoStart] = useState<{
    intent: PaymentIntentRow;
    info: AutoCheckoutInfo;
  } | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);

  const amount = parseAmount(amountStr);
  const methods = methodsForCurrency(currency);
  const activeMethod = methods.find((m) => m.id === method) ?? methods[0];
  /** PSP automáticos ativos na UI, por ordem de preferência. */
  const autoCandidates = useMemo(
    () => autoProviderCandidates(enabledProvidersForCurrency('AOA').map((p) => p.id)),
    [],
  );
  const autoEnabled = autoCandidates.length > 0;
  const autoProvider =
    autoProviderChoice && autoCandidates.includes(autoProviderChoice)
      ? autoProviderChoice
      : (autoCandidates[0] ?? null);
  const autoProviderLabel = autoProvider ? (getProviderInfo(autoProvider)?.label ?? autoProvider) : '';
  /** Bloqueia o formulário: comprovativo pendente ou pagamento automático a decorrer. */
  const formBlocked = pendingDeposit || autoStart !== null;
  const autoIntentId = autoStart?.intent.id ?? null;
  const resumedRef = useRef(false);

  const refreshBalance = useCallback(async (c: ManualCurrency = currency) => {
    try {
      const acc = await fetchAccount(c === 'usd' ? 'USD' : 'AOA');
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

  /** Pagamento confirmado: fecha o cartão pendente e atualiza saldo/histórico. */
  const finishAutoPaid = useCallback(async () => {
    setAutoStart(null);
    setAmountStr('');
    setPhone('');
    toast.success('Pagamento confirmado!', {
      description: 'O valor foi creditado na tua carteira.',
    });
    if (currency === 'aoa') void refreshBalance('aoa');
    if (user) void loadMovements(user.id);
  }, [currency, refreshBalance, loadMovements, user]);

  /** Consulta o estado da intenção (usado no polling e no botão "Já paguei"). */
  const checkAutoIntent = useCallback(
    async (manual: boolean) => {
      if (!autoStart) return;
      if (manual) setAutoChecking(true);
      try {
        const intent = await fetchIntentById(autoStart.intent.id);
        if (!intent) return;
        if (intent.status === 'paid') {
          await finishAutoPaid();
          return;
        }
        const expired = new Date(intent.expires_at).getTime() <= Date.now();
        if (intent.status === 'failed' || intent.status === 'expired' || expired) {
          setAutoStart(null);
          setAmountStr('');
          toast.error(intent.status === 'failed' ? 'Pagamento falhou.' : 'Pedido expirado.', {
            description: 'Podes iniciar um novo depósito.',
          });
          return;
        }
        setAutoStart((prev) => (prev ? { ...prev, intent } : prev));
      } catch {
        // Sem rede: tenta outra vez no intervalo seguinte.
      } finally {
        if (manual) setAutoChecking(false);
      }
    },
    [autoStart, finishAutoPaid],
  );

  // Mantém o ponteiro sempre com a versão mais recente do handler.
  const checkAutoRef = useRef(checkAutoIntent);
  checkAutoRef.current = checkAutoIntent;

  // Polling do pagamento automático (5 s) enquanto a intenção estiver pendente.
  useEffect(() => {
    if (!autoIntentId) return;
    void checkAutoRef.current(false);
    const id = setInterval(() => void checkAutoRef.current(false), 5000);
    return () => clearInterval(id);
  }, [autoIntentId]);

  // Retoma uma intenção automática pendente ao abrir o ecrã (só uma vez).
  useEffect(() => {
    if (!user || resumedRef.current) return;
    resumedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const found = await findResumableAutoIntent();
        if (!cancelled && found) setAutoStart(found);
      } catch {
        // Sem rede: fica o formulário normal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Arranca um depósito automático no PSP escolhido (com recuo se não configurado). */
  const handleStartAuto = async () => {
    if (!amount || depositError) {
      toast.error(depositError || 'Indica um valor válido.');
      return;
    }
    const phoneDigits = autoMethod === 'gpo' ? normalizeAutoPhone(phone) : undefined;
    if (autoMethod === 'gpo' && !phoneDigits) {
      toast.error('Telemóvel inválido.', { description: 'Usa o formato 9XX XXX XXX.' });
      return;
    }
    setAutoBusy(true);
    let lastError: unknown = null;
    const order: AutoProviderId[] = autoProvider
      ? [autoProvider, ...autoCandidates.filter((p) => p !== autoProvider)]
      : autoCandidates;
    try {
      for (const provider of order) {
        try {
          const started = await startAutoDeposit({
            amountMinor: Math.round(amount * 100),
            method: autoMethod,
            provider,
            phone: phoneDigits ?? undefined,
          });
          setAutoStart(started);
          return;
        } catch (err) {
          lastError = err;
          // Sem credenciais nesse PSP: tenta o seguinte (ex.: AppyPay → BitPay).
          if (!isNotConfiguredError(err)) break;
        }
      }
      console.error('auto deposit failed', lastError);
      toast.error(autoErrorMessage(lastError));
    } finally {
      setAutoBusy(false);
    }
  };

  const handleCopyReference = async () => {
    const reference = autoStart?.info.reference;
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      toast.success('Referência copiada.');
    } catch {
      toast.error('Não foi possível copiar. Copia manualmente.');
    }
  };

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
            Depósitos automáticos ou manuais com comprovativo; levantamentos manuais.
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
                disabled={formBlocked}
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

          {/* -------------------- Depósito automático (AppyPay / BitPay) -------------------- */}
          {autoStart && (
            <GameCard className="p-4 space-y-3 border border-gold/40" glow="gold">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-widest text-gold font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Pagamento automático pendente
                </p>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {autoChecking ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> A verificar…
                    </>
                  ) : (
                    'Verificação automática'
                  )}
                </span>
              </div>

              {autoStart.info.method === 'gpo' ? (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">
                    Enviámos um pedido de pagamento de{' '}
                    <strong className="text-gold">
                      {formatMoney(autoStart.intent.amount_minor / 100, 'aoa')}
                    </strong>{' '}
                    para o Multicaixa Express
                    {autoStart.info.phoneMasked ? (
                      <>
                        {' '}
                        do telemóvel{' '}
                        <span className="font-display">{autoStart.info.phoneMasked}</span>
                      </>
                    ) : null}
                    .
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Abre a aplicação Multicaixa Express no telemóvel e confirma o pedido.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-surface/60 border border-border/50 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Entidade
                      </p>
                      <p className="font-display text-lg text-gold tabular-nums">
                        {autoStart.info.entity || '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface/60 border border-border/50 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Referência
                      </p>
                      <p className="font-display text-lg text-gold tabular-nums">
                        {autoStart.info.reference || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface/60 border border-border/50 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Montante
                    </p>
                    <p className="font-display text-lg tabular-nums">
                      {formatMoney(autoStart.intent.amount_minor / 100, 'aoa')}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paga em qualquer ATM, Internet Banking ou app Multicaixa. Válido até{' '}
                    {new Date(autoStart.intent.expires_at).toLocaleString('pt-PT')}.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <GameButton
                  variant="gold"
                  className="flex-1"
                  disabled={autoChecking}
                  onClick={() => void checkAutoIntent(true)}
                  aria-label="Já paguei — verificar pagamento"
                >
                  {autoChecking ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Já paguei
                </GameButton>
                {autoStart.info.method === 'ref' && autoStart.info.reference && (
                  <GameButton
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => void handleCopyReference()}
                    aria-label="Copiar referência"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </GameButton>
                )}
                <GameButton
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setAutoStart(null)}
                  aria-label="Cancelar pagamento automático"
                >
                  Cancelar
                </GameButton>
              </div>
            </GameCard>
          )}

          {autoEnabled && currency === 'aoa' && !autoStart && !pendingDeposit && (
            <div className="space-y-3 rounded-xl border border-gold/30 bg-gold/[0.06] p-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-gold" aria-hidden />
                <p className="text-sm font-semibold">Depósito automático</p>
                <span className="text-[10px] uppercase tracking-wider text-gold border border-gold/40 rounded px-1.5 py-0.5">
                  {autoProviderLabel}
                </span>
              </div>

              {autoCandidates.length > 1 && (
                <div className="grid grid-cols-2 gap-2">
                  {autoCandidates.map((id) => (
                    <GameButton
                      key={id}
                      variant={autoProvider === id ? 'gold' : 'ghost'}
                      className="h-12 text-xs"
                      onClick={() => setAutoProviderChoice(id)}
                      aria-pressed={autoProvider === id}
                    >
                      {getProviderInfo(id)?.label ?? id}
                    </GameButton>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <GameButton
                  variant={autoMethod === 'gpo' ? 'gold' : 'ghost'}
                  className="h-12 text-xs"
                  onClick={() => setAutoMethod('gpo')}
                  aria-pressed={autoMethod === 'gpo'}
                >
                  <Smartphone className="w-4 h-4 mr-1.5 inline" />
                  Multicaixa Express
                </GameButton>
                <GameButton
                  variant={autoMethod === 'ref' ? 'gold' : 'ghost'}
                  className="h-12 text-xs"
                  onClick={() => setAutoMethod('ref')}
                  aria-pressed={autoMethod === 'ref'}
                >
                  <Landmark className="w-4 h-4 mr-1.5 inline" />
                  Referência
                </GameButton>
              </div>

              {autoMethod === 'gpo' && (
                <div className="space-y-1.5">
                  <Label htmlFor="auto-phone">Telemóvel Multicaixa Express</Label>
                  <Input
                    id="auto-phone"
                    inputMode="tel"
                    placeholder="9XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recebes o pedido na app do Multicaixa Express e confirmas lá.
                  </p>
                </div>
              )}

              <GameButton
                variant="gold"
                className="w-full"
                disabled={!amount || !!depositError || autoBusy}
                onClick={() => void handleStartAuto()}
                aria-label={`Pagar com ${autoProviderLabel}`}
              >
                {autoBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />A iniciar…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Pagar agora
                  </>
                )}
              </GameButton>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Processado pela {autoProviderLabel} — o saldo entra na carteira assim que o
                pagamento for confirmado. Sem comprovativo nem espera por aprovação.
              </p>
            </div>
          )}

          {/* Método (manual com comprovativo) */}
          {!autoStart && (
            <>
              <div className="space-y-1.5">
                <Label>Método de pagamento</Label>
                <div className="grid grid-cols-1 gap-2">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      disabled={formBlocked}
                      aria-pressed={method === m.id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors min-h-12',
                        method === m.id
                          ? 'border-gold/60 bg-gold/10'
                          : 'border-border/50 bg-surface/60 hover:border-gold/40',
                        formBlocked && 'opacity-60 pointer-events-none',
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
                disabled={!amount || !!depositError || formBlocked || !activeMethod}
                onClick={() => setProofOpen(true)}
                aria-label="Continuar para envio de comprovativo"
              >
                <Send className="w-4 h-4 mr-2" />
                {pendingDeposit ? 'Já tens um depósito pendente' : 'Continuar'}
              </GameButton>
            </>
          )}
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
