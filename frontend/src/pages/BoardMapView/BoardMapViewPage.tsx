import { useCallback, useEffect, useState } from 'react';
import { useParams, useLocation, Link, Outlet } from 'react-router-dom';
import * as boardApi from '../../api/board/boardClient';
import { supabaseClient } from '../../lib/supabaseClient';
import { mapRowToBoardLocation } from '../../utils/mapRow';
import { useAuth } from '../../context/AuthContext';
import { useBoardCards } from '../../composable/interactiveBoard/useBoardCards';
import { usePresence } from '../../composable/interactiveBoard/usePresence';
import { ShareBoardButton } from '../../components/shareButton/ShareBoardButton';
import styles from './BoardMapViewPage.module.scss';
import type { BoardLocation } from '../../types/board';
import type { BoardMapViewContext } from './context';

// Shared parent for /boards/:boardId (BoardView) and /boards/:boardId/map
// (MapView) — owns every hook/subscription both views need (cards,
// presence, locations, day colors) so switching between them via the
// header's toggle only swaps which child <Outlet> renders, rather than
// tearing down and re-fetching/re-subscribing everything from scratch.
export function BoardMapViewPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const location = useLocation();
  const { user } = useAuth();

  const boardCards = useBoardCards(boardId);
  const presence = usePresence(boardId, user);

  const [locations, setLocations] = useState<BoardLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [dayColors, setDayColors] = useState<Record<string, string>>({});

  const fetchLocations = useCallback(() => {
    if (!boardId) return;
    boardApi
      .listBoardLocations(boardId)
      .then(setLocations)
      .catch((err) => setLocationsError(err instanceof Error ? err.message : 'Failed to load locations'));
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

    // Re-fetch on every (re)connect, since postgres_changes never replays
    // events missed while the socket was briefly disconnected.
    fetchLocations();

    const channel = supabaseClient
      .channel(`board-locations-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_locations', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setLocations((prev) => prev.filter((l) => l.id !== deletedId));
            return;
          }
          const incoming = mapRowToBoardLocation(payload.new);
          if (incoming.lat == null || incoming.lng == null) return;
          setLocations((prev) => {
            const exists = prev.some((l) => l.id === incoming.id);
            return exists ? prev.map((l) => (l.id === incoming.id ? incoming : l)) : [...prev, incoming];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fetchLocations();
      });

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [boardId, fetchLocations]);

  useEffect(() => {
    if (!boardId) return;

    const fetchDayColors = () =>
      boardApi
        .listDayColors(boardId)
        .then((rows) => setDayColors(Object.fromEntries(rows.map((row) => [row.date, row.color]))))
        .catch(() => {});

    const channel = supabaseClient
      .channel(`board-day-colors-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_day_colors', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as any;
          setDayColors((prev) => ({ ...prev, [row.visit_date]: row.color }));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fetchDayColors();
      });

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [boardId]);

  const setDayColor = useCallback(
    (date: string, color: string) => {
      setDayColors((prev) => ({ ...prev, [date]: color }));
      if (boardId) boardApi.setDayColor(boardId, date, color).catch(() => {});
    },
    [boardId]
  );

  if (!boardId) return null;

  const isMapView = location.pathname.endsWith('/map');

  const context: BoardMapViewContext = {
    boardId,
    cards: boardCards.cards,
    cardsError: boardCards.error,
    moveCard: boardCards.moveCard,
    addCard: boardCards.addCard,
    editCard: boardCards.editCard,
    setCardDate: boardCards.setCardDate,
    deleteCard: boardCards.deleteCard,
    undoDelete: boardCards.undoDelete,
    remoteCursors: presence.remoteCursors,
    remoteSelectionsByCard: presence.remoteSelectionsByCard,
    broadcastSelection: presence.broadcastSelection,
    sendCursor: presence.sendCursor,
    locations,
    locationsError,
    fetchLocations,
    dayColors,
    setDayColor,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {presence.onlineUsers.length > 0 && (
          <div className={styles.presenceRow}>
            {presence.onlineUsers.map((u) => (
              <div key={u.userId} className={styles.presenceAvatar} style={{ background: u.color }} title={u.email}>
                {(u.email[0] || '?').toUpperCase()}
              </div>
            ))}
          </div>
        )}
        <div className={styles.headerActions}>
          <ShareBoardButton boardId={boardId} />
          <Link
            to={isMapView ? `/boards/${boardId}` : `/boards/${boardId}/map`}
            className={styles.viewToggleButton}
          >
            {isMapView ? 'View board' : 'View map'}
          </Link>
        </div>
      </div>

      <Outlet context={context} />
    </div>
  );
}
