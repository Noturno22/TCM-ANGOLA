'use client';

/**
 * Secção de verificação de identidade (KYC).
 *
 * Mostra o estado do KYC e, quando não há um pedido aprovado/em análise, o
 * formulário de submissão. Os ficheiros vão para o bucket privado
 * `kyc-documents/<uid>/...` e os metadados são enviados via `submit-kyc`.
 */
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Clock, FileText, Loader2, ShieldAlert, Upload, X } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { submitKyc, uploadKycDocument } from '@/lib/payments/client';
import type { KycDocumentType, KycRecordRow } from '@/lib/payments/types';
import { GameButton, GameCard } from '@/components/game/ui';
import { cn } from '@/lib/utils';

const DOC_TYPES: { id: KycDocumentType; label: string }[] = [
  { id: 'BI', label: 'Bilhete de Identidade' },
  { id: 'passport', label: 'Passaporte' },
  { id: 'driver_license', label: 'Carta de condução' },
];

function FileField({
  label,
  required,
  file,
  onChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
        {label}
        {required ? ' *' : ' (opcional)'}
      </p>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          'w-full h-11 px-3 rounded-lg border flex items-center gap-2 text-left transition-colors',
          file ? 'border-gold/40 bg-gold/5' : 'border-border bg-surface hover:bg-surface-2',
        )}
      >
        {file ? (
          <>
            <FileText className="w-4 h-4 text-gold shrink-0" />
            <span className="text-xs truncate flex-1">{file.name}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Escolher ficheiro</span>
          </>
        )}
      </button>
    </div>
  );
}

export function KycPanel({
  records,
  onRefresh,
}: {
  records: KycRecordRow[];
  onRefresh: () => Promise<void>;
}) {
  const user = useAuth((s) => s.user);
  const latest = useMemo(() => records[0] ?? null, [records]);

  const [documentType, setDocumentType] = useState<KycDocumentType>('BI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (latest?.status === 'approved') {
    return (
      <GameCard className="p-4 mt-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-p1/15 text-p1 flex items-center justify-center shrink-0">
            <BadgeCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base tracking-wide">Identidade verificada</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              O teu KYC foi aprovado. Já podes pedir levantamentos.
            </p>
          </div>
        </div>
      </GameCard>
    );
  }

  if (latest && (latest.status === 'pending' || latest.status === 'requires_review')) {
    return (
      <GameCard className="p-4 mt-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base tracking-wide">Verificação em análise</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Recebemos os teus documentos e estão em revisão. Avisamos quando estiver concluído.
            </p>
          </div>
        </div>
      </GameCard>
    );
  }

  const canSubmit =
    Boolean(user) && documentNumber.trim().length >= 4 && Boolean(front) && !submitting;

  const handleSubmit = async () => {
    if (!user || !canSubmit || !front) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const frontPath = await uploadKycDocument(user.id, front, 'front');
      const backPath = back ? await uploadKycDocument(user.id, back, 'back') : null;
      const selfiePath = selfie ? await uploadKycDocument(user.id, selfie, 'selfie') : null;
      await submitKyc({
        documentType,
        documentNumber: documentNumber.trim(),
        documentFrontPath: frontPath,
        documentBackPath: backPath,
        selfiePath,
      });
      toast.success('Documentos submetidos.', {
        description: 'A verificação pode demorar algum tempo.',
      });
      setDocumentNumber('');
      setFront(null);
      setBack(null);
      setSelfie(null);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao submeter os documentos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GameCard className="p-4 mt-3 space-y-4">
      <div>
        <h3 className="font-display text-base tracking-wide">Verificação de identidade (KYC)</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Necessária para levantamentos. Os documentos são guardados de forma privada.
        </p>
      </div>

      {latest?.status === 'rejected' && (
        <p className="text-[11px] text-p2 flex items-start gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Pedido anterior rejeitado
          {latest.rejection_reason ? `: ${latest.rejection_reason}` : '.'} Podes submeter de novo.
        </p>
      )}

      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
          Tipo de documento
        </p>
        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDocumentType(d.id)}
              className={cn(
                'px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all',
                documentType === d.id
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
          Número do documento
        </label>
        <input
          type="text"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          placeholder="Ex.: 000123456LA041"
          className="w-full h-11 px-3 mt-1.5 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-gold transition-colors"
        />
      </div>

      <div className="space-y-3">
        <FileField label="Documento (frente)" required file={front} onChange={setFront} />
        <FileField label="Documento (verso)" file={back} onChange={setBack} />
        <FileField label="Selfie" file={selfie} onChange={setSelfie} />
      </div>

      {formError && (
        <p className="text-[11px] text-p2 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          {formError}
        </p>
      )}

      <GameButton variant="p1" className="w-full h-11" onClick={handleSubmit} disabled={!canSubmit}>
        {submitting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <BadgeCheck className="w-4 h-4 mr-2" />
        )}
        SUBMETER PARA VERIFICAÇÃO
      </GameButton>
    </GameCard>
  );
}
