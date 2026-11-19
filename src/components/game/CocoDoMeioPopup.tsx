'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/store/settings';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

const MESSAGES = [
  '🥥 Tira o coco do meio!',
  'Só te resta sair do meio!',
  'Tira o coco do meio, rápido!',
] as const;

const SHOW_MS = 3500;

/**
 * Pop-ups animados "Tira o Coco do Meio": ativa quando o jogador da vez está
 * com a peça no meio e encurralado (só lhe resta sair do meio).
 * Toca o som 'coco' uma vez por ativação; respeita reduceMotion.
 */
export function CocoDoMeioPopup({
  active,
  moveCount = 0,
}: {
  active: boolean;
  moveCount?: number;
}) {
  const reduceMotion = useSettings((s) => s.reduceMotion);
  // Última chave (jogada) para a qual os pop-ups dispararam — dedup
  const [firedKey, setFiredKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const key = `${moveCount}`;

  // Ajuste de estado durante render (padrão do projeto — evita setState em effect)
  if (!active && (firedKey !== null || visible)) {
    setFiredKey(null);
    setVisible(false);
  }
  if (active && firedKey !== key) {
    setFiredKey(key);
    setVisible(true);
  }

  // Som ao ativar (uma vez por jogada)
  useEffect(() => {
    if (firedKey === null) return;
    playSound('coco');
  }, [firedKey]);

  // Auto-ocultar passados os SHOW_MS
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [visible, firedKey]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[45] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {visible &&
          MESSAGES.map((msg, i) => (
            <motion.div
              key={`${key}-${i}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.9 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
              transition={
                reduceMotion
                  ? { duration: 0.15, delay: i * 0.15 }
                  : { type: 'spring', stiffness: 320, damping: 20, delay: i * 0.25 }
              }
              className={cn(
                'rounded-2xl border-2 border-[#f5b426]/85 px-5 py-2',
                'bg-[#060d09]/90 backdrop-blur-sm',
                'shadow-[0_0_18px_rgba(245,180,38,0.45),inset_0_0_12px_rgba(245,180,38,0.12)]',
                'font-display text-lg leading-none tracking-wide text-gold',
                'text-center whitespace-nowrap',
              )}
            >
              {msg}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
