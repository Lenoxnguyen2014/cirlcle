import type { SupabaseClient } from '@supabase/supabase-js';
import { extractLocationsFromContent } from './locationExtractionService.js';
import { fetchLinkMetadata } from './linkMetadataService.js';
import { geocodeBatch } from './geocodingService.js';
import { mapRowToBoardCard, mapRowToBoardLocation } from '../utils/mapdb.js';
import type { BoardCard, BoardLocation } from '../types/Board.js';

const PHOTO_BUCKET = 'board-photos';

const uploadCardPhoto = async (
  client: SupabaseClient,
  cardId: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string | null> => {
  const fileExt = mimeType.split('/')[1] || 'jpg';
  const fileName = `${cardId}/${Date.now()}.${fileExt}`;

  const { error } = await client.storage.from(PHOTO_BUCKET).upload(fileName, imageBuffer, { contentType: mimeType });

  if (error) {
    console.error('Error uploading card photo:', error.message);
    return null;
  }

  const { data } = client.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

// Inserts board_locations rows for already-known location names and geocodes
// them. Split out from runExtractionAndGeocode so restoreCard (undo) can
// reuse it directly with a deleted card's cached locations, skipping the AI
// call entirely — we already know the names, no need to re-derive them.
const geocodeAndStoreLocations = async (
  client: SupabaseClient,
  cardId: string,
  boardId: string,
  locations: { name: string; confidence?: number }[]
) => {
  if (locations.length === 0) return;

  const { data: insertedLocations, error: insertError } = await client
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
      await client
        .from('board_locations')
        .update({
          lat: result.lat,
          lng: result.lng,
          raw_nominatim: result.raw,
          geocode_status: 'done',
        })
        .eq('id', row.id);
    } else {
      await client.from('board_locations').update({ geocode_status: 'failed' }).eq('id', row.id);
    }
  }
};

// Runs extraction + geocoding for a card, writing results back to Supabase.
// Every write here is what triggers the Realtime broadcast to subscribed clients.
const runExtractionAndGeocode = async (
  client: SupabaseClient,
  cardId: string,
  boardId: string,
  extractionInput: Parameters<typeof extractLocationsFromContent>[0]
) => {
  await client.from('board_cards').update({ extraction_status: 'processing' }).eq('id', cardId);

  const { locations } = await extractLocationsFromContent(extractionInput);

  await client
    .from('board_cards')
    .update({
      raw_extracted_locations: locations,
      extraction_status: 'done',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId);

  await geocodeAndStoreLocations(client, cardId, boardId, locations);
};

const boardCardService = {
  async createTextCard(
    client: SupabaseClient,
    boardId: string,
    createdBy: string,
    params: { content: string; positionX: number; positionY: number }
  ) {
    const { data, error } = await client
      .from('board_cards')
      .insert({
        board_id: boardId,
        created_by: createdBy,
        type: 'text',
        content: params.content,
        position_x: params.positionX,
        position_y: params.positionY,
      })
      .select()
      .single();

    if (error) throw new Error(`Card Insert Error: ${error.message}`);

    // Text cards are plain notes — no AI round-trip, no location pins.
    await client.from('board_cards').update({ extraction_status: 'done' }).eq('id', data.id);

    return mapRowToBoardCard({ ...data, extraction_status: 'done' });
  },

  async createLinkCard(
    client: SupabaseClient,
    boardId: string,
    createdBy: string,
    params: { url: string; positionX: number; positionY: number }
  ) {
    const linkMeta = await fetchLinkMetadata(params.url);

    const { data, error } = await client
      .from('board_cards')
      .insert({
        board_id: boardId,
        created_by: createdBy,
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

    await runExtractionAndGeocode(client, data.id, boardId, { type: 'link', text: extractionText });

    return mapRowToBoardCard(data);
  },

  async createPhotoCard(
    client: SupabaseClient,
    boardId: string,
    createdBy: string,
    params: { imageBuffer: Buffer; mimeType: string; positionX: number; positionY: number }
  ) {
    const { data, error } = await client
      .from('board_cards')
      .insert({
        board_id: boardId,
        created_by: createdBy,
        type: 'photo',
        position_x: params.positionX,
        position_y: params.positionY,
      })
      .select()
      .single();

    if (error) throw new Error(`Card Insert Error: ${error.message}`);

    const photoUrl = await uploadCardPhoto(client, data.id, params.imageBuffer, params.mimeType);
    if (photoUrl) {
      await client.from('board_cards').update({ photo_url: photoUrl }).eq('id', data.id);
    }

    await runExtractionAndGeocode(client, data.id, boardId, {
      type: 'photo',
      imageBuffer: params.imageBuffer,
      mimeType: params.mimeType,
    });

    const { data: finalRow } = await client.from('board_cards').select('*').eq('id', data.id).single();
    return mapRowToBoardCard(finalRow);
  },

  async updateCardContent(
    client: SupabaseClient,
    boardId: string,
    cardId: string,
    params: { type: 'text' | 'link'; content: string }
  ): Promise<BoardCard> {
    let linkMeta: Record<string, unknown> | undefined;
    let extractionText = params.content;

    if (params.type === 'link') {
      const meta = await fetchLinkMetadata(params.content);
      linkMeta = meta;
      extractionText = [meta.title, meta.description, meta.textSnippet, params.content].filter(Boolean).join('\n');
    }

    const { error } = await client
      .from('board_cards')
      .update({
        content: params.content,
        ...(linkMeta ? { link_meta: linkMeta } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)
      .eq('board_id', boardId);

    if (error) throw new Error(`Card Update Error: ${error.message}`);

    // Content changed — old extracted locations no longer apply either way.
    await client.from('board_locations').delete().eq('card_id', cardId);
    if (params.type === 'text') {
      await client.from('board_cards').update({ extraction_status: 'done' }).eq('id', cardId);
    } else {
      // Content changed — old extracted locations no longer apply, so
      // re-run extraction+geocoding on the new content.
      await runExtractionAndGeocode(client, cardId, boardId, { type: params.type, text: extractionText });
    }

    const { data: finalRow, error: fetchError } = await client
      .from('board_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (fetchError) throw new Error(`Card Fetch Error: ${fetchError.message}`);
    return mapRowToBoardCard(finalRow);
  },

  async listCards(client: SupabaseClient, boardId: string): Promise<BoardCard[]> {
    const { data, error } = await client
      .from('board_cards')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Card List Error: ${error.message}`);
    return (data || []).map(mapRowToBoardCard);
  },

  async listLocations(client: SupabaseClient, boardId: string): Promise<BoardLocation[]> {
    const { data, error } = await client
      .from('board_locations')
      .select('*')
      .eq('board_id', boardId)
      .not('lat', 'is', null);

    if (error) throw new Error(`Location List Error: ${error.message}`);
    return (data || []).map(mapRowToBoardLocation);
  },

  async updateCardPosition(client: SupabaseClient, boardId: string, cardId: string, x: number, y: number) {
    const { error } = await client
      .from('board_cards')
      .update({ position_x: x, position_y: y, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .eq('board_id', boardId);

    if (error) throw new Error(`Card Update Error: ${error.message}`);
  },

  async deleteCard(client: SupabaseClient, boardId: string, cardId: string) {
    const { error } = await client.from('board_cards').delete().eq('id', cardId).eq('board_id', boardId);
    if (error) throw new Error(`Card Delete Error: ${error.message}`);
  },

  // Undo for a delete — same idea as Figma's: the deleting client kept a
  // local snapshot of the card before it hard-deleted, and this recreates it
  // from that snapshot. Skips the AI extraction call since the snapshot
  // already has raw_extracted_locations; only geocoding re-runs (cheap,
  // deterministic — not worth caching lat/lng client-side just to skip it).
  // Note the photo bucket object is never deleted, so a restored photo card
  // reuses the same photoUrl directly, no re-upload needed.
  async restoreCard(
    client: SupabaseClient,
    boardId: string,
    createdBy: string,
    snapshot: {
      type: 'text' | 'link' | 'photo';
      content?: string;
      photoUrl?: string;
      linkMeta?: Record<string, unknown>;
      positionX: number;
      positionY: number;
      rawExtractedLocations?: { name: string; confidence?: number }[];
    }
  ): Promise<BoardCard> {
    const locations = snapshot.rawExtractedLocations ?? [];

    const { data, error } = await client
      .from('board_cards')
      .insert({
        board_id: boardId,
        created_by: createdBy,
        type: snapshot.type,
        content: snapshot.content,
        photo_url: snapshot.photoUrl,
        link_meta: snapshot.linkMeta,
        position_x: snapshot.positionX,
        position_y: snapshot.positionY,
        raw_extracted_locations: locations.length > 0 ? locations : null,
        extraction_status: 'done',
      })
      .select()
      .single();

    if (error) throw new Error(`Card Restore Error: ${error.message}`);

    await geocodeAndStoreLocations(client, data.id, boardId, locations);

    return mapRowToBoardCard(data);
  },
};

export { boardCardService };
