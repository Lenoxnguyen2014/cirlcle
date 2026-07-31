import { MonitorTask } from '../types/MonitorTask.js';

// Helper to transform Supabase rows (snake_case) to app types (camelCase)
const mapRowToTask = (row: any): MonitorTask => ({
  id: row.id,
  userId: row.user_id,
  origin: row.origin,
  destination: row.destination,
  date: row.date,
  userInstruction: row.user_instruction,
  active: row.active,
  createdAt: row.created_at,
});

export { mapRowToTask };