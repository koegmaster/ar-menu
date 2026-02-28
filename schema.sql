-- AR Menu — Supabase SQL Schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Restaurants
create table if not exists restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- Dishes
create table if not exists dishes (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  name            text not null,
  description     text,
  price           numeric(10, 2),
  glb_url         text,
  usdz_url        text,
  poster_url      text,
  meshy_task_id   text,
  model_status    text not null default 'pending'
                    check (model_status in ('pending', 'processing', 'succeeded', 'failed')),
  created_at      timestamptz not null default now()
);

-- Dish photos (1-4 per dish, used as Meshy inputs)
create table if not exists dish_photos (
  id          uuid primary key default gen_random_uuid(),
  dish_id     uuid not null references dishes(id) on delete cascade,
  photo_url   text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists dishes_restaurant_id_idx on dishes(restaurant_id);
create index if not exists dish_photos_dish_id_idx on dish_photos(dish_id);

-- Row Level Security
alter table restaurants enable row level security;
alter table dishes enable row level security;
alter table dish_photos enable row level security;

-- Public read access (customer menu pages)
create policy "Public read restaurants"
  on restaurants for select using (true);

create policy "Public read dishes"
  on dishes for select using (true);

create policy "Public read dish_photos"
  on dish_photos for select using (true);

-- Service role has full access (used by API routes with service key)
-- No additional policies needed — service role bypasses RLS by default.

-- Insert a demo restaurant (copy the id into NEXT_PUBLIC_DEMO_RESTAURANT_ID in .env.local)
insert into restaurants (name, slug) values ('Demo Restaurant', 'demo')
  on conflict (slug) do nothing;

-- To get the demo restaurant ID, run:
-- select id from restaurants where slug = 'demo';
