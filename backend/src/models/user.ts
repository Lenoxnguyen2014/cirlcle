// src/models/UserModel.ts
import { supabase } from '../lib/supabase.js';
import type { User } from '../types/User.js';
import { aiParseTravelDocs } from '../services/aiParseTravelDocs.js';
import { v4 as uuidv4 } from 'uuid';

const UserModel = {
  async createWithDocument(
    userData: Omit<User, 'id' | 'createdAt'>,
    imageBuffer?: Buffer,
    mimeType?: string
  ): Promise<User> {
    const id = `usr_${Date.now()}_uuid_${uuidv4()}`;
    
    let travelDocUrl: string | null = null;
    let extractedDocData: Record<string, any> = {};

    if (imageBuffer && mimeType) {
      const fileExtension = mimeType.split('/')[1] || 'jpg';
      const fileName = `${id}/${Date.now()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from('travel-docs')
        .upload(fileName, imageBuffer, { contentType: mimeType });

      if (uploadError) throw new Error(`Supabase Storage Error: ${uploadError.message}`);

      // Get Public URL of the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from('travel-docs')
        .getPublicUrl(fileName);

      travelDocUrl = publicUrlData.publicUrl;

      extractedDocData = await aiParseTravelDocs(imageBuffer, mimeType);
    }

    // 3. Save User record in DB
    const { data: inserted, error: dbError } = await supabase
      .from('users')
      .insert({
        id,
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.email,
        phone: userData.phone || null,
        travel_doc_url: travelDocUrl,  
        travel_doc_data: extractedDocData,
      })
      .select()
      .single();

    if (dbError) throw new Error(`Supabase Insert Error: ${dbError.message}`);
    return inserted;
  }
};

export { UserModel };