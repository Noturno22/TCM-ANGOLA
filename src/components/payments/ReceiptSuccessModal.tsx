'use client';

/**
 * Confirmação após enviar um comprovativo de depósito.
 *
 * Espelho de `TMT/mobile/src/components/ReceiptSuccessModal.tsx`, adaptado aos
 * primitivos shadcn (Dialog) e à linguagem PT da app.
 */
import { useEffect } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GameButton } from '@/components/game/ui';

interface ReceiptSuccessModalProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  currency: 'usd' | 'aoa';
}

export function ReceiptSuccessModal({
  open,
  onClose,
  amount,
  currency,
}: ReceiptSuccessModalProps) {
  // Fecha com ESC já é tratado pelo Dialog; aqui assegura foco no botão de sair.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const formatted =
    currency === 'usd'
      ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${amount.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-gold/30">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-p1/15 text-p1 flex items-center justify-center mb-1">
            <CheckCircle2 className="w-9 h-9" aria-hidden />
          </div>
          <DialogTitle className="text-center font-display text-xl tracking-wide">
            Comprovativo enviado!
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            O teu comprovativo de <strong>{formatted}</strong> foi registado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-surface/60 border border-border/40">
          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-gold" aria-hidden />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Está <strong className="text-foreground">pendente de revisão</strong>. Assim que um
            administrador aprovar, o valor entra no teu saldo real e verás o movimento concluído no
            histórico.
          </p>
        </div>

        <GameButton variant="gold" className="w-full" onClick={onClose}>
          Entendi
        </GameButton>
      </DialogContent>
    </Dialog>
  );
}
