'use client';

import { useEffect, useRef } from 'react';
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

interface GlobeProps {
  onLocationClick?: (loc: PlayerLocation) => void;
  className?: string;
}

/**
 * Lookup estático das 14 localizações conhecidas do globe.svg (MKS: [lon, lat, players]).
 * `flag` usa código ISO do país (sem emoji).
 */
const LOCATIONS: PlayerLocation[] = [
  { id: 'luanda', country: 'Angola', flag: 'AO', province: 'Luanda', city: 'Luanda', players: 47, lat: -8.8, lng: 13.2 },
  { id: 'benguela', country: 'Angola', flag: 'AO', province: 'Benguela', city: 'Benguela', players: 18, lat: -12.6, lng: 13.4 },
  { id: 'huambo', country: 'Angola', flag: 'AO', province: 'Huambo', city: 'Huambo', players: 12, lat: -12.8, lng: 15.7 },
  { id: 'cabinda', country: 'Angola', flag: 'AO', province: 'Cabinda', city: 'Cabinda', players: 8, lat: -5.6, lng: 12.2 },
  { id: 'lisboa', country: 'Portugal', flag: 'PT', province: 'Lisboa', city: 'Lisboa', players: 24, lat: 38.7, lng: -9.1 },
  { id: 'porto', country: 'Portugal', flag: 'PT', province: 'Porto', city: 'Porto', players: 11, lat: 41.1, lng: -8.6 },
  { id: 'sao-paulo', country: 'Brasil', flag: 'BR', province: 'São Paulo', city: 'São Paulo', players: 33, lat: -23.5, lng: -46.6 },
  { id: 'rio-de-janeiro', country: 'Brasil', flag: 'BR', province: 'Rio de Janeiro', city: 'Rio de Janeiro', players: 19, lat: -22.9, lng: -43.2 },
  { id: 'paris', country: 'França', flag: 'FR', province: 'Île-de-France', city: 'Paris', players: 15, lat: 48.8, lng: 2.3 },
  { id: 'nova-iorque', country: 'Estados Unidos', flag: 'US', province: 'Nova Iorque', city: 'Nova Iorque', players: 9, lat: 40.7, lng: -74.0 },
  { id: 'maputo', country: 'Moçambique', flag: 'MZ', province: 'Maputo', city: 'Maputo', players: 7, lat: -25.9, lng: 32.6 },
  { id: 'praia', country: 'Cabo Verde', flag: 'CV', province: 'Santiago', city: 'Praia', players: 5, lat: 14.9, lng: -23.5 },
  { id: 'johannesburgo', country: 'África do Sul', flag: 'ZA', province: 'Gauteng', city: 'Joanesburgo', players: 13, lat: -26.2, lng: 28.0 },
  { id: 'londres', country: 'Reino Unido', flag: 'GB', province: 'Inglaterra', city: 'Londres', players: 8, lat: 51.5, lng: -0.1 },
];

/** Encontra a localização mais próxima (tolerância de 1°) das coordenadas [lon, lat] do globo. */
function findLocation(lng: number, lat: number): PlayerLocation | null {
  let best: PlayerLocation | null = null;
  let bestDist = 1;
  for (const loc of LOCATIONS) {
    const d = Math.max(Math.abs(loc.lng - lng), Math.abs(loc.lat - lat));
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return best;
}

interface GlobeLocationMessage {
  type: 'globe:location';
  lon: number;
  lat: number;
  players: number;
}

function isLocationMessage(data: unknown): data is GlobeLocationMessage {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === 'globe:location' &&
    typeof msg.lon === 'number' &&
    typeof msg.lat === 'number' &&
    typeof msg.players === 'number'
  );
}

export function Globe3D({ className, onLocationClick }: GlobeProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      // O iframe sandboxed tem origem opaca ("null"); validamos pela janela do iframe.
      if (ev.source !== frameRef.current?.contentWindow) return;
      if (!isLocationMessage(ev.data)) return;
      const loc = findLocation(ev.data.lon, ev.data.lat);
      if (!loc) return;
      onLocationClick?.({ ...loc, players: ev.data.players });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onLocationClick]);

  return (
    <div className={cn('w-full flex justify-center', className)}>
      <div className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden">
        {/* Globo SVG autocontido; sandbox="allow-scripts" mantém os listeners
            (pointer/keydown) isolados dentro do iframe — nunca no app. */}
        <iframe
          ref={frameRef}
          src="/globe.svg"
          title="Globo interativo com jogadores online"
          scrolling="no"
          frameBorder="0"
          sandbox="allow-scripts"
          className="block w-full h-full border-0"
        />
      </div>
    </div>
  );
}
