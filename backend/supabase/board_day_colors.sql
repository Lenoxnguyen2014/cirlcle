-- Run manually in the Supabase SQL editor.
--
-- One color per day, looked up by (board_id, visit_date) — not a foreign key
-- from board_cards.visit_date, since that would require a day row to exist
-- before a card could be assigned to that date, breaking the existing flow
-- (dragging a card onto a brand-new date just sets a raw date value, see
-- board_cards_visit_date.sql). Every card/pin on a given day shares this
-- color automatically since they're all looked up the same way.

create table board_day_colors (
  board_id uuid not null references boards(id) on delete cascade,
  visit_date date not null,
  color text not null,
  primary key (board_id, visit_date)
);

alter table board_day_colors enable row level security;
alter table board_day_colors replica identity full;

create policy "authenticated read board_day_colors" on board_day_colors
  for select to authenticated using (auth.role() = 'authenticated');
create policy "authenticated insert board_day_colors" on board_day_colors
  for insert to authenticated with check (auth.role() = 'authenticated');
create policy "authenticated update board_day_colors" on board_day_colors
  for update to authenticated using (auth.role() = 'authenticated');

alter publication supabase_realtime add table board_day_colors;
