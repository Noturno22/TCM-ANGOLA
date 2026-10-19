'use client';

/**
 * Painel de admin: comprovativos de depósito (aprovar / rejeitar / eliminar).
 *
 * Os dados e as ações vêm da Edge Function `admin-manage` (só admins). A
 * aprovação credita a carteira real do utilizador (ledger, `receipt:<id>`).
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import {
  approveReceipt,
  deleteReceipt,
  listReceipts,
  rejectReceipt,
  type PaymentReceipt,
} from '@/lib/payments/adminApi';
import { formatMoney, type ManualCurrency } from '@/lib/payments/manual';
import { GameButton, GameCard } from '@/components/game/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Pendentes' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'rejected', label: 'Rejeitados' },
  { id: 'all', label: 'Todos' },
];

const STATUS_STYLE: Record<PaymentReceipt['status'], string> = {
  pending: 'bg-gold/15 text-gold',
  approved: 'bg-p1/15 text-p1',
  rejected: 'bg-p2/15 text-p2',
};

const STATUS_LABEL: Record<PaymentReceipt['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReceiptsPanel() {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ receipt: PaymentReceipt; mode: 'reject' | 'delete' } | null>(
    null,
  );

  const load = useCallback(async (f: StatusFilter) => {
    setLoading(true);
    try {
      const data = await listReceipts(f === 'all' ? undefined : f, 100, 0);
      setReceipts(data);
    } catch (error) {
      toast.error('Não foi possível carregar os comprovativos.', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const approve = async (receipt: PaymentReceipt) => {
    setBusyId(receipt.id);
    try {
      await approveReceipt(receipt.id);
      toast.success('Depósito aprovado e creditado.', {
        description: `${formatMoney(receipt.amount, receipt.currency as ManualCurrency)} · ${receipt.user_email ?? ''}`,
      });
      await load(filter);
    } catch (error) {
      toast.error('Falha ao aprovar.', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { receipt, mode } = confirm;
    setBusyId(receipt.id);
    try {
      if (mode === 'reject') {
        await rejectReceipt(receipt.id);
        toast.success('Comprovativo rejeitado.');
      } else {
        await deleteReceipt(receipt.id);
        toast.success('Comprovativo eliminado.');
      }
      setConfirm(null);
      await load(filter);
    } catch (error) {
      toast.error('Operação falhou.', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors min-h-12',
              filter === f.id
                ? 'bg-gold text-primary-foreground border-gold'
                : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load(filter)}
          aria-label="Atualizar lista"
          className="ml-auto shrink-0 w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center hover:bg-surface transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && receipts.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : receipts.length === 0 ? (
        <GameCard className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nada por aqui.</p>
        </GameCard>
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <GameCard key={receipt.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg tracking-wide">
                    {formatMoney(receipt.amount, receipt.currency as ManualCurrency)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {receipt.user_email ?? receipt.user_id}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full',
                    STATUS_STYLE[receipt.status],
                  )}
                >
                  {STATUS_LABEL[receipt.status]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="uppercase font-semibold text-foreground/80">{receipt.method}</span>
                <span>·</span>
                <span>{formatDate(receipt.created_at)}</span>
                {receipt.duplicate_of && (
                  <span className="text-orange font-semibold">· duplicado?</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={receipt.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline px-2 py-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver comprovativo
                </a>

                {receipt.status === 'pending' && (
                  <div className="ml-auto flex gap-2">
                    <GameButton
                      variant="p1"
                      className="h-12 px-3 text-sm"
                      disabled={busyId === receipt.id}
                      onClick={() => void approve(receipt)}
                    >
                      {busyId === receipt.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      Aprovar
                    </GameButton>
                    <GameButton
                      variant="outline"
                      className="h-12 px-3 text-sm"
                      disabled={busyId === receipt.id}
                      onClick={() => setConfirm({ receipt, mode: 'reject' })}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Rejeitar
                    </GameButton>
                  </div>
                )}

                {receipt.status !== 'pending' && (
                  <GameButton
                    variant="ghost"
                    className="ml-auto h-12 px-3 text-sm"
                    disabled={busyId === receipt.id}
                    onClick={() => setConfirm({ receipt, mode: 'delete' })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </GameButton>
                )}
              </div>
            </GameCard>
          ))}
        </div>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.mode === 'delete' ? 'Eliminar comprovativo?' : 'Rejeitar comprovativo?'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.mode === 'delete'
                ? 'Esta ação apaga o registo permanentemente.'
                : 'O utilizador verá o pedido como recusado.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <GameButton variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </GameButton>
            <GameButton
              variant={confirm?.mode === 'delete' ? 'p2' : 'orange'}
              disabled={busyId !== null}
              onClick={() => void runConfirm()}
            >
              {busyId !== null && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirmar
            </GameButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
