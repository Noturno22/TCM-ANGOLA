import { describe, expect, it } from 'vitest';
import {
  mapFriendshipRow,
  parseFriendErrorCode,
  toFriend,
  toFriendRequest,
} from './friends';

const ME = 'me-0000';
const OTHER = 'other-1111';

const baseRow = {
  id: 'f-1',
  requester_id: ME,
  addressee_id: OTHER,
  status: 'pending',
  created_at: '2026-10-15T10:00:00.000Z',
  updated_at: '2026-10-15T11:00:00.000Z',
};

describe('mapFriendshipRow', () => {
  it('orienta um pedido enviado por mim como outgoing', () => {
    const f = mapFriendshipRow(baseRow, ME);
    expect(f.otherId).toBe(OTHER);
    expect(f.direction).toBe('outgoing');
    expect(f.requesterId).toBe(ME);
    expect(f.addresseeId).toBe(OTHER);
    expect(f.status).toBe('pending');
  });

  it('orienta um pedido recebido como incoming', () => {
    const f = mapFriendshipRow({ ...baseRow, requester_id: OTHER, addressee_id: ME }, ME);
    expect(f.otherId).toBe(OTHER);
    expect(f.direction).toBe('incoming');
  });

  it('assume pending e reutiliza created_at quando updated_at falta', () => {
    const f = mapFriendshipRow(
      { ...baseRow, status: undefined, updated_at: undefined },
      ME,
    );
    expect(f.status).toBe('pending');
    expect(f.updatedAt).toBe(baseRow.created_at);
  });
});

describe('toFriend', () => {
  it('junta a amizade ao perfil público', () => {
    const f = mapFriendshipRow(
      { ...baseRow, status: 'accepted', updated_at: '2026-10-15T12:00:00.000Z' },
      ME,
    );
    const friend = toFriend(f, {
      userId: OTHER,
      username: 'KwanzaMaster',
      avatar: '🐯',
      level: 7,
      elo: 1180,
    });
    expect(friend.friendshipId).toBe('f-1');
    expect(friend.userId).toBe(OTHER);
    expect(friend.username).toBe('KwanzaMaster');
    expect(friend.avatar).toBe('🐯');
    expect(friend.level).toBe(7);
    expect(friend.elo).toBe(1180);
    expect(friend.since).toBe('2026-10-15T12:00:00.000Z');
  });

  it('usa valores por omissão quando o perfil falta', () => {
    const f = mapFriendshipRow(baseRow, ME);
    const friend = toFriend(f, undefined);
    expect(friend.username).toBeNull();
    expect(friend.avatar).toBe('🦁');
    expect(friend.level).toBe(1);
    expect(friend.elo).toBe(1000);
  });
});

describe('toFriendRequest', () => {
  it('preserva a direção e os dados públicos', () => {
    const f = mapFriendshipRow(
      { ...baseRow, requester_id: OTHER, addressee_id: ME },
      ME,
    );
    const req = toFriendRequest(f, {
      userId: OTHER,
      username: 'Timbaleiro',
      avatar: '🦁',
      level: 3,
      elo: 1040,
    });
    expect(req.friendshipId).toBe('f-1');
    expect(req.direction).toBe('incoming');
    expect(req.username).toBe('Timbaleiro');
    expect(req.createdAt).toBe(baseRow.created_at);
  });
});

describe('parseFriendErrorCode', () => {
  it('reconhece códigos conhecidos', () => {
    expect(parseFriendErrorCode('unknown_user')).toBe('unknown_user');
    expect(parseFriendErrorCode('ERROR: cannot_add_self')).toBe('cannot_add_self');
    expect(parseFriendErrorCode('not_authenticated')).toBe('not_authenticated');
  });

  it('devolve null para desconhecido ou vazio', () => {
    expect(parseFriendErrorCode('boom')).toBeNull();
    expect(parseFriendErrorCode(null)).toBeNull();
    expect(parseFriendErrorCode('')).toBeNull();
  });
});
