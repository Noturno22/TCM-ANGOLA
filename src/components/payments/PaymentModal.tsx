'use client';

/**
 * Modal de pagamento manual: mostra os dados de recebimento, permite copiar
 * o valor e anexar o comprovativo antes de submeter.
 *
 * Espelho de `TMT/mobile/src/components/PaymentModal.tsx`, adaptado aos
 * primitivos shadcn (Dialog/Input) e à linguagem PT da app.
 */
import { useState } from 'react';
import { AlertCircle, Copy, ImageUp, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GameButton } from '@/components/game/ui';
import type { ManualCurrency, PaymentMethodInfo } from '@/lib/payments/manual';
import { formatMoney } from '@/lib/payments/manual';
import { cn } from '@/lib/utils';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  method: PaymentMethodInfo;
  currency: ManualCurrency;
  amount: number;
  onSubmit: (file: File) => Promise<void>;
}

export function PaymentModal({
  open,
  onClose,
  method,
  currency,
  amount,
  onSubmit,
}: PaymentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(method.copyValue);
      toast.success('Valor copiado!', { description: method.copyValue });
    } catch {
      toast.error('Não foi possível copiar. Copia manualmente: ' + method.copyValue);
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('O comprovativo tem de ser uma imagem.');
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      await onSubmit(file);
      setFile(null);
      onClose();
    } catch (err) {
      toast.error('Falha ao enviar o comprovativo.', {
        description: err instanceof Error ? err.message : 'Tenta novamente.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-gold/30">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold shrink-0"
              style={{ backgroundColor: method.color }}
              aria-hidden
            >
              <Wallet className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-lg tracking-wide truncate">
                {method.label}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {formatMoney(amount, currency)} · {currency.toUpperCase()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Dados de recebimento */}
        <div className="rounded-xl border border-border/50 bg-surface/60 p-3">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Valor a transferir
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-display text-lg text-gold truncate select-all">
              {method.copyValue}
            </code>
            <GameButton
              type="button"
              variant="outline"
              className="h-12 px-3 text-sm"
              onClick={handleCopy}
              aria-label={`Copiar ${method.copyValue}`}
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              Copiar
            </GameButton>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{method.details}</p>
        </div>

        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Transfere o valor indicado para a conta acima.</li>
          <li>Faz uma captura de ecrã do comprovativo.</li>
          <li>Anexa a imagem e submete para revisão.</li>
        </ol>

        {/* Comprovativo */}
        <div className="space-y-1.5">
          <label
            htmlFor="proof-input"
            className={cn(
              'flex items-center gap-2.5 rounded-xl border border-dashed border-gold/40 bg-surface/60 px-3 py-3 cursor-pointer transition-colors hover:border-gold hover:bg-gold/5',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <ImageUp className="w-5 h-5 text-gold shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">
                {file ? file.name : 'Escolher comprovativo'}
              </span>
              <span className="block text-xs text-muted-foreground">
                {file ? 'Imagem selecionada — pronta a submeter' : 'PNG ou JPG'}
              </span>
            </span>
          </label>
          <input
            id="proof-input"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleSelect}
            disabled={busy}
          />
        </div>

        <GameButton
          variant="gold"
          className="w-full"
          onClick={handleSubmit}
          disabled={!file || busy}
          aria-label="Submeter comprovativo"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              A enviar…
            </>
          ) : (
            'Submeter comprovativo'
          )}
        </GameButton>

        {!file && !busy && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 -mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            Precisas de anexar o comprovativo para continuar.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
