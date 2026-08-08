interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

interface BoardCard {
  id: string;
  boardId: string;
  createdBy?: string;
  type: 'text' | 'link' | 'photo';
  content?: string;
  photoUrl?: string;
  linkMeta?: {
    title?: string;
    description?: string;
    ogImage?: string;
    siteName?: string;
  };
  positionX: number;
  positionY: number;
  extractionStatus: 'pending' | 'processing' | 'done' | 'failed';
  rawExtractedLocations?: { name: string; confidence?: number }[];
  visitDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface BoardLocation {
  id: string;
  boardId: string;
  cardId: string;
  name: string;
  lat?: number;
  lng?: number;
  geocodeStatus: 'pending' | 'done' | 'failed';
  createdAt: string;
}

export type { Board, BoardCard, BoardLocation };
