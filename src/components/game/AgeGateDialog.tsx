'use client';

/**
 * Diálogo de verificação de idade (18+) para salas/torneios com aposta.
 *
 * Só recolhe a data de nascimento e envia-a ao servidor (`set_birthdate`);
 * a elegibilidade é sempre decidida no servidor. Nunca mostramos a data a
 * terceiros.
 */
import { useState } from 'react';
import { CalendarDays, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { GameButton } from '@/components/game/ui';
import { useAge } from '@/store/age';
import { maxBirthdateForAdult } from '@/lib/online/age';

interface AgeGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o utilizador passa a ser adulto (18+). */
  onVerified?: () => void;
}

export function AgeGateDialog({ open, onOpenChange, onVerified }: AgeGateDialogProps) {
  const save = useAge((s) => s.save);
  const [birthdate, setBirthdate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = maxBirthdateForAdult();

  const submit = async () => {
    if (!birthdate || busy) return;
    setBusy(true);
    setError(null);
    const isAdult = await save(birthdate);
    setBusy(false);
    if (isAdult) {
      onOpenChange(false);
      onVerified?.();
    } else {
      setError('Tens de ter pelo menos 18 anos para apostar moeda virtual.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-gold" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl tracking-wide">
                Verificação de idade
              </DialogTitle>
              <DialogDescription className="text-xs">
                Salas com aposta são só para maiores de 18 anos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Indicamos apenas a tua data de nascimento para confirmar que tens 18 anos ou mais.
            A aposta é em <strong className="text-foreground">moeda virtual (KZ)</strong> — nunca
            dinheiro real.
          </p>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Data de nascimento
            </span>
            <div className="relative mt-1.5">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={birthdate}
                max={max}
                onChange={(e) => {
                  setBirthdate(e.target.value);
                  setError(null);
                }}
                className="w-full h-12 rounded-lg bg-surface/60 border border-border/40 pl-9 pr-3 text-sm [color-scheme:dark]"
              />
            </div>
          </label>

          {error && (
            <p className="flex items-start gap-2 text-xs text-p2 leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <GameButton
            variant="outline"
            className="flex-1 h-12"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </GameButton>
          <GameButton
            variant="gold"
            className="flex-1 h-12"
            onClick={() => void submit()}
            disabled={!birthdate || busy}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
          </GameButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
