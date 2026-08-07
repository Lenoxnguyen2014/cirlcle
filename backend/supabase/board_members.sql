-- Run manually in the Supabase SQL editor.
--
-- board_members exists ONLY to give Realtime Authorization a concrete
-- membership check for "presence-<boardId>" topics — it is NOT wired into
-- REST API authorization. Boards/cards/locations stay open to any
-- authenticated user via their existing RLS policies, unchanged. role is
-- pure data for now (creator = admin, everyone else who opens the board
-- link = member) — nothing in the app currently branches on it.

create table board_members (
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

alter table board_members enable row level security;

-- A user can only see/insert their OWN membership row — not enough to
-- enumerate a board's full member list, but enough for the Realtime
-- Authorization subquery below to resolve auth.uid()'s own membership.
create policy "authenticated read own membership" on board_members
  for select to authenticated
  using (user_id = auth.uid());

create policy "authenticated insert own membership" on board_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- Replaces the earlier blanket "any authenticated user" Realtime policies
-- with a real membership check.
drop policy if exists "authenticated read board presence and broadcast" on realtime.messages;
drop policy if exists "authenticated write board presence and broadcast" on realtime.messages;

create policy "board members read presence and broadcast"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1 from board_members
    where board_members.user_id = auth.uid()
      and 'presence-' || board_members.board_id::text = realtime.topic()
  )
);

create policy "board members write presence and broadcast"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1 from board_members
    where board_members.user_id = auth.uid()
      and 'presence-' || board_members.board_id::text = realtime.topic()
  )
);
