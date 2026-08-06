import { MonitorTask } from '../types/MonitorTask.js';
import type { User } from '../types/User.js';
import type { Board, BoardCard, BoardLocation } from '../types/Board.js';

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

const mapRowToBoard = (row: any): Board => ({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const mapRowToBoardCard = (row: any): BoardCard => ({
  id: row.id,
  boardId: row.board_id,
  createdBy: row.created_by || undefined,
  type: row.type,
  content: row.content || undefined,
  photoUrl: row.photo_url || undefined,
  linkMeta: row.link_meta || undefined,
  positionX: row.position_x,
  positionY: row.position_y,
  extractionStatus: row.extraction_status,
  rawExtractedLocations: row.raw_extracted_locations || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRowToBoardLocation = (row: any): BoardLocation => ({
  id: row.id,
  boardId: row.board_id,
  cardId: row.card_id,
  name: row.name,
  lat: row.lat ?? undefined,
  lng: row.lng ?? undefined,
  geocodeStatus: row.geocode_status,
  createdAt: row.created_at,
});

export { mapRowToTask, mapRowToUser, mapRowToBoard, mapRowToBoardCard, mapRowToBoardLocation };