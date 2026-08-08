import { useOutletContext } from 'react-router-dom';
import type { BoardCard, BoardLocation } from '../../types/board';
import type { RemoteCursorState } from '../../types/remoteCursor';

// Shared across BoardView and MapView via <Outlet context={...}>, owned by
// BoardMapViewPage — this is what lets both views reuse the same card data,
// realtime subscriptions, and presence channel instead of each re-fetching
// and re-subscribing independently every time you switch between them.
export interface BoardMapViewContext {
  boardId: string;
  cards: BoardCard[];
  cardsError: string | null;
  moveCard: (id: string, x: number, y: number) => void;
  addCard: (card: BoardCard) => void;
  editCard: (cardId: string, type: 'text' | 'link', content: string) => void;
  setCardDate: (cardId: string, visitDate: string | null) => void;
  deleteCard: (cardId: string) => unknown;
  undoDelete: () => void;
  remoteCursors: Record<string, RemoteCursorState>;
  remoteSelectionsByCard: Record<string, { email: string; color: string; isEditing?: boolean }[]>;
  broadcastSelection: (cardId: string | null, isEditing?: boolean) => void;
  sendCursor: (x: number, y: number) => void;
  locations: BoardLocation[];
  locationsError: string | null;
  fetchLocations: () => void;
  dayColors: Record<string, string>;
  setDayColor: (date: string, color: string) => void;
}

export function useBoardMapViewContext() {
  return useOutletContext<BoardMapViewContext>();
}
