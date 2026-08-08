import { useCallback, useEffect, useRef, useState } from 'react';
import * as boardApi from '../../api/board/boardClient';
import { supabaseClient } from '../../lib/supabaseClient';
import { mapRowToBoardCard } from '../../utils/mapRow';
import type { BoardCard } from '../../types/board';

// Owns board_cards: initial load, live sync (postgres_changes), and every
// create/move/edit/delete/undo mutation. Selection and presence are
// separate concerns and stay in the page.
export function useBoardCards(boardId: string | undefined) {
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Client-local undo history — same idea as Figma's: only the client that
  // deleted a card remembers its full data, and undo just recreates it.
  const lastDeletedRef = useRef<BoardCard | null>(null);

  useEffect(() => {
    if (!boardId) return;

    const fetchCards = () =>
      boardApi
        .listBoardCards(boardId)
        .then(setCards)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load board'));

    fetchCards();

    // Initial load, then re-fetched every time this subscription (re)connects.
    // postgres_changes has no catch-up delivery for events missed while the
    // socket was disconnected (network blip, backgrounded tab, etc.) — a
    // dropped-then-reconnected client would otherwise silently stay stale
    // forever, since Supabase auto-reconnects and re-fires 'SUBSCRIBED' but
    // never replays what happened during the gap.
    const channel = supabaseClient
      .channel(`board-cards-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setCards((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
            return;
          }
          const incoming = mapRowToBoardCard(payload.new);
          setCards((prev) => {
            const exists = prev.some((c) => c.id === incoming.id);
            return exists ? prev.map((c) => (c.id === incoming.id ? incoming : c)) : [...prev, incoming];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fetchCards();
      });

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [boardId]);

  const moveCard = useCallback(
    (id: string, x: number, y: number) => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, positionX: x, positionY: y } : c)));
      if (boardId) boardApi.updateCardPosition(boardId, id, x, y).catch(() => {});
    },
    [boardId]
  );

  const addCard = useCallback((card: BoardCard) => {
    setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
  }, []);

  const setCardDate = useCallback(
    (cardId: string, visitDate: string | null) => {
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, visitDate: visitDate ?? undefined } : c)));
      if (boardId) boardApi.updateCardDate(boardId, cardId, visitDate).catch(() => {});
    },
    [boardId]
  );

  const editCard = useCallback(
    (cardId: string, type: 'text' | 'link', content: string) => {
      if (!boardId) return;
      boardApi
        .updateCardContent(boardId, cardId, { type, content })
        .then((updated) => setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c))))
        .catch(() => {});
    },
    [boardId]
  );

  const deleteCard = useCallback(
    (cardId: string) => {
      setCards((prev) => {
        const deleted = prev.find((c) => c.id === cardId);
        if (deleted) lastDeletedRef.current = deleted;
        return prev.filter((c) => c.id !== cardId);
      });
      // Returned so callers can chain a follow-up (e.g. MapPage re-fetching
      // locations) after the delete actually lands on the backend, rather
      // than depending solely on Realtime to notify them of the cascade.
      if (!boardId) return Promise.resolve();
      return boardApi.deleteCard(boardId, cardId).catch(() => {});
    },
    [boardId]
  );

  const undoDelete = useCallback(() => {
    const snapshot = lastDeletedRef.current;
    if (!snapshot || !boardId) return;
    lastDeletedRef.current = null;

    boardApi
      .restoreCard(boardId, {
        type: snapshot.type,
        content: snapshot.content,
        photoUrl: snapshot.photoUrl,
        linkMeta: snapshot.linkMeta,
        positionX: snapshot.positionX,
        positionY: snapshot.positionY,
        rawExtractedLocations: snapshot.rawExtractedLocations,
      })
      .then((restored) => setCards((prev) => (prev.some((c) => c.id === restored.id) ? prev : [...prev, restored])))
      .catch(() => {
        lastDeletedRef.current = snapshot; // restore failed — allow another attempt
      });
  }, [boardId]);

  return { cards, error, moveCard, addCard, editCard, setCardDate, deleteCard, undoDelete };
}
