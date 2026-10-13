'use client';

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

export function Globe3D({ className }: GlobeProps) {
  return (
    <div className={cn('flex flex-col items-center w-full', className)}>
      <div className="text-sm text-muted-foreground p-4">Globe (MapLibre)</div>
    </div>
  );
}
