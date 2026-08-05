import { MonitorTask } from '../types/MonitorTask.js';
import type { User } from '../types/User.js';

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


const mapRowToUser = (row: any): User =>  {
  if (!row) return null as any;

  return {
    id: row.id,
    firstName: row.first_name,      
    lastName: row.last_name, 
    email: row.email,
    phone: row.phone || undefined,
    travelDocUrl: row.travel_doc_url || undefined,
    travelDocData: row.travel_doc_data || {},
    createdAt: row.created_at,
  };
}

export { mapRowToTask, mapRowToUser };