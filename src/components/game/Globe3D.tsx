'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, MapPin, ZoomIn, ZoomOut, Globe2, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tipos
type MaplibreMapType = {
  on(event: string, cb: () => void): void;
  getZoom(): number;
  getBearing(): number;
  setBearing(b: number): void;
  flyTo(opts: { center: [number, number]; zoom: number; duration: number }): void;
  zoomIn(opts: { duration: number }): void;
  zoomOut(opts: { duration: number }): void;
  remove(): void;
};

type MaplibreMarkerType = {
  setLngLat(coords: [number, number]): MaplibreMarkerType;
  addTo(map: MaplibreMapType): MaplibreMarkerType;
  remove(): void;
};

// ============ Dados de jogadores online ============
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMapType | null>(null);
  const markersRef = useRef<MaplibreMarkerType[]>([]);
  const [selected, setSelected] = useState<PlayerLocation | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [ready, setReady] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    // Import dinâmico para evitar problemas de SSR com maplibre
    import('maplibre-gl').then((maplibregl) => {
      import('maplibre-gl/dist/maplibre-gl.css');
      if (cancelled || !containerRef.current) return;

      const Map = (maplibregl as unknown as { Map: new (opts: Record<string, unknown>) => MaplibreMapType }).Map;
      const Marker = (maplibregl as unknown as { Marker: new (opts: { element: HTMLElement }) => MaplibreMarkerType }).Marker;

      const map = new Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [13.2, -8.8], // Centrado em Angola
      zoom: 1.5,
      minZoom: 1,
      maxZoom: 12,
      pitch: 0,
      bearing: 0,
      dragRotate: true,
      touchZoomRotate: true,
    });

    mapRef.current = map;

    map.on('load', () => {
      setReady(true);

      // Adicionar marcadores
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      for (const loc of PLAYER_LOCATIONS) {
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        const sz = loc.players > 30 ? 44 : loc.players > 15 ? 38 : loc.players > 5 ? 32 : 28;
        const col = loc.players > 30 ? '#F0B90B' : '#3AA855';
        el.innerHTML = `<div style="position:relative;width:${sz}px;height:${sz}px;"><div style="position:absolute;inset:0;border-radius:50%;background:${col}33;animation:mkpulse 2s ease-in-out infinite;"></div><div style="position:absolute;inset:4px;border-radius:50%;background:${col};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="font-size:${sz > 36 ? '11px' : '9px'};font-weight:700;color:white;">${loc.players}</span></div></div>`;
        el.title = `${loc.flag} ${loc.city}, ${loc.country} — ${loc.players} jogadores`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelected(loc);
          map.flyTo({ center: [loc.lng, loc.lat], zoom: Math.max(map.getZoom(), 4), duration: 1000 });
        });
        const marker = new Marker({ element: el }).setLngLat([loc.lng, loc.lat]).addTo(map as MaplibreMapType);
        markersRef.current.push(marker);
      }
    });
    }); // fim do .then()

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Auto-rotação lenta
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    let raf: number;
    let lastTime = 0;

    const rotate = (time: number) => {
      if (autoRotate && time - lastTime > 50) {
        const bearing = map.getBearing();
        map.setBearing(bearing + 0.2);
        lastTime = time;
      }
      raf = requestAnimationFrame(rotate);
    };
    raf = requestAnimationFrame(rotate);

    return () => cancelAnimationFrame(raf);
  }, [autoRotate, ready]);

  // CSS para animação pulse
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes mkpulse {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.4); opacity: 0.15; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const totalPlayers = PLAYER_LOCATIONS.reduce((s, l) => s + l.players, 0);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 });
  };
  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 });
  };
  const handleResetView = () => {
    mapRef.current?.flyTo({ center: [13.2, -8.8], zoom: 1.5, bearing: 0, duration: 1000 });
    setSelected(null);
  };

  return (
    <div className={cn('flex flex-col items-center w-full', className)}>
      {/* Info bar + controlos */}
      <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
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
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-full border transition-colors text-xs font-medium',
            autoRotate
              ? 'bg-p1/10 text-p1 border-p1/20'
              : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground'
          )}
        >
          <Globe2 className="w-3.5 h-3.5" />
          {autoRotate ? 'A girar' : 'Parado'}
        </button>

        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-full bg-surface-2 border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          aria-label="Aproximar"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-full bg-surface-2 border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          aria-label="Afastar"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleResetView}
          className="w-8 h-8 rounded-full bg-surface-2 border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          aria-label="Repor vista"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* Mapa MapLibre */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden border border-border"
        style={{ height: 380, minHeight: 300, background: '#e8eaed' }}
      />

      {/* Indicador */}
      <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
        🖱️ Arrasta para girar • Scroll para zoom • Clique nos marcadores
      </p>

      {/* Detalhe da localização selecionada */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mt-3 w-full max-w-sm"
          >
            <div className="p-4 rounded-xl bg-surface border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{selected.flag}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-p1" />
                    {selected.city}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{selected.province}, {selected.country}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl text-p1 leading-none">{selected.players}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">a jogar</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground">
                <Users className="w-3.5 h-3.5 text-p1" />
                <span>{selected.players} jogadores disponíveis para desafiar</span>
              </div>
              <button
                type="button"
                onClick={() => onLocationClick?.(selected)}
                className="w-full py-2.5 rounded-lg bg-p1 text-white text-sm font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Users className="w-4 h-4" />
                Desafiar jogadores em {selected.city}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
