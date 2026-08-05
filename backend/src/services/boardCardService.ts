import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { extractLocationsFromContent } from './locationExtractionService.js';
import { fetchLinkMetadata } from './linkMetadataService.js';
import { geocodeBatch } from './geocodingService.js';
import { mapRowToBoardCard, mapRowToBoardLocation } from '../utils/mapdb.js';
import type { BoardCard, BoardLocation } from '../types/Board.js';

const PHOTO_BUCKET = 'board-photos';

const uploadCardPhoto = async (cardId: string, imageBuffer: Buffer, mimeType: string): Promise<string | null> => {
  const fileExt = mimeType.split('/')[1] || 'jpg';
  const fileName = `${cardId}/${Date.now()}.${fileExt}`;

  const { error } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .upload(fileName, imageBuffer, { contentType: mimeType });

  if (error) {
    console.error('Error uploading card photo:', error.message);
    return null;
  }

  const { data } = supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

// Runs extraction + geocoding for a card, writing results back to Supabase.
// Every write here is what triggers the Realtime broadcast to subscribed clients.
const runExtractionAndGeocode = async (
  cardId: string,
  boardId: string,
  extractionInput: Parameters<typeof extractLocationsFromContent>[0]
) => {
  await supabaseAdmin.from('board_cards').update({ extraction_status: 'processing' }).eq('id', cardId);

  const { locations } = await extractLocationsFromContent(extractionInput);

  await supabaseAdmin
    .from('board_cards')
    .update({
      raw_extracted_locations: locations,
      extraction_status: 'done',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId);

  if (locations.length === 0) return;

  const { data: insertedLocations, error: insertError } = await supabaseAdmin
    .from('board_locations')
    .insert(
      locations.map((loc) => ({
        board_id: boardId,
        card_id: cardId,
        name: loc.name,
        geocode_status: 'pending',
      }))
    )
    .select();

  if (insertError || !insertedLocations) {
    console.error('Error inserting board_locations:', insertError?.message);
    return;
  }

  const geocoded = await geocodeBatch(locations.map((loc) => loc.name));

  for (const row of insertedLocations) {
    const result = geocoded.get(row.name);
    if (result) {
      await supabaseAdmin
        .from('board_locations')
        .update({
          lat: result.lat,
          lng: result.lng,
          raw_nominatim: result.raw,
          geocode_status: 'done',
        })
        .eq('id', row.id);
    } else {
      await supabaseAdmin.from('board_locations').update({ geocode_status: 'failed' }).eq('id', row.id);
    }
  }
};

const boardCardService = {
  async createTextCard(boardId: string, params: { content: string; positionX: number; positionY: number }) {
    const { data, error } = await supabaseAdmin
      .from('board_cards')
      .insert({
        board_id: boardId,
        type: 'text',
        content: params.content,
        position_x: params.positionX,
        position_y: params.positionY,
      })
      .select()
      .single();

    if (error) throw new Error(`Card Insert Error: ${error.message}`);

    await runExtractionAndGeocode(data.id, boardId, { type: 'text', text: params.content });

    return mapRowToBoardCard(data);
  },

  async createLinkCard(boardId: string, params: { url: string; positionX: number; positionY: number }) {
    const linkMeta = await fetchLinkMetadata(params.url);

    const { data, error } = await supabaseAdmin
      .from('board_cards')
      .insert({
        board_id: boardId,
        type: 'link',
        content: params.url,
        link_meta: linkMeta,
        position_x: params.positionX,
        position_y: params.positionY,
      })
      .select()
      .single();

    if (error) throw new Error(`Card Insert Error: ${error.message}`);

    const extractionText = [linkMeta.title, linkMeta.description, linkMeta.textSnippet, params.url]
      .filter(Boolean)
      .join('\n');

    await runExtractionAndGeocode(data.id, boardId, { type: 'link', text: extractionText });

    return mapRowToBoardCard(data);
  },

  async createPhotoCard(
    boardId: string,
    params: { imageBuffer: Buffer; mimeType: string; positionX: number; positionY: number }
  ) {
    const { data, error } = await supabaseAdmin
      .from('board_cards')
      .insert({
        board_id: boardId,
        type: 'photo',
        position_x: params.positionX,
        position_y: params.positionY,
      })
      .select()
      .single();

    if (error) throw new Error(`Card Insert Error: ${error.message}`);

    const photoUrl = await uploadCardPhoto(data.id, params.imageBuffer, params.mimeType);
    if (photoUrl) {
      await supabaseAdmin.from('board_cards').update({ photo_url: photoUrl }).eq('id', data.id);
    }

    await runExtractionAndGeocode(data.id, boardId, {
      type: 'photo',
      imageBuffer: params.imageBuffer,
      mimeType: params.mimeType,
    });

    const { data: finalRow } = await supabaseAdmin.from('board_cards').select('*').eq('id', data.id).single();
    return mapRowToBoardCard(finalRow);
  },

  async listCards(boardId: string): Promise<BoardCard[]> {
    const { data, error } = await supabaseAdmin
      .from('board_cards')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Card List Error: ${error.message}`);
    return (data || []).map(mapRowToBoardCard);
  },

  async listLocations(boardId: string): Promise<BoardLocation[]> {
    const { data, error } = await supabaseAdmin
      .from('board_locations')
      .select('*')
      .eq('board_id', boardId)
      .not('lat', 'is', null);

    if (error) throw new Error(`Location List Error: ${error.message}`);
    return (data || []).map(mapRowToBoardLocation);
  },

  async updateCardPosition(boardId: string, cardId: string, x: number, y: number) {
    const { error } = await supabaseAdmin
      .from('board_cards')
      .update({ position_x: x, position_y: y, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .eq('board_id', boardId);

    if (error) throw new Error(`Card Update Error: ${error.message}`);
  },

  async deleteCard(boardId: string, cardId: string) {
    const { error } = await supabaseAdmin.from('board_cards').delete().eq('id', cardId).eq('board_id', boardId);
    if (error) throw new Error(`Card Delete Error: ${error.message}`);
  },
};

export { boardCardService };
