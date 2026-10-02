'use client';

import { cn } from '@/lib/utils';

interface AdSlotProps {
  /** Formato do anúncio */
  format?: 'banner-top' | 'banner-inline' | 'square' | 'responsive';
  className?: string;
  /** Label visível "Anúncio" */
  showLabel?: boolean;
}

/**
 * Área reservada para Google AdSense.
 * Em produção: substituir o conteúdo por <ins class="adsbygoogle" ...>.
 * Por agora mostra um placeholder discreto.
 */
export function AdSlot({ format = 'responsive', className, showLabel = true }: AdSlotProps) {
  const sizes: Record<string, string> = {
    'banner-top': 'h-[90px] min-h-[90px]',
    'banner-inline': 'h-[100px] min-h-[100px]',
    'square': 'h-[250px] min-h-[250px] max-w-[300px] mx-auto',
    'responsive': 'h-[120px] min-h-[120px]',
  };

  return (
    <div
      className={cn(
        'relative w-full rounded-lg bg-surface-2/50 border border-dashed border-border/60 overflow-hidden',
        'flex items-center justify-center',
        sizes[format],
        className,
      )}
      aria-label="Espaço publicitário"
    >
      {/* Em produção: <ins className="adsbygoogle" style={{display:'block'}} data-ad-client="ca-pub-XXX" data-ad-slot="XXX" data-ad-format="auto" /> */}
      {showLabel && (
        <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
          <span className="text-[9px] uppercase tracking-widest font-semibold">Anúncio</span>
          <span className="text-[8px]">Google Ads</span>
        </div>
      )}
    </div>
  );
}
