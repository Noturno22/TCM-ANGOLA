import { describe, expect, it } from 'vitest';
import { mapMessageRow, mapRoomRow } from './rooms';

const base = {
  id: 7,
  room_id: 'luanda',
  body: 'Boa sorte!',
  kind: 'user',
  created_at: '2026-10-15T10:00:00.000Z',
};

describe('mapMessageRow', () => {
  it('resolve o autor a partir do mapa de usernames', () => {
    const msg = mapMessageRow(
      { ...base, user_id: 'abc12345-0000' },
      { 'abc12345-0000': 'KwanzaMaster' },
    );
    expect(msg.author).toBe('KwanzaMaster');
    expect(msg.userId).toBe('abc12345-0000');
    expect(msg.kind).toBe('user');
    expect(msg.roomId).toBe('luanda');
    expect(msg.body).toBe('Boa sorte!');
    expect(msg.createdAt).toBe(base.created_at);
  });

  it('usa um prefixo do id quando o username é desconhecido', () => {
    const msg = mapMessageRow({ ...base, user_id: 'deadbeef-1111' }, {});
    expect(msg.author).toBe('Jogador dead');
  });

  it('marca anúncios com autor fixo e kind announcement', () => {
    const msg = mapMessageRow({ ...base, user_id: null, kind: 'announcement' });
    expect(msg.author).toBe('Anúncio');
    expect(msg.kind).toBe('announcement');
    expect(msg.userId).toBeNull();
  });

  it('usa "Anónimo" quando não há utilizador nem anúncio', () => {
    const msg = mapMessageRow({ ...base, user_id: null });
    expect(msg.author).toBe('Anónimo');
    expect(msg.userId).toBeNull();
  });
});

describe('mapRoomRow', () => {
  it('mapeia uma sala internacional', () => {
    const room = mapRoomRow({
      id: 'brasil',
      name: 'Brasil',
      region: 'international',
      capacity: 60,
      stake: 100,
      is_featured: false,
      sort_order: 11,
    });
    expect(room).toEqual({
      id: 'brasil',
      name: 'Brasil',
      region: 'international',
      capacity: 60,
      stake: 100,
      isFeatured: false,
      sortOrder: 11,
    });
  });

  it('assume "national" quando a coluna region não existe (legacy 0005)', () => {
    const room = mapRoomRow({
      id: 'luanda',
      name: 'Luanda',
      capacity: 50,
      stake: 100,
      is_featured: false,
      sort_order: 1,
    });
    expect(room.region).toBe('national');
  });

  it('normaliza valores em falta', () => {
    const room = mapRoomRow({ id: 'x', name: 'X' });
    expect(room.capacity).toBe(0);
    expect(room.stake).toBe(0);
    expect(room.isFeatured).toBe(false);
    expect(room.sortOrder).toBe(0);
    expect(room.region).toBe('national');
  });
});
