'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MapPin, Crosshair, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ Dados de jogadores online ============
interface PlayerLocation {
  id: string;
  country: string;
  countryCode: string;
  flag: string;
  province: string;
  city: string;
  players: number;
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

// ============ Projeção ortográfica ============
function project(lat: number, lng: number, rotation: number, r: number, cx: number, cy: number) {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = ((lng + rotation) * Math.PI) / 180;
  const x = r * Math.cos(latRad) * Math.sin(lngRad);
  const y = -r * Math.sin(latRad);
  const z = r * Math.cos(latRad) * Math.cos(lngRad);
  return { x: cx + x, y: cy + y, visible: z > -r * 0.1 };
}

// ============ Continentes detalhados (mais pontos = mais realista) ============
// Coordenadas [lng, lat] dos contornos continentais
const CONTINENTS: { name: string; points: [number, number][] }[] = [
  // África — contorno detalhado
  {
    name: 'africa',
    points: [
      [-17, 21], [-16, 19], [-13, 16], [-10, 12], [-8, 8], [-5, 6], [-3, 5],
      [0, 5], [3, 6], [6, 4], [8, 2], [9, -1], [12, -5], [13, -9], [12, -15],
      [14, -22], [17, -28], [18, -32], [20, -34], [25, -34], [28, -32],
      [32, -29], [33, -25], [35, -22], [38, -18], [40, -12], [41, -5],
      [42, 0], [43, 4], [46, 8], [48, 11], [51, 12], [52, 10], [50, 7],
      [48, 4], [46, 1], [44, -2], [42, -8], [42, -12], [40, -16], [37, -20],
      [35, -23], [33, -26], [30, -29], [28, -31], [25, -33], [22, -34],
      [18, -34], [16, -32], [14, -28], [12, -24], [11, -20], [10, -16],
      [9, -12], [8, -8], [7, -4], [5, -1], [3, 1], [0, 3], [-3, 4],
      [-6, 5], [-9, 6], [-12, 8], [-15, 12], [-17, 16], [-17, 21],
    ],
  },
  // Europa
  {
    name: 'europe',
    points: [
      [-9, 43], [-8, 44], [-5, 43], [-2, 43], [0, 44], [2, 43], [4, 43],
      [6, 44], [8, 44], [10, 44], [12, 45], [14, 46], [16, 44], [18, 42],
      [20, 40], [22, 39], [24, 38], [26, 37], [28, 37], [30, 38], [32, 39],
      [34, 41], [36, 42], [38, 44], [40, 46], [40, 50], [38, 54], [36, 56],
      [34, 58], [30, 60], [26, 62], [22, 64], [18, 64], [14, 62], [10, 60],
      [6, 58], [4, 56], [2, 54], [0, 52], [-2, 50], [-4, 48], [-6, 46],
      [-8, 44], [-9, 43],
    ],
  },
  // Ásia (extensa)
  {
    name: 'asia',
    points: [
      [30, 40], [34, 38], [38, 36], [42, 38], [46, 40], [50, 42], [54, 40],
      [58, 38], [62, 36], [66, 34], [70, 32], [74, 30], [78, 28], [82, 26],
      [86, 24], [90, 22], [94, 20], [98, 18], [100, 16], [102, 14], [104, 12],
      [106, 10], [108, 12], [110, 14], [112, 16], [114, 18], [116, 20],
      [118, 22], [120, 24], [122, 26], [124, 28], [126, 30], [128, 32],
      [130, 34], [132, 36], [134, 38], [136, 40], [138, 42], [140, 44],
      [140, 48], [138, 52], [134, 56], [130, 58], [126, 60], [120, 62],
      [114, 64], [108, 66], [100, 68], [90, 70], [80, 72], [70, 72],
      [60, 68], [50, 64], [44, 60], [40, 56], [38, 52], [36, 48], [34, 44],
      [32, 42], [30, 40],
    ],
  },
  // América do Norte
  {
    name: 'na',
    points: [
      [-168, 66], [-160, 68], [-150, 70], [-140, 70], [-130, 68], [-125, 64],
      [-122, 58], [-120, 52], [-118, 46], [-116, 40], [-114, 34], [-112, 28],
      [-108, 24], [-104, 22], [-100, 22], [-96, 20], [-92, 18], [-88, 18],
      [-84, 16], [-82, 14], [-80, 10], [-78, 8], [-80, 12], [-82, 16],
      [-80, 20], [-78, 24], [-76, 28], [-74, 32], [-72, 36], [-70, 40],
      [-68, 44], [-66, 46], [-64, 48], [-60, 50], [-58, 52], [-56, 54],
      [-58, 56], [-62, 58], [-68, 60], [-74, 62], [-80, 64], [-88, 66],
      [-96, 68], [-104, 70], [-112, 70], [-120, 68], [-128, 68], [-136, 68],
      [-144, 68], [-152, 68], [-160, 68], [-168, 66],
    ],
  },
  // América do Sul
  {
    name: 'sa',
    points: [
      [-78, 12], [-74, 10], [-70, 10], [-66, 8], [-62, 6], [-58, 4],
      [-54, 2], [-50, 0], [-48, -4], [-46, -8], [-44, -12], [-42, -16],
      [-40, -20], [-42, -24], [-44, -28], [-46, -32], [-48, -36], [-52, -40],
      [-58, -44], [-64, -48], [-70, -52], [-74, -50], [-76, -46], [-74, -42],
      [-72, -38], [-74, -34], [-76, -30], [-78, -26], [-80, -22], [-80, -18],
      [-80, -14], [-80, -10], [-80, -6], [-80, -2], [-80, 2], [-78, 6],
      [-78, 12],
    ],
  },
  // Oceânia (Austrália + Nova Zelândia)
  {
    name: 'oceania',
    points: [
      [114, -22], [118, -20], [122, -18], [126, -16], [130, -14], [134, -16],
      [138, -18], [142, -12], [146, -16], [148, -20], [150, -24], [150, -28],
      [148, -32], [146, -36], [142, -38], [138, -36], [134, -34], [130, -32],
      [126, -30], [122, -28], [118, -26], [114, -24], [114, -22],
    ],
  },
  // Groenlândia
  {
    name: 'greenland',
    points: [
      [-55, 60], [-48, 60], [-40, 62], [-35, 66], [-30, 70], [-25, 74],
      [-22, 78], [-25, 82], [-35, 83], [-45, 82], [-55, 80], [-60, 76],
      [-58, 72], [-55, 68], [-52, 64], [-55, 60],
    ],
  },
  // Antártica (parcial)
  {
    name: 'antarctica',
    points: [
      [-180, -75], [-140, -72], [-100, -70], [-60, -68], [-20, -70],
      [20, -68], [60, -70], [100, -68], [140, -70], [180, -75],
      [180, -85], [-180, -85], [-180, -75],
    ],
  },
];

interface GlobeProps {
  onLocationClick?: (loc: PlayerLocation) => void;
  className?: string;
}

export function Globe3D({ onLocationClick, className }: GlobeProps) {
  const [rotation, setRotation] = useState(20);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const dragRef = useRef<{ startX: number; startRot: number } | null>(null);

  // Auto-rotação suave
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotation((r) => r + 0.25);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Pulsar dos marcadores
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;

  // Projetar continentes
  const continentPaths = useMemo(() => {
    return CONTINENTS.map((cont) => {
      const projected = cont.points.map(([lng, lat]) => project(lat, lng, rotation, r, cx, cy));
      // Só desenhar se pelo menos 3 pontos visíveis
      const visiblePts = projected.filter((p) => p.visible);
      if (visiblePts.length < 3) return { name: cont.name, path: '', opacity: 0 };
      // Para continentes parcialmente visíveis, usar clip via circle
      const pts = projected.map((p) => `${p.x},${p.y}`);
      const path = `M ${pts.join(' L ')} Z`;
      return { name: cont.name, path, opacity: 1 };
    });
  }, [rotation, r, cx, cy]);

  // Projetar marcadores
  const markers = useMemo(() => {
    return PLAYER_LOCATIONS.map((loc) => {
      const p = project(loc.lat, loc.lng, rotation, r, cx, cy);
      return { ...loc, ...p };
    });
  }, [rotation, r, cx, cy]);

  const totalPlayers = PLAYER_LOCATIONS.reduce((s, l) => s + l.players, 0);
  const visibleMarkers = markers.filter((m) => m.visible);

  // Drag para girar manualmente
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startRot: rotation };
    setAutoRotate(false);
  }, [rotation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    setRotation(dragRef.current.startRot + dx * 0.5);
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Info bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-p1/10 border border-p1/20">
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-p1 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-p1" />
          </span>
          <span className="text-sm font-bold text-p1 tabular-nums">{totalPlayers}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">online</span>
        </div>
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
        >
          <Crosshair className="w-3.5 h-3.5" />
          {autoRotate ? 'Pausar' : 'Girar'}
        </button>
      </div>

      {/* Globo */}
      <div
        className="relative select-none"
        style={{ width: size, height: size, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          <defs>
            {/* Oceano — cinza claro com gradiente subtil */}
            <radialGradient id="oceanGrad" cx="38%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#F5F6F8" />
              <stop offset="60%" stopColor="#ECEEF1" />
              <stop offset="100%" stopColor="#D8DBE0" />
            </radialGradient>
            {/* Sombra interna para efeito 3D (lado escuro) */}
            <radialGradient id="sphereShadow" cx="35%" cy="30%" r="75%">
              <stop offset="55%" stopColor="rgba(0,0,0,0)" />
              <stop offset="85%" stopColor="rgba(0,0,0,0.08)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
            </radialGradient>
            {/* Highlight glossy (topo-esquerda) */}
            <radialGradient id="sphereHighlight" cx="32%" cy="28%" r="40%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            {/* Crescent highlight (bottom-right) */}
            <radialGradient id="crescentHL" cx="65%" cy="68%" r="35%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            {/* Clip path para continentes (não sair do círculo) */}
            <clipPath id="globeClip">
              <circle cx={cx} cy={cy} r={r} />
            </clipPath>
            {/* Filtro de sombra exterior */}
            <filter id="globeDropShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Sombra exterior do globo */}
          <ellipse cx={cx} cy={cy + r + 4} rx={r * 0.85} ry={8} fill="rgba(0,0,0,0.08)" />

          {/* Esfera (oceano) */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="url(#oceanGrad)"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="1"
            filter="url(#globeDropShadow)"
          />

          {/* Continentes (clipados ao círculo) */}
          <g clipPath="url(#globeClip)">
            {continentPaths.map((cont) =>
              cont.path ? (
                <path
                  key={cont.name}
                  d={cont.path}
                  fill="#2A2A2A"
                  stroke="#222"
                  strokeWidth="0.4"
                  opacity={cont.opacity}
                />
              ) : null,
            )}

            {/* Linhas de latitude (paralelos) */}
            {[-60, -30, 0, 30, 60].map((lat) => {
              const latRad = (lat * Math.PI) / 180;
              const ry = r * Math.cos(latRad);
              const py = cy - r * Math.sin(latRad);
              return (
                <ellipse
                  key={`lat-${lat}`}
                  cx={cx}
                  cy={py}
                  rx={ry}
                  ry={ry}
                  fill="none"
                  stroke="rgba(0,0,0,0.04)"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Linhas de longitude (meridianos) */}
            {[0, 30, 60, 90, 120, 150].map((deg) => {
              const rad = ((deg + rotation) * Math.PI) / 180;
              const ellipseW = Math.abs(r * Math.cos(rad));
              if (ellipseW < 2) return null;
              return (
                <ellipse
                  key={`lng-${deg}`}
                  cx={cx}
                  cy={cy}
                  rx={ellipseW}
                  ry={r}
                  fill="none"
                  stroke="rgba(0,0,0,0.04)"
                  strokeWidth="0.5"
                />
              );
            })}
          </g>

          {/* Sombra 3D (lado escuro do globo) */}
          <circle cx={cx} cy={cy} r={r} fill="url(#sphereShadow)" pointerEvents="none" />
          {/* Highlight glossy (topo-esquerda) */}
          <circle cx={cx} cy={cy} r={r} fill="url(#sphereHighlight)" pointerEvents="none" />
          {/* Crescent highlight (bottom-right) */}
          <circle cx={cx} cy={cy} r={r} fill="url(#crescentHL)" pointerEvents="none" />

          {/* Marcadores de jogadores */}
          {markers.map((m) => {
            if (!m.visible) return null;
            const isSelected = selected === m.id;
            const markerR = m.players > 30 ? 7 : m.players > 15 ? 6 : m.players > 5 ? 5 : 4;
            const pulseR = markerR + 4 + (tick % 3) * 3;
            return (
              <g
                key={m.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(m.id);
                  onLocationClick?.(m);
                }}
              >
                {/* Pulso animado */}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={pulseR}
                  fill="rgba(88,168,85,0.12)"
                />
                {/* Anel */}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={markerR + 2}
                  fill="none"
                  stroke="rgba(88,168,85,0.4)"
                  strokeWidth="1"
                />
                {/* Marcador sólido */}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={markerR}
                  fill={isSelected ? '#F0B90B' : '#3AA855'}
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Número se selecionado */}
                {isSelected && (
                  <text
                    x={m.x}
                    y={m.y - markerR - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#2A2A2A"
                  >
                    {m.players} 👤
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Indicador de drag */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground/50 pointer-events-none">
          ↔ Arrasta para girar
        </div>
      </div>

      {/* Localizações visíveis */}
      <div className="mt-4 w-full">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 text-center font-medium">
          {visibleMarkers.length} localizações ativas
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center max-w-sm mx-auto">
          {visibleMarkers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setSelected(m.id); onLocationClick?.(m); }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                selected === m.id
                  ? 'bg-gold/10 text-gold border border-gold/30 shadow-sm'
                  : 'bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-border/80',
              )}
            >
              <span className="text-sm">{m.flag}</span>
              <span>{m.city}</span>
              <span className="text-p1 font-bold tabular-nums">{m.players}</span>
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mt-4 w-full max-w-sm"
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
