import { describe, expect, it } from 'vitest';
import {
  isToastWorthy,
  mapNotificationRow,
  unreadCount,
  type AppNotification,
} from './notifications';

const row: Record<string, unknown> = {
  id: 'n1',
  user_id: 'u1',
  kind: 'match_win',
  title: 'Vitória!',
  body: 'Ganhaste a Zé em luanda.',
  data: { match_id: 'm1', result: 'win' },
  read: false,
  created_at: '2026-10-15T10:00:00.000Z',
};

describe('mapNotificationRow', () => {
  it('converte a linha para AppNotification', () => {
    const n = mapNotificationRow(row);
    expect(n.id).toBe('n1');
    expect(n.userId).toBe('u1');
    expect(n.kind).toBe('match_win');
    expect(n.title).toBe('Vitória!');
    expect(n.body).toBe('Ganhaste a Zé em luanda.');
    expect(n.data).toEqual({ match_id: 'm1', result: 'win' });
    expect(n.read).toBe(false);
    expect(n.createdAt).toBe('2026-10-15T10:00:00.000Z');
  });

  it('usa valores por omissão em campos em falta', () => {
    const n = mapNotificationRow({ id: 'n2', user_id: 'u2' });
    expect(n.kind).toBe('unknown');
    expect(n.title).toBe('');
    expect(n.body).toBeNull();
    expect(n.data).toEqual({});
    expect(n.read).toBe(false);
  });
});

describe('unreadCount', () => {
  const base: AppNotification = {
    id: 'x',
    userId: 'u1',
    kind: 'welcome',
    title: 't',
    body: null,
    data: {},
    read: false,
    createdAt: '2026-10-15T10:00:00.000Z',
  };

  it('conta apenas as não lidas', () => {
    expect(unreadCount([])).toBe(0);
    expect(
      unreadCount([
        { ...base, id: 'a', read: false },
        { ...base, id: 'b', read: true },
        { ...base, id: 'c', read: false },
      ]),
    ).toBe(2);
  });
});

describe('isToastWorthy', () => {
  it('destaca pedidos de amizade e eventos de torneio', () => {
    expect(isToastWorthy('friend_request')).toBe(true);
    expect(isToastWorthy('friend_accepted')).toBe(true);
    expect(isToastWorthy('tournament_started')).toBe(true);
    expect(isToastWorthy('tournament_champion')).toBe(true);
  });
  it('não faz toast de resultados de partida nem boas-vindas', () => {
    expect(isToastWorthy('match_win')).toBe(false);
    expect(isToastWorthy('match_loss')).toBe(false);
    expect(isToastWorthy('match_draw')).toBe(false);
    expect(isToastWorthy('welcome')).toBe(false);
  });
});
