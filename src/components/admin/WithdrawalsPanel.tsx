'use client';

/**
 * Painel de admin: pedidos de levantamento.
 *
 * Fluxo: pendente → aprovado → pago (o pagamento debita a carteira real do
 * utilizador no ledger, `withdrawal:<id>`). Rejeitar aceita uma nota.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, Check, Loader2, RefreshCw, X } from 'lucide-react';
import {
  approveWithdrawal,
  listWithdrawals,
  markWithdrawalPaid,
  rejectWithdrawal,
  type WithdrawalRequestRow,
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type StatusFilter = 'pending' | 'approved' | 'paid' | 'rejected' | 'all';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Pendentes' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'paid', label: 'Pagos' },
  { id: 'rejected', label: 'Rejeitados' },
  { id: 'all', label: 'Todos' },
];

const STATUS_STYLE: Record<WithdrawalRequestRow['status'], string> = {
  pending: 'bg-gold/15 text-gold',
  approved: 'bg-p1/15 text-p1',
  paid: 'bg-surface-2 text-muted-foreground',
  rejected: 'bg-p2/15 text-p2',
};

const STATUS_LABEL: Record<WithdrawalRequestRow['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
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

export function WithdrawalsPanel() {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [rows, setRows] = useState<WithdrawalRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawalRequestRow | null>(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async (f: StatusFilter) => {
    setLoading(true);
    try {
      const data = await listWithdrawals(f === 'all' ? undefined : f, 100, 0);
      setRows(data);
    } catch (error) {
      toast.error('Não foi possível carregar os levantamentos.', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const act = async (row: WithdrawalRequestRow, fn: () => Promise<void>, success: string) => {
    setBusyId(row.id);
    try {
      await fn();
      toast.success(success);
      await load(filter);
    } catch (error) {
      toast.error('Operação falhou.', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejecting) return;
    const row = rejecting;
    setBusyId(row.id);
    try {
      await rejectWithdrawal(row.id, notes.trim() || undefined);
      toast.success('Levantamento rejeitado.');
      setRejecting(null);
      setNotes('');
      await load(filter);
    } catch (error) {
      toast.error('Falha ao rejeitar.', {
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

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <GameCard className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nada por aqui.</p>
        </GameCard>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <GameCard key={row.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg tracking-wide">
                    {formatMoney(row.amount, row.currency as ManualCurrency)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{row.user_id}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full',
                    STATUS_STYLE[row.status],
                  )}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="uppercase font-semibold text-foreground/80">{row.method}</span>
                <span>·</span>
                <span>{formatDate(row.created_at)}</span>
              </div>

              {row.details && (
                <div className="rounded-lg bg-surface-2 border border-border px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                    Dados de destino
                  </p>
                  <p className="text-sm text-foreground break-words">{row.details}</p>
                </div>
              )}

              {row.notes && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Nota:</span> {row.notes}
                </p>
              )}

              {(row.status === 'pending' || row.status === 'approved') && (
                <div className="flex flex-wrap gap-2">
                  {row.status === 'pending' && (
                    <GameButton
                      variant="p1"
                      className="h-12 px-3 text-sm"
                      disabled={busyId === row.id}
                      onClick={() =>
                        void act(row, () => approveWithdrawal(row.id), 'Levantamento aprovado.')
                      }
                    >
                      {busyId === row.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      Aprovar
                    </GameButton>
                  )}
                  {row.status === 'approved' && (
                    <GameButton
                      variant="gold"
                      className="h-12 px-3 text-sm"
                      disabled={busyId === row.id}
                      onClick={() =>
                        void act(
                          row,
                          () => markWithdrawalPaid(row.id),
                          'Marcado como pago e debitado.',
                        )
                      }
                    >
                      {busyId === row.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Banknote className="w-4 h-4 mr-1" />
                      )}
                      Marcar como pago
                    </GameButton>
                  )}
                  <GameButton
                    variant="outline"
                    className="h-12 px-3 text-sm ml-auto"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setRejecting(row);
                      setNotes('');
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Rejeitar
                  </GameButton>
                </div>
              )}
            </GameCard>
          ))}
        </div>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar levantamento?</DialogTitle>
            <DialogDescription>
              Podes deixar uma nota para o utilizador (opcional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo da rejeição (opcional)"
            aria-label="Nota de rejeição"
            rows={3}
          />
          <DialogFooter>
            <GameButton variant="outline" onClick={() => setRejecting(null)}>
              Cancelar
            </GameButton>
            <GameButton variant="p2" disabled={busyId !== null} onClick={() => void submitReject()}>
              {busyId !== null && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Rejeitar
            </GameButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
