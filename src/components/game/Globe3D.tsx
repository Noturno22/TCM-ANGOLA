'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerLocation {
  id: string;
  country: string;
  flag: string;
  province: string;
  city: string;
  players: number;
  lat: number;
  lng: number;
}

const PLAYER_LOCATIONS: PlayerLocation[] = [
  { id: 'l1', country: 'Angola', flag: '🇦🇴', province: 'Luanda', city: 'Luanda', players: 47, lat: -8.8, lng: 13.2 },
  { id: 'l2', country: 'Angola', flag: '🇦🇴', province: 'Benguela', city: 'Benguela', players: 18, lat: -12.6, lng: 13.4 },
  { id: 'l3', country: 'Angola', flag: '🇦🇴', province: 'Huambo', city: 'Huambo', players: 12, lat: -12.8, lng: 15.7 },
  { id: 'l4', country: 'Angola', flag: '🇦🇴', province: 'Cabinda', city: 'Cabinda', players: 8, lat: -5.6, lng: 12.2 },
  { id: 'l5', country: 'Portugal', flag: '🇵🇹', province: 'Lisboa', city: 'Lisboa', players: 24, lat: 38.7, lng: -9.1 },
  { id: 'l6', country: 'Portugal', flag: '🇵🇹', province: 'Porto', city: 'Porto', players: 11, lat: 41.1, lng: -8.6 },
  { id: 'l7', country: 'Brasil', flag: '🇧🇷', province: 'São Paulo', city: 'São Paulo', players: 33, lat: -23.5, lng: -46.6 },
  { id: 'l8', country: 'Brasil', flag: '🇧🇷', province: 'Rio de Janeiro', city: 'Rio de Janeiro', players: 19, lat: -22.9, lng: -43.2 },
  { id: 'l9', country: 'França', flag: '🇫🇷', province: 'Paris', city: 'Paris', players: 15, lat: 48.8, lng: 2.3 },
  { id: 'l10', country: 'EUA', flag: '🇺🇸', province: 'New York', city: 'New York', players: 9, lat: 40.7, lng: -74.0 },
  { id: 'l11', country: 'Moçambique', flag: '🇲🇿', province: 'Maputo', city: 'Maputo', players: 7, lat: -25.9, lng: 32.6 },
  { id: 'l12', country: 'Cabo Verde', flag: '🇨🇻', province: 'Praia', city: 'Praia', players: 5, lat: 14.9, lng: -23.5 },
  { id: 'l13', country: 'África do Sul', flag: '🇿🇦', province: 'Joanesburgo', city: 'Joanesburgo', players: 13, lat: -26.2, lng: 28.0 },
  { id: 'l14', country: 'Reino Unido', flag: '🇬🇧', province: 'Londres', city: 'Londres', players: 8, lat: 51.5, lng: -0.1 },
];

interface GlobeProps {
  onLocationClick?: (loc: PlayerLocation) => void;
  className?: string;
}

export function Globe3D({ onLocationClick, className }: GlobeProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(340);

  // Responsivo: ajustar tamanho do globo ao container
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      // Quadrado com margem, max 400, min 260
      setSize(Math.max(260, Math.min(400, w - 20)));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const totalPlayers = PLAYER_LOCATIONS.reduce((s, l) => s + l.players, 0);

  return (
    <div ref={containerRef} className={cn('flex flex-col items-center w-full', className)}>
      {/* Info bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-p1/10 border border-p1/20">
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-p1 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-p1" />
          </span>
          <span className="text-sm font-bold text-p1 tabular-nums">{totalPlayers}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">online</span>
        </div>
      </div>

      {/* Globo — responsivo, sem scrollbars */}
      <div
        className="relative overflow-hidden"
        style={{ width: size, height: size }}
      >
        <iframe
          src="/globe.svg"
          className="w-full h-full border-0"
          title="Globo Terrestre"
          style={{ background: 'transparent', overflow: 'hidden' }}
          scrolling="no"
          loading="eager"
        />
      </div>

      {/* Detalhe da localização selecionada */}
      <AnimatePresence>
        {selected && (() => {
          const loc = PLAYER_LOCATIONS.find((l) => l.id === selected);
          if (!loc) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-3 w-full max-w-sm"
            >
              <div className="p-4 rounded-xl bg-surface border border-border shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{loc.flag}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{loc.city}</p>
                    <p className="text-[11px] text-muted-foreground">{loc.province}, {loc.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl text-p1 leading-none">{loc.players}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">a jogar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLocationClick?.(loc)}
                  className="w-full py-2.5 rounded-lg bg-p1 text-white text-sm font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  Desafiar jogadores em {loc.city}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
