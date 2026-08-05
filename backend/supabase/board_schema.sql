-- Run manually in the Supabase SQL editor (no migrations tooling in this repo).
-- Sets up tables, Realtime, RLS, and storage for the collaborative board feature.

create table boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table board_cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  type text not null check (type in ('text','link','photo')),
  content text,
  photo_url text,
  link_meta jsonb,
  position_x float not null default 0,
  position_y float not null default 0,
  extraction_status text not null default 'pending' check (extraction_status in ('pending','processing','done','failed')),
  raw_extracted_locations jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table board_locations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade, -- denormalized for Realtime filtering
  card_id uuid not null references board_cards(id) on delete cascade,
  name text not null,
  lat double precision,
  lng double precision,
  geocode_status text not null default 'pending' check (geocode_status in ('pending','done','failed')),
  raw_nominatim jsonb,
  created_at timestamptz not null default now()
);

-- Realtime: broadcast row changes to subscribed clients
alter publication supabase_realtime add table board_cards, board_locations;

-- RLS: reads require a logged-in user; all writes come from the backend's
-- service-role client, which bypasses RLS entirely, so no write policies exist.
alter table boards enable row level security;
alter table board_cards enable row level security;
alter table board_locations enable row level security;

create policy "authenticated read boards" on boards for select using (auth.role() = 'authenticated');
create policy "authenticated read board_cards" on board_cards for select using (auth.role() = 'authenticated');
create policy "authenticated read board_locations" on board_locations for select using (auth.role() = 'authenticated');

-- Storage: run via the Supabase dashboard (Storage > New bucket) or the API,
-- since bucket creation isn't SQL. Create a public bucket named `board-photos`,
-- mirroring the existing `travel-docs` bucket used for passport photos.
