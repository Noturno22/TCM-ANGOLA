'use client';

import { motion } from 'framer-motion';
import { Check, Coins, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useProfile } from '@/store/profile';
import { useSettings, type CosmeticKind } from '@/store/settings';
import {
  BOARD_BACKGROUNDS,
  LINE_STYLES,
  PIECE_STYLES,
  type BoardBackgroundDef,
  type LineStyleDef,
  type PieceStyleDef,
} from '@/lib/cosmetics';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { cn } from '@/lib/utils';

export function ShopScreen() {
  const coins = useProfile((s) => s.coins);
  const spendCoins = useProfile((s) => s.spendCoins);
  const owned = useSettings((s) => s.ownedCosmetics);
  const backgroundId = useSettings((s) => s.backgroundId);
  const lineStyleId = useSettings((s) => s.lineStyleId);
  const pieceStyleId = useSettings((s) => s.pieceStyleId);
  const ownCosmetic = useSettings((s) => s.ownCosmetic);
  const equipCosmetic = useSettings((s) => s.equipCosmetic);

  const ownedSet = new Set(owned);
  const equippedId: Record<CosmeticKind, string> = {
    background: backgroundId,
    line: lineStyleId,
    piece: pieceStyleId,
  };

  const handleAction = (kind: CosmeticKind, id: string, price: number) => {
    if (ownedSet.has(id)) {
      equipCosmetic(kind, id);
      toast.success('Cosmético equipado');
      return;
    }
    if (!spendCoins(price)) {
      toast.error('KZ insuficiente', { description: 'Ganha mais KZ jogando partidas.' });
      return;
    }
    ownCosmetic(id);
    equipCosmetic(kind, id);
    toast.success('Comprado e equipado!', { description: `-${price} KZ` });
  };

  return (
    <div className="space-y-6 animate-slide-up pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-wide">LOJA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personaliza o teu tabuleiro, linhas e peças.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-surface-2 border border-border pl-3 pr-1.5 py-2 shrink-0">
          <Coins className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold tabular-nums">{coins.toLocaleString('pt-PT')}</span>
          <span className="text-[12px] text-muted-foreground font-medium">KZ</span>
        </div>
      </div>

      <Section title="Fundos do tabuleiro">
        <div className="grid grid-cols-2 gap-2.5">
          {BOARD_BACKGROUNDS.map((item, i) => (
            <ShopItem
              key={item.id}
              index={i}
              name={item.name}
              price={item.price}
              owned={ownedSet.has(item.id)}
              equipped={equippedId.background === item.id}
              canAfford={coins >= item.price}
              preview={<BackgroundPreview def={item} />}
              onAction={() => handleAction('background', item.id, item.price)}
            />
          ))}
        </div>
      </Section>

      <Section title="Estilo das linhas">
        <div className="grid grid-cols-2 gap-2.5">
          {LINE_STYLES.map((item, i) => (
            <ShopItem
              key={item.id}
              index={i}
              name={item.name}
              price={item.price}
              owned={ownedSet.has(item.id)}
              equipped={equippedId.line === item.id}
              canAfford={coins >= item.price}
              preview={<LinePreview def={item} />}
              onAction={() => handleAction('line', item.id, item.price)}
            />
          ))}
        </div>
      </Section>

      <Section title="Estilo das peças">
        <div className="grid grid-cols-2 gap-2.5">
          {PIECE_STYLES.map((item, i) => (
            <ShopItem
              key={item.id}
              index={i}
              name={item.name}
              price={item.price}
              owned={ownedSet.has(item.id)}
              equipped={equippedId.piece === item.id}
              canAfford={coins >= item.price}
              preview={<PiecePreview def={item} />}
              onAction={() => handleAction('piece', item.id, item.price)}
            />
          ))}
        </div>
      </Section>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed pt-2">
        Os cosméticos gratuitos estão sempre disponíveis. Ganhas KZ a cada partida jogada.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle title={title} />
      {children}
    </div>
  );
}

function ShopItem({
  name,
  price,
  owned,
  equipped,
  canAfford,
  preview,
  onAction,
  index,
}: {
  name: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  preview: React.ReactNode;
  onAction: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
    >
      <GameCard
        className={cn('p-3 h-full flex flex-col gap-3', equipped ? 'border-gold/60' : 'border-border/40')}
        glow={equipped ? 'gold' : null}
      >
        <div className="relative">
          {preview}
          {equipped && (
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold text-primary-foreground flex items-center justify-center shadow-md-clean">
              <Check className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        <p className="text-sm font-semibold leading-tight flex-1">{name}</p>
        {equipped ? (
          <div className="flex items-center justify-center gap-1 h-10 rounded-xl bg-gold/15 text-gold text-xs font-semibold">
            <Check className="w-4 h-4" />
            Equipado
          </div>
        ) : owned ? (
          <GameButton variant="outline" className="w-full h-12 text-xs" onClick={onAction}>
            Equipar
          </GameButton>
        ) : (
          <GameButton
            variant="primary"
            className="w-full h-12 text-xs"
            onClick={onAction}
            disabled={!canAfford}
          >
            {canAfford ? <Coins className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
            {price} KZ
          </GameButton>
        )}
      </GameCard>
    </motion.div>
  );
}

function BackgroundPreview({ def }: { def: BoardBackgroundDef }) {
  return (
    <div className="h-20 rounded-lg border border-border overflow-hidden">
      <div className="w-full h-full" style={def.css} />
    </div>
  );
}

function LinePreview({ def }: { def: LineStyleDef }) {
  return (
    <div className="h-20 rounded-lg border border-border bg-white flex items-center justify-center">
      <svg viewBox="0 0 80 80" className="w-16 h-16" aria-hidden>
        <g
          stroke={def.stroke}
          strokeWidth={def.strokeWidth * 0.25}
          strokeLinecap={(def.strokeLinecap ?? 'round') as 'butt' | 'round' | 'square'}
          strokeDasharray={def.strokeDasharray}
          style={def.glow ? { filter: def.glow } : undefined}
        >
          <line x1="14" y1="14" x2="66" y2="14" />
          <line x1="14" y1="40" x2="66" y2="40" />
          <line x1="14" y1="66" x2="66" y2="66" />
          <line x1="14" y1="14" x2="14" y2="66" />
          <line x1="40" y1="14" x2="40" y2="66" />
          <line x1="66" y1="14" x2="66" y2="66" />
          <line x1="14" y1="14" x2="66" y2="66" />
          <line x1="66" y1="14" x2="14" y2="66" />
        </g>
      </svg>
    </div>
  );
}

function PiecePreview({ def }: { def: PieceStyleDef }) {
  return (
    <div className="h-20 rounded-lg border border-border bg-surface-2 flex items-center justify-center gap-3">
      <span className="w-9 h-9 rounded-full" style={def.p1} />
      <span className="w-9 h-9 rounded-full" style={def.p2} />
    </div>
  );
}
