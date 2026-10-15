-- 0008_rooms_international.sql
--
-- Salas nacionais (Angola) e internacionais. Adiciona a coluna `region` ao
-- catálogo e semeia salas internacionais (lusófonas e globais).
--
-- Aplicar via Supabase SQL Editor. Idempotente (on conflict / add column if
-- not exists), pelo que pode correr depois da 0005 sem problemas.

alter table public.rooms
  add column if not exists region text not null default 'national'
    check (region in ('national', 'international'));

-- Salas nacionais já existentes.
update public.rooms set region = 'national'
  where id in ('angola', 'luanda', 'benguela', 'huambo', 'cabinda');

-- 'global' passa a ser a sala internacional gratuita.
update public.rooms set region = 'international' where id = 'global';

-- Salas internacionais.
insert into public.rooms (id, name, region, capacity, stake, is_featured, sort_order) values
  ('portugal',   'Portugal',          'international',  50, 100, false, 10),
  ('brasil',     'Brasil',            'international',  60, 100, false, 11),
  ('mocambique', 'Moçambique',        'international',  40,  50, false, 12),
  ('caboverde',  'Cabo Verde',        'international',  30,  50, false, 13),
  ('africa',     'África Lusófona',   'international',  80,  50, false, 14),
  ('europa',     'Europa',            'international',  80, 100, false, 15),
  ('america',    'América',           'international',  80, 100, false, 16),
  ('mundo',      'Mundo',             'international', 100,   0, false, 17)
on conflict (id) do update set
  name        = excluded.name,
  region      = excluded.region,
  capacity    = excluded.capacity,
  stake       = excluded.stake,
  is_featured = excluded.is_featured,
  sort_order  = excluded.sort_order;
