// Copia o motor (@tira/engine) para `supabase/functions/_shared/engine.ts`.
//
// As Edge Functions (Deno) não conseguem importar ficheiros fora da sua pasta,
// pelo que o motor é copiado verbatim para `_shared`. O teste
// `src/lib/online/edge-engine.test.ts` garante que as duas cópias não divergem.
//
// Uso: node scripts/sync-edge-engine.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'packages', 'engine', 'src', 'index.ts');
const dst = path.join(root, 'supabase', 'functions', '_shared', 'engine.ts');

const content = await readFile(src, 'utf8');
await mkdir(path.dirname(dst), { recursive: true });
await writeFile(dst, content, 'utf8');

process.stdout.write(`synced engine -> ${path.relative(root, dst)}\n`);
