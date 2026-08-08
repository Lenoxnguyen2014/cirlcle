-- Run manually in the Supabase SQL editor.
--
-- Lets any card (text/link/photo — pinned on the map or not) be assigned a
-- specific day for the Map page's day-by-day itinerary list. No time
-- component — this is a day, not a timestamp. No publication/replica-identity
-- changes needed: board_cards is already fully wired for Realtime.

alter table board_cards add column visit_date date;
