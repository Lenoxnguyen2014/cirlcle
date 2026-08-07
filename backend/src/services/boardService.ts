import type { SupabaseClient } from '@supabase/supabase-js';
import { mapRowToBoard } from '../utils/mapdb.js';
import type { Board } from '../types/Board.js';

// board_members exists purely to give Realtime Authorization a concrete
// membership check for "presence-<boardId>" topics — it isn't consulted by
// any REST authorization, boards/cards stay open to any authenticated user.
// ignoreDuplicates means a repeat join (e.g. revisiting the board) is a
// harmless no-op rather than resetting an existing member's role.
const addMembership = async (
  client: SupabaseClient,
  boardId: string,
  userId: string,
  role: 'admin' | 'member'
) => {
  const { error } = await client
    .from('board_members')
    .upsert({ board_id: boardId, user_id: userId, role }, { onConflict: 'board_id,user_id', ignoreDuplicates: true });

  if (error) throw new Error(`Board Membership Error: ${error.message}`);
};

const boardService = {
  async createBoard(client: SupabaseClient, name: string, createdBy: string): Promise<Board> {
    const { data, error } = await client
      .from('boards')
      .insert({ name, created_by: createdBy })
      .select()
      .single();

    if (error) throw new Error(`Board Insert Error: ${error.message}`);

    await addMembership(client, data.id, createdBy, 'admin');

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

  // Called when a user opens a board via a shared link — anyone
  // authenticated may join (matches the existing open collaboration model),
  // this just records it so Realtime Authorization has something to check.
  async joinBoard(client: SupabaseClient, boardId: string, userId: string) {
    await addMembership(client, boardId, userId, 'member');
  },
};

export { boardService };
