import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A Edge Function `submit-move` (Deno) importa o motor a partir de
// `supabase/functions/_shared/engine.ts`, que é uma cópia de
// `packages/engine/src/index.ts` (ver `scripts/sync-edge-engine.mjs`).
// Este teste falha se as duas cópias divergirem.

const root = process.cwd();

describe('edge engine copy', () => {
  it('mantém-se sincronizada com packages/engine', () => {
    const source = readFileSync(path.join(root, 'packages', 'engine', 'src', 'index.ts'), 'utf8');
    const edge = readFileSync(
      path.join(root, 'supabase', 'functions', '_shared', 'engine.ts'),
      'utf8',
    );
    expect(edge).toBe(source);
  });
});
