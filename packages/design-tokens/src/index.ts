/**
 * Tira o Cocó do Meio — Design tokens (design system partilhado)
 *
 * Pacote TypeScript puro, SEM dependências runtime. Todos os valores são
 * `as const` e portáveis (web + React Native + react-native-svg).
 *
 * Fontes de verdade:
 *  - docs/PROMPT_AGENTS.md §8.3 (paleta do mockup, docs/design/mockups.png):
 *    fundo `#050A08`, superfícies `#0B1A14`, esmeralda `#10B25A`,
 *    vermelho `#D7141B`, dourado `#F2B01E`, laranja `#E8830C`
 *  - src/app/globals.css (tema escuro — valores oklch convertidos para hex
 *    com precisão sRGB; opacidades alpha replicam as classes /10 /20 /30…)
 *  - src/components/game/Board.tsx (geometria do tabuleiro: presets
 *    280/360/440, padding de moldura 8, gap 4, célula arredondada 6,
 *    marca-alvo em 3 anéis, peças a ~35% da célula)
 *  - docs/spec/especificacao.md §17 + docs/PROMPT_AGENTS.md (fontes:
 *    display Bebas Neue, corpo Inter — self-hosted)
 */

/* ============================================================
   CORES
   ============================================================ */

export const colors = {
  /* Fundo e superfícies (mockup §8.3 + globals.css dark) */
  bg: '#050A08',
  surface: '#0B1A14',
  surfaceAlt: '#212523',
  card: '#181B1A',
  secondary: '#252A28',

  /* Marca — ação/P1, CTA/P2, acentos (mockup §8.3) */
  emerald: '#10B25A',
  red: '#D7141B',
  gold: '#F2B01E',
  orange: '#E8830C',

  /* Jogadores — aliases da web (--p1 / --p2) */
  p1: '#10B25A',
  p2: '#D7141B',
  p1Soft: 'rgba(16, 178, 90, 0.15)',
  p2Soft: 'rgba(215, 20, 27, 0.15)',
  goldSoft: 'rgba(242, 176, 30, 0.15)',
  orangeSoft: 'rgba(232, 131, 12, 0.15)',

  /* Texto (globals.css dark --foreground / --muted-foreground) */
  text: '#EEEFEC',
  textMuted: '#8E908B',
  textInverse: '#050A08',
  onColor: '#FFFFFF',

  /* Contornos, overlay e estados (globals.css dark --border/--input) */
  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.60)',
  disabled: 'rgba(142, 144, 139, 0.40)',
  disabledText: 'rgba(238, 239, 236, 0.30)',

  /* Semânticos (globals.css --primary/--destructive/--ring, tema escuro) */
  primary: '#10B25A',
  primaryForeground: '#FFFFFF',
  destructive: '#D7141B',
  destructiveForeground: '#FFFFFF',
  ring: '#10B25A',

  /* Alvos do tabuleiro — passos de alpha replicados do Board.tsx web
     (bg-gold/20, bg-gold/30, border-gold/40, bg-p1/10, bg-p1/60,
      bg-p1/5, bg-p2/10, ring-p2/40) */
  boardSelectedCell: 'rgba(242, 176, 30, 0.20)',
  boardWinningCell: 'rgba(242, 176, 30, 0.30)',
  boardLastMoveDash: 'rgba(242, 176, 30, 0.40)',
  boardValidCell: 'rgba(16, 178, 90, 0.10)',
  boardValidDot: 'rgba(16, 178, 90, 0.60)',
  boardLastMoveCell: 'rgba(16, 178, 90, 0.05)',
  boardThreatCell: 'rgba(215, 20, 27, 0.10)',
  boardThreatRing: 'rgba(215, 20, 27, 0.40)',

  /* Utilitários */
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

/* ============================================================
   ESPAÇAMENTO (grelha de 4 dp, escala tailwind)
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
   RAIOS (globals.css --radius: 0.5rem = 8 + generosos 14–20 do mockup)
   ============================================================ */

export const radii = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  card: 14,
  cardLg: 16,
  cardXl: 20,
  pill: 999,
  full: 9999,
} as const;

/* ============================================================
   TIPOGRAFIA (self-hosted: Bebas Neue display, Inter corpo)
   ============================================================ */

export const typography = {
  fontFamily: {
    display: 'Bebas Neue',
    body: 'Inter',
    mono: 'Geist Mono',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /* 0.02em do `.font-display` (globals.css), expresso em px à base 16 */
  letterSpacing: {
    none: 0,
    display: 0.32,
    tight: -0.2,
  },
  lineHeight: {
    tight: 1.1,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const;

/* ============================================================
   SOMBRAS (globals.css: shadow-*-clean, board-frame, gold-frame, glows)
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
  lg: { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0, 0, 0, 0.10)' },
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

/** Casa central com emblema-alvo quando vazia (spec §8.2 / web Board). */
export const targetMark = {
  viewBox: 40,
  outerRadius: 16,
  midRadius: 10,
  innerRadius: 4,
  strokeWidth: 2,
  /** diâmetro da marca em relação à célula (web: w-1/2) */
  cellRatio: 0.5,
  opacity: 0.6,
} as const;

export const boardGeometry = {
  gridSize: 3,
  squareCount: 9,
  centerSquare: 5,
  /** Largura da grelha por preset (web: max-w 280 / 360 / 440) */
  gridSizePresets: { sm: 280, md: 360, lg: 440 },
  /** padding da moldura (web: p-2) */
  framePadding: 8,
  /** espaço entre casas (web: gap-1) */
  gap: 4,
  /** anel dourado da moldura (web: 0 0 0 3px gold) */
  frameRingWidth: 3,
  /** raio da casa (web: rounded-md com --radius 0.5rem) */
  cellRadius: 6,
  /** diâmetro da peça em relação à célula (web: 40dp em ~117dp) */
  pieceDiameterRatio: 0.35,
  /** ponto de destino válido (web: w-3 em ~117dp) */
  validDotDiameterRatio: 0.10,
  /** traço tracejado da origem da última jogada (web: inset-1) */
  lastMoveDashInset: 4,
  /** ampliação da peça selecionada / vencedora (web: scale-110 / 125) */
  selectedPieceScale: 1.1,
  winningPieceScale: 1.25,
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
  targetMark,
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
export type TargetMarkToken = keyof typeof targetMark;
export type Tokens = typeof tokens;
