const fs = require('fs');
const path = require('path');
const dir = __dirname + path.sep;
const outFile = path.resolve(__dirname, '../src/index.ts');
const pt = JSON.parse(fs.readFileSync(dir + 'pt.json', 'utf8'));
const en = JSON.parse(fs.readFileSync(dir + 'en.json', 'utf8'));
const fr = JSON.parse(fs.readFileSync(dir + 'fr.json', 'utf8'));

const LANGS = [
  { id: 'pt', label: 'Português', flag: '🇵🇹' },
  { id: 'pt-AO', label: 'Português (Angola)', flag: '🇦🇴' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'ln', label: 'Lingála', flag: '🇨🇩' },
  { id: 'kmb', label: 'Kimbundu', flag: '🇦🇴' },
  { id: 'umb', label: 'Umbundu', flag: '🇦🇴' },
  { id: 'kg', label: 'Kikongo', flag: '🇦🇴' },
  { id: 'tch', label: 'Tchokwe', flag: '🇦🇴' },
  { id: 'mbu', label: 'Mbunda', flag: '🇦🇴' },
  { id: 'sh', label: 'ChiShona', flag: '🇿🇼' },
  { id: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { id: 'zh', label: '中文', flag: '🇨🇳' },
];

const maps = {};

function load(name) {
  return JSON.parse(fs.readFileSync(dir + name + '.json', 'utf8'));
}

for (const name of ['pt-AO', 'es', 'ln', 'kmb', 'umb', 'kg', 'tch', 'mbu', 'sh', 'sw', 'zh']) {
  const path = dir + 'map-' + name + '.json';
  maps[name] = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
}

function translate(value, map) {
  let out = value;
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = from.length <= 4 ? '\\b' : '';
    out = out.replace(new RegExp(boundary + escaped + boundary, 'gi'), (match) => {
      if (match[0] === match[0].toUpperCase() && match.length > 1) {
        return to.charAt(0).toUpperCase() + to.slice(1);
      }
      return to;
    });
  }
  return out;
}

function buildDict(map) {
  const out = {};
  for (const key of Object.keys(pt)) {
    if (map[key]) { out[key] = map[key]; continue; }
    out[key] = translate(pt[key], map.__phrases__ || {});
  }
  return out;
}

function complete(dict) {
  const out = {};
  for (const key of Object.keys(pt)) out[key] = dict[key] || pt[key];
  return out;
}

const dicts = {
  pt,
  en: complete(en),
  fr: complete(fr),
};
for (const name of Object.keys(maps)) dicts[name] = buildDict(maps[name]);

let out = `/**
 * Dicionários i18n partilhados (web + mobile) — 14 idiomas.
 * Gerado a partir de packages/i18n/scripts/gen.cjs. Não editar à mão.
 */

export const LANGUAGES = ${JSON.stringify(LANGS, null, 2)} as const;

export type Language = (typeof LANGUAGES)[number]['id'];

export const DEFAULT_LANGUAGE: Language = 'pt';

export function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGES.some((l) => l.id === value);
}

const pt = ${JSON.stringify(pt, null, 2)} as const;

export type I18nKey = keyof typeof pt;
export type I18nVars = Record<string, string | number>;
export type Dict = Record<I18nKey, string>;

const DICTS: Record<Language, Dict> = ${JSON.stringify(dicts, null, 2)};

let currentLang: Language = DEFAULT_LANGUAGE;

export function setLanguage(lang: Language): void {
  currentLang = isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}

export function getLanguage(): Language {
  return currentLang;
}

export function t(key: I18nKey | (string & {}), vars?: I18nVars): string {
  const dict = DICTS[currentLang] || pt;
  let str: string = dict[key as I18nKey] || pt[key as I18nKey] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp('\\\\{' + k + '\\\\}', 'g'), String(v));
    }
  }
  return str;
}
`;

fs.writeFileSync(outFile, out, 'utf8');
console.log('generated', Object.keys(dicts).length, 'languages', Object.keys(pt).length, 'keys');
