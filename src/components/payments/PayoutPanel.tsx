'use client';

/**
 * Secção de levantamentos (payouts).
 *
 * Só aparece ativa quando o KYC está aprovado E as flags de dinheiro real
 * (`REAL_MONEY_ENABLED` + `NEXT_PUBLIC_PAYOUTS_ENABLED`) estão ligadas. O
 * servidor também valida (KYC + `PAYOUTS_ENABLED`), por isso a UI é apenas uma
 * camada de conveniência — nunca a única barreira.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpRight, Loader2, ShieldAlert } from 'lucide-react';
import { requestPayout } from '@/lib/payments/client';
import { enabledProvidersForCurrency } from '@/lib/payments/providers';
import { PAYOUTS_UI_ENABLED } from '@/lib/config/flags';
import {
  MAX_PAYOUT_MINOR,
  MIN_PAYOUT_MINOR,
  aoaFromMinor,
  formatMinor,
  minorFromAoa,
  newPayoutIdempotencyKey,
  type PayoutDestinationType,
  type PayoutRow,
} from '@/lib/payments/types';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { cn } from '@/lib/utils';

const PAYOUT_PROVIDERS = enabledProvidersForCurrency('AOA');

const DESTINATIONS: { id: PayoutDestinationType; label: string; placeholder: string }[] = [
  { id: 'mobile_money', label: 'Carteira móvel', placeholder: 'Ex.: 923 000 000' },
  { id: 'express', label: 'Multicaixa Express', placeholder: 'Nº de telefone' },
  { id: 'bank_transfer', label: 'Transferência bancária', placeholder: 'IBAN AO06...' },
];

const STATUS_LABELS: Record<PayoutRow['status'], { label: string; className: string }> = {
  requested: { label: 'Pedido', className: 'bg-surface-2 text-muted-foreground' },
  kyc_pending: { label: 'KYC pendente', className: 'bg-gold/15 text-gold' },
  approved: { label: 'Aprovado', className: 'bg-p1/15 text-p1' },
  processing: { label: 'Em processamento', className: 'bg-gold/15 text-gold' },
  paid: { label: 'Pago', className: 'bg-p1/15 text-p1' },
  failed: { label: 'Falhou', className: 'bg-p2/15 text-p2' },
  rejected: { label: 'Rejeitado', className: 'bg-p2/15 text-p2' },
  cancelled: { label: 'Cancelado', className: 'bg-surface-2 text-muted-foreground' },
};

function PayoutStatusChip({ status }: { status: PayoutRow['status'] }) {
  const s = STATUS_LABELS[status];
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', s.className)}>
      {s.label}
    </span>
  );
}

function InfoCard({ title, detail }: { title: string; detail: string }) {
  return (
    <GameCard className="p-4 mt-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
          <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base tracking-wide">{title}</h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <ShieldAlert className="w-3 h-3" />
            {detail}
          </p>
        </div>
      </div>
    </GameCard>
  );
}

export function PayoutPanel({
  accountId,
  balanceMinor,
  kycApproved,
  payouts,
  onRefresh,
}: {
  accountId: string | null;
  balanceMinor: number;
  kycApproved: boolean;
  payouts: PayoutRow[];
  onRefresh: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [destinationType, setDestinationType] = useState<PayoutDestinationType>('mobile_money');
  const [destinationValue, setDestinationValue] = useState('');
  const [holderName, setHolderName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!PAYOUTS_UI_ENABLED) {
    return <InfoCard title="Levantamentos" detail="Em breve. Estamos a preparar esta funcionalidade." />;
  }
  if (!kycApproved) {
    return (
      <InfoCard
        title="Levantamento"
        detail="Bloqueado até à verificação de identidade (KYC)."
      />
    );
  }
  if (!accountId || PAYOUT_PROVIDERS.length === 0) {
    return <InfoCard title="Levantamento" detail="Levantamentos indisponíveis de momento." />;
  }

  const amountMinor = minorFromAoa(Number(amount) || 0);
  const destination = DESTINATIONS.find((d) => d.id === destinationType)!;
  const amountError =
    amount !== '' && amountMinor > 0 && amountMinor < MIN_PAYOUT_MINOR
      ? `Mínimo ${formatMinor(MIN_PAYOUT_MINOR)} AOA.`
      : amountMinor > MAX_PAYOUT_MINOR
        ? `Máximo ${formatMinor(MAX_PAYOUT_MINOR)} AOA.`
        : amountMinor > balanceMinor
          ? 'Saldo insuficiente.'
          : null;
  const canSubmit =
    amountMinor >= MIN_PAYOUT_MINOR &&
    amountMinor <= balanceMinor &&
    destinationValue.trim().length >= 4 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await requestPayout({
        amountMinor,
        currency: 'AOA',
        provider: PAYOUT_PROVIDERS[0].id,
        destination: {
          type: destinationType,
          value: destinationValue.trim(),
          holderName: holderName.trim() || undefined,
        },
        idempotencyKey: newPayoutIdempotencyKey(),
      });
      toast.success('Pedido de levantamento enviado.', {
        description: 'O saldo é reservado e o pagamento segue para processamento.',
      });
      setAmount('');
      setDestinationValue('');
      setHolderName('');
      await onRefresh();
    } catch (err) {
      toast.error('Não foi possível pedir o levantamento.', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3">
      <GameCard className="p-4 space-y-4">
        <div>
          <h3 className="font-display text-base tracking-wide">Levantamento</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Retira o teu saldo para uma conta à tua escolha.
          </p>
        </div>

        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
            Destino
          </p>
          <div className="flex flex-wrap gap-2">
            {DESTINATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDestinationType(d.id)}
                className={cn(
                  'px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all',
                  destinationType === d.id
                    ? 'border-gold bg-gold/5 text-foreground'
                    : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {destination.label}
          </label>
          <input
            type="text"
            value={destinationValue}
            onChange={(e) => setDestinationValue(e.target.value)}
            placeholder={destination.placeholder}
            className="w-full h-12 px-3 mt-1.5 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-gold transition-colors"
          />
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Titular (opcional)
          </label>
          <input
            type="text"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="Nome do titular"
            className="w-full h-12 px-3 mt-1.5 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-gold transition-colors"
          />
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
              placeholder={String(aoaFromMinor(MIN_PAYOUT_MINOR))}
              min={aoaFromMinor(MIN_PAYOUT_MINOR)}
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
          variant="gold"
          className="w-full h-12"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ArrowUpRight className="w-4 h-4 mr-2" />
          )}
          PEDIR LEVANTAMENTO
        </GameButton>
      </GameCard>

      {payouts.length > 0 && (
        <div className="mt-4">
          <SectionTitle
            title="Levantamentos"
            action={
              <span className="text-[11px] text-muted-foreground">
                {payouts.length} {payouts.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            }
          />
          <GameCard className="divide-y divide-border/30">
            {payouts.map((p) => (
              <div key={p.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {DESTINATIONS.find((d) => d.id === p.destination?.type)?.label ??
                      p.destination?.type}{' '}
                    · {p.destination?.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-display text-sm tabular-nums">
                    {formatMinor(p.amount_minor)} AOA
                  </span>
                  <PayoutStatusChip status={p.status} />
                </div>
              </div>
            ))}
          </GameCard>
        </div>
      )}
    </div>
  );
}
