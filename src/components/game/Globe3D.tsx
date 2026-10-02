'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MapPin, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ Dados de jogadores online (simulados) ============
interface PlayerLocation {
  id: string;
  country: string;
  countryCode: string;
  flag: string;
  province: string;
  city: string;
  players: number;
  // Coordenadas lat/lng para projeção no globo
  lat: number;
  lng: number;
}

const PLAYER_LOCATIONS: PlayerLocation[] = [
  { id: 'l1', country: 'Angola', countryCode: 'AO', flag: '🇦🇴', province: 'Luanda', city: 'Luanda', players: 47, lat: -8.8, lng: 13.2 },
  { id: 'l2', country: 'Angola', countryCode: 'AO', flag: '🇦🇴', province: 'Benguela', city: 'Benguela', players: 18, lat: -12.6, lng: 13.4 },
  { id: 'l3', country: 'Angola', countryCode: 'AO', flag: '🇦🇴', province: 'Huambo', city: 'Huambo', players: 12, lat: -12.8, lng: 15.7 },
  { id: 'l4', country: 'Angola', countryCode: 'AO', flag: '🇦🇴', province: 'Cabinda', city: 'Cabinda', players: 8, lat: -5.6, lng: 12.2 },
  { id: 'l5', country: 'Portugal', countryCode: 'PT', flag: '🇵🇹', province: 'Lisboa', city: 'Lisboa', players: 24, lat: 38.7, lng: -9.1 },
  { id: 'l6', country: 'Portugal', countryCode: 'PT', flag: '🇵🇹', province: 'Porto', city: 'Porto', players: 11, lat: 41.1, lng: -8.6 },
  { id: 'l7', country: 'Brasil', countryCode: 'BR', flag: '🇧🇷', province: 'São Paulo', city: 'São Paulo', players: 33, lat: -23.5, lng: -46.6 },
  { id: 'l8', country: 'Brasil', countryCode: 'BR', flag: '🇧🇷', province: 'Rio de Janeiro', city: 'Rio de Janeiro', players: 19, lat: -22.9, lng: -43.2 },
  { id: 'l9', country: 'França', countryCode: 'FR', flag: '🇫🇷', province: 'Paris', city: 'Paris', players: 15, lat: 48.8, lng: 2.3 },
  { id: 'l10', country: 'EUA', countryCode: 'US', flag: '🇺🇸', province: 'New York', city: 'New York', players: 9, lat: 40.7, lng: -74.0 },
  { id: 'l11', country: 'Moçambique', countryCode: 'MZ', flag: '🇲🇿', province: 'Maputo', city: 'Maputo', players: 7, lat: -25.9, lng: 32.6 },
  { id: 'l12', country: 'Cabo Verde', countryCode: 'CV', flag: '🇨🇻', province: 'Praia', city: 'Praia', players: 5, lat: 14.9, lng: -23.5 },
  { id: 'l13', country: 'África do Sul', countryCode: 'ZA', flag: '🇿🇦', province: 'Joanesburgo', city: 'Joanesburgo', players: 13, lat: -26.2, lng: 28.0 },
  { id: 'l14', country: 'Reino Unido', countryCode: 'GB', flag: '🇬🇧', province: 'Londres', city: 'Londres', players: 8, lat: 51.5, lng: -0.1 },
];

// ============ Projeção ortográfica (lat/lng → x/y no SVG) ============
function project(lat: number, lng: number, rotation: number, r: number, cx: number, cy: number): { x: number; y: number; visible: boolean } {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = ((lng + rotation) * Math.PI) / 180;
  const x = r * Math.cos(latRad) * Math.sin(lngRad);
  const y = -r * Math.sin(latRad);
  const z = r * Math.cos(latRad) * Math.cos(lngRad);
  return { x: cx + x, y: cy + y, visible: z > 0 };
}

// ============ Continentes simplificados (SVG paths) ============
// Pontos aproximados dos continentes como polígonos fechados
const CONTINENTS: { name: string; points: [number, number][] }[] = [
  // África
  {
    name: 'africa',
    points: [
      [10, -35], [20, -35], [35, -25], [45, -15], [52, -5], [50, 5], [48, 12],
      [42, 15], [40, 25], [35, 30], [30, 32], [20, 32], [10, 28], [5, 20],
      [-5, 15], [-15, 12], [-20, 5], [-25, -5], [-25, -20], [-20, -30], [-10, -33],
    ],
  },
  // Europa
  {
    name: 'europe',
    points: [
      [-10, 38], [0, 36], [10, 38], [20, 40], [30, 42], [35, 50], [30, 60],
      [20, 65], [10, 62], [0, 60], [-5, 55], [-10, 50], [-10, 42],
    ],
  },
  // Ásia (ocidental)
  {
    name: 'asia',
    points: [
      [35, 42], [45, 40], [60, 35], [75, 30], [85, 25], [90, 35], [100, 40],
      [110, 50], [120, 55], [130, 50], [135, 45], [130, 35], [120, 25], [110, 15],
      [100, 10], [90, 15], [80, 20], [70, 25], [60, 30], [50, 35], [40, 38],
    ],
  },
  // América do Norte
  {
    name: 'na',
    points: [
      [-130, 55], [-120, 60], [-100, 65], [-80, 60], [-65, 50], [-60, 45],
      [-70, 35], [-80, 30], [-85, 25], [-95, 25], [-100, 30], [-110, 32],
      [-120, 35], [-125, 42], [-130, 48],
    ],
  },
  // América do Sul
  {
    name: 'sa',
    points: [
      [-80, 12], [-70, 10], [-55, 5], [-45, -5], [-40, -15], [-45, -25],
      [-50, -35], [-60, -40], [-70, -45], [-75, -40], [-78, -30], [-80, -20],
      [-80, -5],
    ],
  },
  // Oceânia
  {
    name: 'oceania',
    points: [
      [115, -15], [125, -12], [135, -15], [145, -18], [150, -25], [148, -35],
      [140, -38], [130, -32], [120, -25], [115, -20],
    ],
  },
];

interface GlobeProps {
  onLocationClick?: (loc: PlayerLocation) => void;
  className?: string;
}

export function Globe3D({ onLocationClick, className }: GlobeProps) {
  const [rotation, setRotation] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-rotação lenta
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotation((r) => (r + 360) % 36000 / 100); // 0.35 graus por tick
    }, 50);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Pulsar dos marcadores
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((p) => (p + 1) % 100);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;

  // Projetar continentes
  const continentPaths = useMemo(() => {
    return CONTINENTS.map((cont) => {
      const pts = cont.points.map(([lng, lat]) => {
        const p = project(lat, lng, rotation, r, cx, cy);
        return p.visible ? `${p.x},${p.y}` : null;
      }).filter(Boolean);
      return { name: cont.name, path: pts.length > 2 ? `M ${pts.join(' L ')} Z` : '' };
    });
  }, [rotation, r, cx, cy]);

  // Projetar marcadores de jogadores
  const markers = useMemo(() => {
    return PLAYER_LOCATIONS.map((loc) => {
      const p = project(loc.lat, loc.lng, rotation, r, cx, cy);
      return { ...loc, ...p };
    });
  }, [rotation, r, cx, cy]);

  const totalPlayers = PLAYER_LOCATIONS.reduce((s, l) => s + l.players, 0);
  const visibleMarkers = markers.filter((m) => m.visible);

  return (
    <div ref={containerRef} className={cn('relative flex flex-col items-center', className)}>
      {/* Info bar */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-p1/10 text-p1">
          <span className="w-2 h-2 rounded-full bg-p1 animate-pulse-soft" />
          <span className="font-semibold">{totalPlayers}</span>
          <span className="text-[10px] uppercase tracking-wider">online</span>
        </div>
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-muted-foreground hover:text-foreground transition-colors text-xs"
        >
          <Crosshair className="w-3 h-3" />
          {autoRotate ? 'Parar' : 'Girar'}
        </button>
      </div>

      {/* Globo SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 8px 24px oklch(0 0 0 / 0.15))' }}
        >
          <defs>
            {/* Gradiente do oceano */}
            <radialGradient id="ocean" cx="35%" cy="35%">
              <stop offset="0%" stopColor="oklch(0.97 0.003 120)" />
              <stop offset="70%" stopColor="oklch(0.93 0.005 120)" />
              <stop offset="100%" stopColor="oklch(0.88 0.008 120)" />
            </radialGradient>
            {/* Sombra interna para efeito 3D */}
            <radialGradient id="shadow3d" cx="50%" cy="50%">
              <stop offset="60%" stopColor="transparent" />
              <stop offset="100%" stopColor="oklch(0 0 0 / 0.12)" />
            </radialGradient>
            {/* Brilho do sol */}
            <radialGradient id="highlight" cx="30%" cy="30%">
              <stop offset="0%" stopColor="oklch(1 0 0 / 0.4)" />
              <stop offset="40%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Oceano (esfera) */}
          <circle cx={cx} cy={cy} r={r} fill="url(#ocean)" stroke="oklch(0.85 0.003 120)" strokeWidth="1" />

          {/* Continentes */}
          {continentPaths.map((cont) =>
            cont.path ? (
              <path
                key={cont.name}
                d={cont.path}
                fill="oklch(0.35 0.01 150)"
                stroke="oklch(0.3 0.01 150)"
                strokeWidth="0.5"
                opacity={0.85}
              />
            ) : null,
          )}

          {/* Sombra 3D */}
          <circle cx={cx} cy={cy} r={r} fill="url(#shadow3d)" pointerEvents="none" />
          {/* Highlight */}
          <circle cx={cx} cy={cy} r={r} fill="url(#highlight)" pointerEvents="none" />

          {/* Meridianos (linhas de longitude) */}
          {[0, 30, 60, 90, 120, 150].map((deg) => {
            const rad = ((deg + rotation) * Math.PI) / 180;
            const x1 = cx + r * Math.cos(rad);
            const y1 = cy;
            const x2 = cx - r * Math.cos(rad);
            const y2 = cy;
            const ellipseW = Math.abs(r * Math.cos(rad));
            if (ellipseW < 2) return null;
            return (
              <ellipse
                key={`meridian-${deg}`}
                cx={cx}
                cy={cy}
                rx={ellipseW}
                ry={r}
                fill="none"
                stroke="oklch(0.7 0.003 120 / 0.3)"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Paralelos (linhas de latitude) */}
          {[-60, -30, 0, 30, 60].map((lat) => {
            const latRad = (lat * Math.PI) / 180;
            const ry = r * Math.cos(latRad);
            const py = cy - r * Math.sin(latRad);
            return (
              <ellipse
                key={`parallel-${lat}`}
                cx={cx}
                cy={py}
                rx={ry}
                ry={ry}
                fill="none"
                stroke="oklch(0.7 0.003 120 / 0.2)"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Marcadores de jogadores */}
          {markers.map((m) => {
            if (!m.visible) return null;
            const isSelected = selected === m.id;
            const size_marker = m.players > 30 ? 8 : m.players > 15 ? 6 : m.players > 5 ? 5 : 4;
            return (
              <g key={m.id} className="cursor-pointer" onClick={() => { setSelected(m.id); onLocationClick?.(m); }}>
                {/* Pulso */}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={size_marker + 6 + (pulsePhase % 3) * 2}
                  fill="oklch(0.58 0.14 150 / 0.15)"
                  className="animate-pulse-soft"
                />
                {/* Marcador */}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={size_marker}
                  fill={isSelected ? 'oklch(0.7 0.15 75)' : 'oklch(0.58 0.14 150)'}
                  stroke="white"
                  strokeWidth="1.5"
                />
                {/* Número de jogadores (se selecionado) */}
                {isSelected && (
                  <text
                    x={m.x}
                    y={m.y - size_marker - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="oklch(0.7 0.15 75)"
                  >
                    {m.players} 🎮
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Lista de localizações visíveis */}
      <div className="mt-3 w-full max-w-xs">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 text-center font-medium">
          {visibleMarkers.length} localizações visíveis
        </p>
        <div className="flex flex-wrap gap-1 justify-center">
          {visibleMarkers.slice(0, 8).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setSelected(m.id); onLocationClick?.(m); }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                selected === m.id
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'bg-surface-2 text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{m.flag}</span>
              <span>{m.city}</span>
              <span className="text-p1 font-bold">{m.players}</span>
            </button>
          ))}
        </div>
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
              className="mt-3 w-full max-w-xs"
            >
              <div className="p-3 rounded-lg bg-surface border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{loc.flag}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{loc.city}, {loc.country}</p>
                    <p className="text-[10px] text-muted-foreground">{loc.province}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-p1 leading-none">{loc.players}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">jogadores</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLocationClick?.(loc)}
                  className="w-full py-2 rounded-md bg-p1 text-white text-xs font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Desafiar jogadores
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
