/**
 * Cosméticos do tabuleiro — catálogos tipados (dados, sem UI).
 *
 * Itens PAGOS custam KZ da carteira (wallet, store de perfil):
 * comprar = spendCoins(price) + ownCosmetic(id); equipar = equipCosmetic(kind, id).
 * Itens gratuitos têm `price: 0` e estão sempre em `ownedCosmetics`.
 *
 * Os FREE_* reproduzem o aspeto atual do jogo:
 * fundo branco #FFFFFF, linha #373435 (largura 7, round cap),
 * peças #00A859 (P1) / #ED3237 (P2).
 *
 * NOTA: este ficheiro NÃO importa nenhum store (evita ciclos de dependência).
 */
import type * as React from 'react';

export type CosmeticId = string;

/** Fundo do tabuleiro — CSS puro (solid/gradiente/padrão), sem assets de imagem. */
export interface BoardBackgroundDef {
  id: CosmeticId;
  name: string;
  /** Preço em KZ (0 = gratuito). */
  price: number;
  css: React.CSSProperties;
}

/** Estilo da linha desenhada no tabuleiro (SVG). */
export interface LineStyleDef {
  id: CosmeticId;
  name: string;
  /** Preço em KZ (0 = gratuito). */
  price: number;
  stroke: string;
  strokeWidth: number;
  strokeLinecap?: string;
  strokeDasharray?: string;
  /** Sombra/glow SVG (ex.: `drop-shadow(0 0 6px #00f0a8)`). */
  glow?: string;
}

/** Estilo das peças P1/P2. */
export interface PieceStyleDef {
  id: CosmeticId;
  name: string;
  /** Preço em KZ (0 = gratuito). */
  price: number;
  p1: React.CSSProperties;
  p2: React.CSSProperties;
}

/** Sombra das peças atual (globals.css .piece-p1/.piece-p2). */
const PIECE_SHADOW =
  'inset 0 -3px 6px rgba(0, 0, 0, 0.28), inset 0 3px 5px rgba(255, 255, 255, 0.3), 0 3px 8px rgba(0, 0, 0, 0.3)';

export const BOARD_BACKGROUNDS: BoardBackgroundDef[] = [
  {
    id: 'bg_white',
    name: 'Branco Clássico',
    price: 0,
    css: { backgroundColor: 'var(--board-surface)' },
  },
  {
    id: 'bg_paper',
    name: 'Papel Suave',
    price: 0,
    css: { backgroundColor: '#FAF7F0' },
  },
  {
    id: 'bg_sunset',
    name: 'Pôr do Sol do Kwanza',
    price: 600,
    css: { background: 'linear-gradient(160deg, #FFF3E0 0%, #FFCC80 55%, #FF8A65 100%)' },
  },
  {
    id: 'bg_night',
    name: 'Luanda à Noite',
    price: 950,
    css: { background: 'linear-gradient(165deg, #10141C 0%, #1B2233 60%, #26324A 100%)' },
  },
  {
    id: 'bg_diamond',
    name: 'Losango Retícula',
    price: 1400,
    css: {
      backgroundColor: '#F4F1E8',
      backgroundImage:
        'linear-gradient(45deg, rgba(0, 0, 0, 0.06) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.06) 75%),' +
        'linear-gradient(45deg, rgba(0, 0, 0, 0.06) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.06) 75%)',
      backgroundSize: '28px 28px',
      backgroundPosition: '0 0, 14px 14px',
    },
  },
];

export const LINE_STYLES: LineStyleDef[] = [
  {
    id: 'line_solid',
    name: 'Sólida Clássica',
    price: 0,
    stroke: 'var(--board-line)',
    strokeWidth: 7,
    strokeLinecap: 'round',
  },
  {
    id: 'line_dashed',
    name: 'Tracejada',
    price: 0,
    stroke: 'var(--board-line)',
    strokeWidth: 7,
    strokeLinecap: 'round',
    strokeDasharray: '14 10',
  },
  {
    id: 'line_neon',
    name: 'Neon',
    price: 700,
    stroke: '#00F0A8',
    strokeWidth: 7,
    strokeLinecap: 'round',
    glow: 'drop-shadow(0 0 6px #00F0A8)',
  },
  {
    id: 'line_gold',
    name: 'Ouro de Angola',
    price: 1100,
    stroke: '#C9A227',
    strokeWidth: 8,
    strokeLinecap: 'round',
    glow: 'drop-shadow(0 0 4px rgba(201, 162, 39, 0.7))',
  },
  {
    id: 'line_dotted',
    name: 'Pontilhada',
    price: 1500,
    stroke: 'var(--board-line)',
    strokeWidth: 7,
    strokeLinecap: 'round',
    strokeDasharray: '0.1 14',
  },
];

export const PIECE_STYLES: PieceStyleDef[] = [
  {
    id: 'piece_classic',
    name: 'Clássico',
    price: 0,
    p1: { backgroundColor: '#00A859', boxShadow: PIECE_SHADOW },
    p2: { backgroundColor: '#ED3237', boxShadow: PIECE_SHADOW },
  },
  {
    id: 'piece_flat',
    name: 'Flat',
    price: 0,
    p1: { backgroundColor: '#00A859', boxShadow: 'none' },
    p2: { backgroundColor: '#ED3237', boxShadow: 'none' },
  },
  {
    id: 'piece_gold',
    name: 'Ouro & Violeta',
    price: 800,
    p1: { backgroundColor: '#F5C542', boxShadow: PIECE_SHADOW },
    p2: { backgroundColor: '#7A5AF8', boxShadow: PIECE_SHADOW },
  },
  {
    id: 'piece_ocean',
    name: 'Oceano & Laranja',
    price: 1200,
    p1: { backgroundColor: '#0EA5E9', boxShadow: PIECE_SHADOW },
    p2: { backgroundColor: '#F97316', boxShadow: PIECE_SHADOW },
  },
  {
    id: 'piece_mono',
    name: 'Monocromático',
    price: 1600,
    p1: { backgroundColor: '#E5E7EB', boxShadow: PIECE_SHADOW },
    p2: { backgroundColor: '#111827', boxShadow: PIECE_SHADOW },
  },
];

/** Id do fundo gratuito por omissão (aspeto atual: branco #FFFFFF). */
export const FREE_BACKGROUND_ID = 'bg_white';
/** Id do estilo de linha gratuito por omissão (aspeto atual: #373435, 7, round). */
export const FREE_LINE_STYLE_ID = 'line_solid';
/** Id do estilo de peça gratuito por omissão (aspeto atual: #00A859 / #ED3237). */
export const FREE_PIECE_STYLE_ID = 'piece_classic';

/** Procura um fundo pelo id; fallback para o gratuito por omissão. */
export function getBackground(id: CosmeticId): BoardBackgroundDef {
  return (
    BOARD_BACKGROUNDS.find((b) => b.id === id) ??
    BOARD_BACKGROUNDS.find((b) => b.id === FREE_BACKGROUND_ID) ??
    BOARD_BACKGROUNDS[0]
  );
}

/** Procura um estilo de linha pelo id; fallback para o gratuito por omissão. */
export function getLineStyle(id: CosmeticId): LineStyleDef {
  return (
    LINE_STYLES.find((l) => l.id === id) ??
    LINE_STYLES.find((l) => l.id === FREE_LINE_STYLE_ID) ??
    LINE_STYLES[0]
  );
}

/** Procura um estilo de peça pelo id; fallback para o gratuito por omissão. */
export function getPieceStyle(id: CosmeticId): PieceStyleDef {
  return (
    PIECE_STYLES.find((p) => p.id === id) ??
    PIECE_STYLES.find((p) => p.id === FREE_PIECE_STYLE_ID) ??
    PIECE_STYLES[0]
  );
}
