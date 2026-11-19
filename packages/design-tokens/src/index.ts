/**
 * Tira o Cocó do Meio — Design tokens (design system partilhado)
 *
 * Pacote TypeScript puro, SEM dependências runtime. Todos os valores são
 * `as const` e portáveis (web + React Native + react-native-svg).
 *
 * FONTE DE VERDADE = a implementação web:
 *  - src/app/globals.css (paleta oklch dark; convertida para hex sRGB com as
 *    mesmas fórmulas OKLab usadas em apps/mobile/src/theme/tokens.ts)
 *  - html { font-size: 18px } (globals.css:175) → todos os raios/tamanhos
 *    `rem` da web são resolvidos à base 18px (ex.: --radius 0.75rem = 13.5px)
 *  - src/components/game/Board.tsx (geometria e estados do tabuleiro:
 *    viewBox 300, linhas 50→250 stroke 7, peças 40dp, sem moldura/padding)
 *  - src/components/game/ui.tsx + src/components/ui/* (raios e textos)
 *  - Fontes: Inter (corpo) + Bebas Neue (display), self-hosted
 */

/* ============================================================
   CONVERSÃO oklch → hex (fórmulas oficiais OKLab, D65, gamut clamp)
   ============================================================ */

function oklchToRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const lr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gm = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const gamut = (x: number) =>
    x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  const to255 = (x: number) => Math.round(Math.min(1, Math.max(0, gamut(x))) * 255);

  return [to255(lr), to255(gm), to255(bl)];
}

/** oklch(L C H) → "#RRGGBB" (mesmo arredondamento do tema NativeWind). */
function ok(l: number, c: number, h: number): string {
  const [r, g, b] = oklchToRgb(l, c, h);
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/** rgba de uma cor oklch com alfa (ex.: gold / 0.14 → bg-gold/[0.14]). */
function okA(l: number, c: number, h: number, a: number): string {
  const [r, g, b] = oklchToRgb(l, c, h);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ============================================================
   CORES — tema escuro (:root do globals.css, o default da web)
   ============================================================ */

export const colors = {
  /* Fundo e superfícies (--background / --surface / --surface-2 / --card) */
  bg: ok(0.15, 0.012, 160),
  surface: ok(0.195, 0.013, 160),
  surfaceAlt: ok(0.245, 0.015, 160),
  secondary: ok(0.245, 0.015, 160),
  card: ok(0.2, 0.013, 160),
  popover: ok(0.21, 0.013, 160),

  /* Tabuleiro (--board-surface / --board-line) */
  boardSurface: ok(0.21, 0.014, 160),
  boardLine: ok(0.6, 0.012, 160),

  /* Marca — gold é o único acento (--gold) */
  gold: ok(0.83, 0.14, 85),
  goldSoft: okA(0.83, 0.14, 85, 0.14),

  /* Peças do jogo — semânticas (--p1 / --p2 / --orange) */
  p1: ok(0.72, 0.16, 155),
  p1Soft: okA(0.72, 0.16, 155, 0.16),
  p2: ok(0.66, 0.2, 27),
  p2Soft: okA(0.66, 0.2, 27, 0.16),
  orange: ok(0.76, 0.15, 60),
  orangeSoft: okA(0.76, 0.15, 60, 0.14),

  /* Texto (--foreground / --muted-foreground / --primary-foreground) */
  text: ok(0.97, 0.006, 160),
  textMuted: ok(0.71, 0.012, 160),
  textInverse: ok(0.18, 0.03, 80),
  onColor: '#FFFFFF',

  /* Semânticos (--primary = gold; --primary-foreground escuro sobre gold) */
  primary: ok(0.83, 0.14, 85),
  primaryForeground: ok(0.18, 0.03, 80),
  destructive: ok(0.66, 0.2, 27),
  destructiveForeground: '#FFFFFF',
  ring: ok(0.83, 0.14, 85),

  /* Contornos (--border / --input) */
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(255, 255, 255, 0.1)',
  input: 'rgba(255, 255, 255, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  disabled: 'rgba(155, 164, 159, 0.4)',
  disabledText: 'rgba(242, 246, 244, 0.3)',

  /* Estados do tabuleiro — classes do Board.tsx web
     (bg-gold/[0.14] selecionada, bg-gold/[0.16] vitória, bg-p2/[0.08]
      ameaça, border-[#373435]/30 origem tracejada, bg-p1 alvo) */
  boardSelectedCell: okA(0.83, 0.14, 85, 0.14),
  boardWinningCell: okA(0.83, 0.14, 85, 0.16),
  boardThreatCell: okA(0.66, 0.2, 27, 0.08),
  boardLastMoveDash: 'rgba(55, 52, 53, 0.3)',
  boardValidDot: ok(0.72, 0.16, 155),

  /* Utilitários */
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

/* ============================================================
   ESPAÇAMENTO (grelha de 4 dp, escala tailwind — px, não escala com rem)
   ============================================================ */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/* ============================================================
   RAIOS — resolução web à base 18px (globals.css:
   --radius: 0.75rem = 13.5px; --radius-sm/md/lg/xl/2xl = calc(...))
   ============================================================ */

export const radii = {
  none: 0,
  sm: 9.5,
  md: 11.5,
  lg: 13.5,
  xl: 17.5,
  card: 17.5,
  cardLg: 23.5,
  cardXl: 27.5,
  pill: 999,
  full: 9999,
} as const;

/* ============================================================
   TIPOGRAFIA (Inter corpo, Bebas Neue display — self-hosted)
   fontSize = utilitários text-* da web resolvidos à base 18px
   (text-xs 0.75rem → 13.5, text-sm 0.875rem → 15.75, text-base 1rem → 18…)
   ============================================================ */

export const typography = {
  fontFamily: {
    display: 'Bebas Neue',
    body: 'Inter',
    mono: 'Geist Mono',
  },
  fontSize: {
    xs: 13.5,
    sm: 15.75,
    base: 18,
    lg: 20.25,
    xl: 22.5,
    '2xl': 27,
    '3xl': 33.75,
    '4xl': 40.5,
    '5xl': 54,
    '6xl': 72,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /* tracking da web: .font-display letter-spacing 0.02em; tracking-tight
     -0.025em — expressos em px (RN não aceita em) para o tamanho médio */
  letterSpacing: {
    none: 0,
    display: 0.6,
    tight: -0.4,
  },
  lineHeight: {
    tight: 1.1,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const;

/* ============================================================
   SOMBRAS (números; a web usa classes shadow-*-clean do globals.css)
   ============================================================ */

export interface ShadowValue {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
  readonly color: string;
}

export const shadows = {
  sm: { offsetX: 0, offsetY: 1, blur: 2, color: 'rgba(0, 0, 0, 0.06)' },
  md: { offsetX: 0, offsetY: 2, blur: 4, color: 'rgba(0, 0, 0, 0.08)' },
  lg: { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0, 0, 0, 0.1)' },
  boardFrame: { offsetX: 0, offsetY: 8, blur: 24, color: 'rgba(0, 0, 0, 0.12)' },
  glowGold: { offsetX: 0, offsetY: 0, blur: 12, color: 'rgba(242, 176, 30, 0.35)' },
  glowP1: { offsetX: 0, offsetY: 0, blur: 12, color: 'rgba(16, 178, 90, 0.35)' },
  glowP2: { offsetX: 0, offsetY: 0, blur: 12, color: 'rgba(215, 20, 27, 0.35)' },
} as const satisfies Record<string, ShadowValue>;

/* ============================================================
   GEOMETRIA DO TABULEIRO (src/components/game/Board.tsx)
   ============================================================ */

/**
 * Casa 1–9 → posição no grelho 3×3. Mesmo mapeamento de SQUARE_COORDS
 * do motor (packages/engine): índice do board = casa - 1, linha = índice / 3.
 * NOTA: o Board web apresenta as casas rotacionadas 180° por omissão
 * (casa 1 em baixo à direita) via `SQUARE_POS[10 - sq]`.
 */
export const squarePosition = {
  1: { row: 0, col: 0 },
  2: { row: 0, col: 1 },
  3: { row: 0, col: 2 },
  4: { row: 1, col: 0 },
  5: { row: 1, col: 1 },
  6: { row: 1, col: 2 },
  7: { row: 2, col: 0 },
  8: { row: 2, col: 1 },
  9: { row: 2, col: 2 },
} as const;

export const boardGeometry = {
  gridSize: 3,
  squareCount: 9,
  centerSquare: 5,
  /** Largura total do tabuleiro por preset (web: max-w 280 / 360 / 440) */
  gridSizePresets: { sm: 280, md: 360, lg: 440 },
  /** Sem moldura nem gaps — o web desenha as linhas por cima da grelha */
  framePadding: 0,
  gap: 0,
  /** Espessura do anel dourado (web não usa moldura) */
  frameRingWidth: 0,
  /** Raio das casas (web: células quadradas, sem bg) */
  cellRadius: 0,
  /** viewBox do SVG web: linhas de 50 a 250, stroke 7 */
  viewBox: 300,
  lineInset: 50,
  strokeWidth: 7,
  /** Raio do contêiner (web: rounded-2xl = --radius + 10px = 23.5px) */
  containerRadius: 23.5,
  /** Sombra do contêiner (web Board.tsx boxShadow) */
  containerShadow: '0 20px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.08)',
  /** Diâmetro da peça por preset (web: w-8 / w-10 / w-12) */
  pieceDiameterPresets: { sm: 32, md: 40, lg: 48 },
  /** Símbolo gravado por preset (web: w-3.5 / w-5 / w-6) */
  symbolSizePresets: { sm: 14, md: 20, lg: 24 },
  /** Ponto de destino válido fixo (web: w-3.5 = 14px) */
  validDotSize: 14,
  /** Anel do selecionado (web: ring-2 = 2px) */
  ringStroke: 2,
  /** Tracejado da origem da última jogada (web: border = 1px) */
  markerStroke: 1,
  /** inset-[30%] → raio = (1 - 0.6) / 2 = 0.2 da casa */
  markerInset: 0.3,
  /** inset-[12%] do brilho da vitória → raio = 0.38 da casa */
  winGlowInset: 0.12,
  /** Ampliação da peça (web: scale-110 selecionada/vencedora, scale-105 última jogada) */
  selectedPieceScale: 1.1,
  winningPieceScale: 1.1,
  lastMovedPieceScale: 1.05,
} as const;

/* ============================================================
   AGREGADO E TIPOS
   ============================================================ */

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  boardGeometry,
  squarePosition,
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type TypographyToken = keyof typeof typography;
export type FontFamilyToken = keyof typeof typography.fontFamily;
export type FontSizeToken = keyof typeof typography.fontSize;
export type FontWeightToken = keyof typeof typography.fontWeight;
export type LetterSpacingToken = keyof typeof typography.letterSpacing;
export type LineHeightToken = keyof typeof typography.lineHeight;
export type ShadowToken = keyof typeof shadows;
export type BoardGeometryToken = keyof typeof boardGeometry;
export type SquarePositionToken = keyof typeof squarePosition;
export type Tokens = typeof tokens;
