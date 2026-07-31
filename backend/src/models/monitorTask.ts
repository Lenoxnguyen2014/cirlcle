// src/models/MonitorTask.ts
import { supabase } from '../lib/supabase.js';
import type { MonitorTask } from '../types/MonitorTask.js';
import { mapRowToTask } from '../utils/mapdb.js';

const MonitorTaskModel = {
  async create(data: Omit<MonitorTask, 'id' | 'active' | 'createdAt'>): Promise<MonitorTask> {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const { data: inserted, error } = await supabase
      .from('monitor_tasks')
      .insert({
        id,
        user_id: data.userId || null,
        origin: data.origin,
        destination: data.destination,
        date: data.date,
        user_instruction: data.userInstruction,
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase Insert Error: ${error.message}`);
    return mapRowToTask(inserted);
  },

  async findActive(): Promise<MonitorTask[]> {
    const { data, error } = await supabase
      .from('monitor_tasks')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('Supabase Query Error:', error.message);
      return [];
    }
    return (data || []).map(mapRowToTask);
  },

  async findAll(): Promise<MonitorTask[]> {
    const { data, error } = await supabase
      .from('monitor_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Query Error:', error.message);
      return [];
    }
    return (data || []).map(mapRowToTask);
  },

  async deactivate(taskId: string): Promise<boolean> {
    const { error } = await supabase
      .from('monitor_tasks')
      .update({ active: false })
      .eq('id', taskId);

    if (error) {
      console.error(`Supabase Deactivate Error on ${taskId}:`, error.message);
      return false;
    }
    return true;
  }
};

export { MonitorTaskModel };