import type { SupabaseClient } from '@supabase/supabase-js';
import { mapRowToBoard } from '../utils/mapdb.js';
import type { Board } from '../types/Board.js';

const boardService = {
  async createBoard(client: SupabaseClient, name: string, createdBy: string): Promise<Board> {
    const { data, error } = await client
      .from('boards')
      .insert({ name, created_by: createdBy })
      .select()
      .single();

    if (error) throw new Error(`Board Insert Error: ${error.message}`);
    return mapRowToBoard(data);
  },

  async listBoards(client: SupabaseClient): Promise<Board[]> {
    const { data, error } = await client.from('boards').select('*').order('created_at', { ascending: false });

    if (error) throw new Error(`Board List Error: ${error.message}`);
    return (data || []).map(mapRowToBoard);
  },

  async getBoard(client: SupabaseClient, id: string): Promise<Board | null> {
    const { data, error } = await client.from('boards').select('*').eq('id', id).single();
    if (error) return null;
    return mapRowToBoard(data);
  },
};

export { boardService };
