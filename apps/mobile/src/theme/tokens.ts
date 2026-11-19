/**
 * Tokens do tema — FONTE ÚNICA de cores/tema para TODAS as plataformas.
 *
 * Espelhado de src/app/globals.css (site). O oklch() foi convertido para rgb
 * porque o React Native (style engine) não entende oklch — o web recebe os
 * mesmos valores convertidos, garantindo paridade visual sem divergência.
 *
 * Usado por:
 *  - tailwind.config.ts → define as classes (bg-background, text-gold, ...)
 *  - ThemeProvider       → aplica as CSS vars no runtime via vars() do NativeWind
 */

type RawTheme = Record<string, string>;

/** Valores do :root do site (= tema escuro, o default). */
const DARK_RAW: RawTheme = {
  radius: '0.75rem',
  background: 'oklch(0.15 0.012 160)',
  foreground: 'oklch(0.97 0.006 160)',
  surface: 'oklch(0.195 0.013 160)',
  'surface-2': 'oklch(0.245 0.015 160)',
  'board-surface': 'oklch(0.21 0.014 160)',
  'board-line': 'oklch(0.6 0.012 160)',
  card: 'oklch(0.2 0.013 160)',
  'card-foreground': 'oklch(0.97 0.006 160)',
  popover: 'oklch(0.21 0.013 160)',
  'popover-foreground': 'oklch(0.97 0.006 160)',
  gold: 'oklch(0.83 0.14 85)',
  'gold-soft': 'oklch(0.83 0.14 85 / 0.14)',
  p1: 'oklch(0.72 0.16 155)',
  'p1-soft': 'oklch(0.72 0.16 155 / 0.16)',
  p2: 'oklch(0.66 0.2 27)',
  'p2-soft': 'oklch(0.66 0.2 27 / 0.16)',
  orange: 'oklch(0.76 0.15 60)',
  'orange-soft': 'oklch(0.76 0.15 60 / 0.14)',
  primary: 'var(--gold)',
  'primary-foreground': 'oklch(0.18 0.03 80)',
  secondary: 'var(--surface-2)',
  'secondary-foreground': 'var(--foreground)',
  muted: 'var(--surface-2)',
  'muted-foreground': 'oklch(0.71 0.012 160)',
  accent: 'var(--surface-2)',
  'accent-foreground': 'var(--foreground)',
  destructive: 'var(--p2)',
  border: 'oklch(1 0 0 / 0.09)',
  input: 'oklch(1 0 0 / 0.1)',
  ring: 'var(--gold)',
  'chart-1': 'oklch(0.83 0.14 85)',
  'chart-2': 'oklch(0.72 0.16 155)',
  'chart-3': 'oklch(0.66 0.2 27)',
  'chart-4': 'oklch(0.76 0.15 60)',
  'chart-5': 'oklch(0.7 0.1 250)',
  sidebar: 'oklch(0.18 0.012 160)',
  'sidebar-foreground': 'oklch(0.97 0.006 160)',
  'sidebar-primary': 'var(--gold)',
  'sidebar-primary-foreground': 'oklch(0.18 0.03 80)',
  'sidebar-accent': 'var(--surface-2)',
  'sidebar-accent-foreground': 'oklch(0.97 0.006 160)',
  'sidebar-border': 'oklch(1 0 0 / 0.09)',
  'sidebar-ring': 'var(--gold)',
};

/** Overrides da classe .light do site. O que não está aqui herda do dark
 *  (ex.: charts não têm override no site). */
const LIGHT_RAW: RawTheme = {
  background: 'oklch(0.985 0.004 160)',
  foreground: 'oklch(0.21 0.02 160)',
  surface: 'oklch(0.955 0.006 160)',
  'surface-2': 'oklch(0.915 0.008 160)',
  'board-surface': '#ffffff',
  'board-line': '#373435',
  card: 'oklch(1 0 0)',
  'card-foreground': 'oklch(0.21 0.02 160)',
  popover: 'oklch(1 0 0)',
  'popover-foreground': 'oklch(0.21 0.02 160)',
  gold: 'oklch(0.46 0.096 78)',
  'gold-soft': 'oklch(0.46 0.096 78 / 0.14)',
  p1: 'oklch(0.44 0.109 155)',
  'p1-soft': 'oklch(0.44 0.109 155 / 0.16)',
  p2: 'oklch(0.46 0.188 27)',
  'p2-soft': 'oklch(0.46 0.188 27 / 0.16)',
  orange: 'oklch(0.46 0.108 60)',
  'orange-soft': 'oklch(0.46 0.108 60 / 0.14)',
  primary: 'var(--gold)',
  'primary-foreground': 'oklch(0.99 0 0)',
  secondary: 'var(--surface-2)',
  'secondary-foreground': 'var(--foreground)',
  muted: 'var(--surface-2)',
  'muted-foreground': 'oklch(0.46 0.02 160)',
  accent: 'var(--surface-2)',
  'accent-foreground': 'var(--foreground)',
  destructive: 'var(--p2)',
  border: 'oklch(0.2 0.02 160 / 0.14)',
  input: 'oklch(0.2 0.02 160 / 0.16)',
  ring: 'var(--gold)',
  sidebar: 'oklch(0.97 0.005 160)',
  'sidebar-foreground': 'oklch(0.21 0.02 160)',
  'sidebar-primary': 'var(--gold)',
  'sidebar-primary-foreground': 'oklch(0.99 0 0)',
  'sidebar-accent': 'var(--surface-2)',
  'sidebar-accent-foreground': 'oklch(0.21 0.02 160)',
  'sidebar-border': 'oklch(0.2 0.02 160 / 0.14)',
  'sidebar-ring': 'var(--gold)',
};

/** Tokens com alfa fixo (o alfa fica embutido na var; não admitem /50). */
const ALPHA_FIXED = new Set([
  'border',
  'input',
  'gold-soft',
  'p1-soft',
  'p2-soft',
  'orange-soft',
]);

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/;

/** oklch(L C H) → sRGB 0-255 (fórmulas oficiais OKLab, D65, com gamut clamp). */
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

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Converte um valor de cor para o formato usado nas CSS vars:
 *  - keepAlpha=false → triplet "R G B" (para rgb(var(--x) / <alpha-value>))
 *  - keepAlpha=true  → "rgb(R G B)" ou "rgb(R G B / a)" (alfa embutido)
 * Valores não-convertíveis (ex.: 0.75rem) passam inalterados.
 */
function convert(value: string, keepAlpha: boolean): string {
  const m = OKLCH_RE.exec(value);
  if (m) {
    const [r, g, b] = oklchToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    const a = m[4];
    if (keepAlpha) return a != null ? `rgb(${r} ${g} ${b} / ${a})` : `rgb(${r} ${g} ${b})`;
    return `${r} ${g} ${b}`;
  }
  if (value.startsWith('#')) {
    const [r, g, b] = hexToRgb(value);
    if (keepAlpha) return `rgb(${r} ${g} ${b})`;
    return `${r} ${g} ${b}`;
  }
  return value;
}

/** Resolve referências var(--x) dentro do mapa (após merge light/dark). */
function resolveVars(map: RawTheme): RawTheme {
  const out: RawTheme = {};
  for (const [k, v] of Object.entries(map)) {
    let val = v;
    for (let i = 0; i < 5 && val.includes('var(--'); i++) {
      val = val.replace(/var\(--([a-z0-9-]+)\)/gi, (_, name) => map[name] ?? val);
    }
    out[k] = val;
  }
  return out;
}

function buildTheme(overrides: RawTheme): Record<string, string> {
  const merged = resolveVars({ ...DARK_RAW, ...overrides });
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) {
    out[`--${k}`] = convert(v, ALPHA_FIXED.has(k));
  }
  return out;
}

/** CSS vars do tema escuro (default do site) para vars() do NativeWind. */
export const darkVars: Record<string, string> = buildTheme({});

/** CSS vars do tema claro (classe .light do site). */
export const lightVars: Record<string, string> = buildTheme(LIGHT_RAW);

/** Cores para o tailwind.config — mesmos nomes de classe do site. */
const t = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
const v = (n: string) => `var(--${n})`;

export const twColors = {
  background: t('background'),
  foreground: t('foreground'),
  card: { DEFAULT: t('card'), foreground: t('card-foreground') },
  popover: { DEFAULT: t('popover'), foreground: t('popover-foreground') },
  primary: { DEFAULT: t('primary'), foreground: t('primary-foreground') },
  secondary: { DEFAULT: t('secondary'), foreground: t('secondary-foreground') },
  muted: { DEFAULT: t('muted'), foreground: t('muted-foreground') },
  accent: { DEFAULT: t('accent'), foreground: t('accent-foreground') },
  destructive: t('destructive'),
  border: v('border'),
  input: v('input'),
  ring: t('ring'),
  chart: {
    1: t('chart-1'),
    2: t('chart-2'),
    3: t('chart-3'),
    4: t('chart-4'),
    5: t('chart-5'),
  },
  sidebar: {
    DEFAULT: t('sidebar'),
    foreground: t('sidebar-foreground'),
    primary: t('sidebar-primary'),
    'primary-foreground': t('sidebar-primary-foreground'),
    accent: t('sidebar-accent'),
    'accent-foreground': t('sidebar-accent-foreground'),
    border: v('sidebar-border'),
    ring: t('sidebar-ring'),
  },
  gold: t('gold'),
  'gold-soft': v('gold-soft'),
  p1: t('p1'),
  'p1-soft': v('p1-soft'),
  p2: t('p2'),
  'p2-soft': v('p2-soft'),
  orange: t('orange'),
  'orange-soft': v('orange-soft'),
  surface: t('surface'),
  'surface-2': t('surface-2'),
  'board-surface': t('board-surface'),
  'board-line': t('board-line'),
};
