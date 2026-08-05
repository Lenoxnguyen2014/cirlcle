import type { BoardCard, BoardLocation } from '../types/board';

// Realtime payloads carry raw Supabase rows (snake_case) — map them to the
// same camelCase shape the REST API already returns.
export function mapRowToBoardCard(row: any): BoardCard {
  return {
    id: row.id,
    boardId: row.board_id,
    type: row.type,
    content: row.content ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    linkMeta: row.link_meta ?? undefined,
    positionX: row.position_x,
    positionY: row.position_y,
    extractionStatus: row.extraction_status,
    rawExtractedLocations: row.raw_extracted_locations ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToBoardLocation(row: any): BoardLocation {
  return {
    id: row.id,
    boardId: row.board_id,
    cardId: row.card_id,
    name: row.name,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    geocodeStatus: row.geocode_status,
    createdAt: row.created_at,
  };
}
