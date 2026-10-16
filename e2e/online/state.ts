/** Persistência efémera dos ids dos utilizadores criados no globalSetup. */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const STATE_FILE = resolve(process.cwd(), 'test-results', 'e2e-online-users.json');

export interface OnlineState {
  ids: string[];
}

export function writeState(state: OnlineState): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function readState(): OnlineState | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as OnlineState;
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    rmSync(STATE_FILE, { force: true });
  } catch {
    /* ignore */
  }
}
