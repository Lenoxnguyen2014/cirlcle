import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as boardApi from '../../api/board/boardClient';
import { supabaseClient } from '../../lib/supabaseClient';
import { mapRowToBoardCard } from '../../utils/mapRow';
import { colorForUser } from '../../utils/presenceColor';
import { useAuth } from '../../context/AuthContext';
import { BoardCard as BoardCardComponent } from '../../components/board/BoardCard';
import { RemoteCursor } from '../../components/board/RemoteCursor';
import { AddCardToolbar } from '../../components/board/AddCardToolbar';
import { ShareBoardButton } from '../../components/shareButton/ShareBoardButton';
import styles from './InteractiveBoardPage.module.scss';
import type { BoardCard } from '../../types/board';

const ZOOM_STEP = 1.08;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const CURSOR_BROADCAST_INTERVAL_MS = 50;

interface RemoteCursorState {
  userId: string;
  x: number;
  y: number;
  email: string;
  color: string;
}

interface PresenceUser {
  userId: string;
  email: string;
  color: string;
}

interface RemoteSelectionState {
  userId: string;
  cardId: string | null;
  email: string;
  color: string;
  isEditing?: boolean;
}

export function InteractiveBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const highlightCardId = searchParams.get('cardId');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cards, setCards] = useState<BoardCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageWidth, setStageWidth] = useState(800);
  const [stageHeight, setStageHeight] = useState(560);

  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursorState>>({});
  const [remoteSelections, setRemoteSelections] = useState<Record<string, RemoteSelectionState>>({});
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const lastCursorSentRef = useRef(0);
 
  const lastDeletedRef = useRef<BoardCard | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(entry.contentRect.width);
      setStageHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!boardId) return;

    const fetchCards = () =>
      boardApi
        .listBoardCards(boardId)
        .then(setCards)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load board'));

    // Initial load, then re-fetched every time this subscription (re)connects.
    // postgres_changes has no catch-up delivery for events missed while the
    // socket was disconnected (network blip, backgrounded tab, etc.) — a
    // dropped-then-reconnected client would otherwise silently stay stale
    // forever, since Supabase auto-reconnects and re-fires 'SUBSCRIBED' but
    // never replays what happened during the gap.
    fetchCards();

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

 
  useEffect(() => {
    if (!boardId || !user) return;

    const color = colorForUser(user.id);
    const channel = supabaseClient.channel(`presence-${boardId}`, {
      // private: true is required for Supabase's Realtime Authorization to
      // enforce (and thus even consult) the RLS policies on
      // realtime.messages — without it, Broadcast/Presence silently only
      // ever reflect your own client's optimistic local state.
      config: { private: true, presence: { key: user.id } },
    });

    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const cursor = payload as RemoteCursorState;
        if (cursor.userId === user.id) return;
        setRemoteCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
      })
      .on('broadcast', { event: 'selection' }, ({ payload }) => {
        const selection = payload as RemoteSelectionState;
        if (selection.userId === user.id) return;
        setRemoteSelections((prev) => ({ ...prev, [selection.userId]: selection }));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ email: string; color: string }>();
        const users = Object.entries(state).map(([userId, entries]) => ({
          userId,
          email: entries[0]?.email ?? '',
          color: entries[0]?.color ?? colorForUser(userId),
        }));
        setOnlineUsers(users);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setRemoteCursors((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setRemoteSelections((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ email: user.email, color });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabaseClient.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [boardId, user]);

  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, positionX: x, positionY: y } : c)));
      if (boardId) boardApi.updateCardPosition(boardId, id, x, y).catch(() => {});
    },
    [boardId]
  );

  const handleCardCreated = useCallback((card: BoardCard) => {
    setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
  }, []);

  // Broadcasts this user's current selection (or null to clear it), plus
  // whether they're actively editing it — so other viewers can highlight the
  // same card in this user's presence color, with a "is writing..." badge
  // while they're mid-edit. Same idea as the cursor broadcast above, just
  // for selection state.
  const broadcastSelection = useCallback(
    (cardId: string | null, isEditing = false) => {
      const channel = presenceChannelRef.current;
      if (!channel || !user) return;
      channel.send({
        type: 'broadcast',
        event: 'selection',
        payload: { userId: user.id, cardId, email: user.email, color: colorForUser(user.id), isEditing },
      });
    },
    [user]
  );

  const handleSelectCard = useCallback(
    (cardId: string) => {
      setSelectedCardId(cardId);
      broadcastSelection(cardId);
    },
    [broadcastSelection]
  );

  // Fired by BoardCard when its inline textarea opens/closes — re-broadcasts
  // the same selection with isEditing toggled so other viewers see "is
  // writing..." while this card is actively being edited.
  const handleCardEditingChange = useCallback(
    (cardId: string, isEditing: boolean) => {
      broadcastSelection(cardId, isEditing);
    },
    [broadcastSelection]
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      setCards((prev) => {
        const deleted = prev.find((c) => c.id === cardId);
        if (deleted) lastDeletedRef.current = deleted;
        return prev.filter((c) => c.id !== cardId);
      });
      setSelectedCardId((prev) => (prev === cardId ? null : prev));
      broadcastSelection(null);
      if (boardId) boardApi.deleteCard(boardId, cardId).catch(() => {});
    },
    [boardId, broadcastSelection]
  );

  const handleUndo = useCallback(() => {
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

  // Ctrl/Cmd+Z undoes the last card this client deleted; Delete/Backspace
  // removes whichever card is currently selected. Both skipped while focus
  // is in a text field so they don't hijack native text editing there (e.g.
  // inside the add-card input).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      if (isUndo) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCardId) {
        e.preventDefault();
        handleDeleteCard(selectedCardId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleDeleteCard, selectedCardId]);

  const handleEditCard = useCallback(
    (cardId: string, type: 'text' | 'link', content: string) => {
      if (!boardId) return;
      boardApi
        .updateCardContent(boardId, cardId, { type, content })
        .then((updated) => setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c))))
        .catch(() => {});
    },
    [boardId]
  );

  // Zoom in/out centered on the cursor, like Figma/Miro — reads/writes the
  // stage's scale and position imperatively via the ref rather than React
  // state, so panning/zooming doesn't need a re-render on every wheel tick.
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;

    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP;
    const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);

    stage.scale({ x: clampedScale, y: clampedScale });
    stage.position({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
    stage.batchDraw();
  };

  // Throttled broadcast of this user's pointer, converted to world
  // coordinates (same space as card positions) so every viewer's own
  // pan/zoom projects it correctly with no extra math on the receiving end.
  const handleMouseMove = () => {
    const stage = stageRef.current;
    const channel = presenceChannelRef.current;
    if (!stage || !channel || !user) return;

    const now = Date.now();
    if (now - lastCursorSentRef.current < CURSOR_BROADCAST_INTERVAL_MS) return;
    lastCursorSentRef.current = now;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scale = stage.scaleX();

    channel.send({
      type: 'broadcast',
      event: 'cursor',
      payload: {
        userId: user.id,
        x: (pointer.x - stage.x()) / scale,
        y: (pointer.y - stage.y()) / scale,
        email: user.email,
        color: colorForUser(user.id),
      },
    });
  };

  // New cards land near the current viewport's center, converted from screen
  // space to world space — otherwise they'd appear off-screen once the board
  // has been panned/zoomed away from the origin.
  const nextPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 40, y: 40 };

    const scale = stage.scaleX();
    const centerX = (stageWidth / 2 - stage.x()) / scale;
    const centerY = (stageHeight / 2 - stage.y()) / scale;
    const jitter = (cards.length % 5) * 24;

    return { x: centerX - 100 + jitter, y: centerY - 40 + jitter };
  }, [cards.length, stageWidth, stageHeight]);

  // Group remote selections by card so a card can render an outline per
  // remote user who currently has it selected (rare to have more than one,
  // but nothing stops it).
  const remoteSelectionsByCard = useMemo(() => {
    const map: Record<string, { email: string; color: string; isEditing?: boolean }[]> = {};
    for (const selection of Object.values(remoteSelections)) {
      if (!selection.cardId) continue;
      (map[selection.cardId] ??= []).push({
        email: selection.email,
        color: selection.color,
        isEditing: selection.isEditing,
      });
    }
    return map;
  }, [remoteSelections]);

  const highlightCard = highlightCardId ? cards.find((c) => c.id === highlightCardId) : undefined;

  // Center on a highlighted card once, imperatively — a controlled x/y prop
  // on <Stage> would otherwise fight with user-driven pan/zoom above.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !highlightCard) return;
    const scale = stage.scaleX();
    stage.position({
      x: stageWidth / 2 - (highlightCard.positionX + 100) * scale,
      y: stageHeight / 2 - (highlightCard.positionY + 80) * scale,
    });
    stage.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightCardId, highlightCard?.positionX, highlightCard?.positionY, stageWidth, stageHeight]);

  if (!boardId) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {onlineUsers.length > 0 && (
          <div className={styles.presenceRow}>
            {onlineUsers.map((u) => (
              <div key={u.userId} className={styles.presenceAvatar} style={{ background: u.color }} title={u.email}>
                {(u.email[0] || '?').toUpperCase()}
              </div>
            ))}
          </div>
        )}
        <div className={styles.headerActions}>
          <ShareBoardButton boardId={boardId} />
          <button type="button" className={styles.mapButton} onClick={() => navigate(`/boards/${boardId}/map`)}>
            View map
          </button>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div ref={containerRef} className={styles.stageContainer}>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          draggable
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onClick={(e) => {
            if (e.target === e.target.getStage()) {
              setSelectedCardId(null);
              broadcastSelection(null);
            }
          }}
        >
          <Layer>
            {cards.map((card) => (
              <BoardCardComponent
                key={card.id}
                card={card}
                highlighted={card.id === highlightCardId}
                selected={card.id === selectedCardId}
                onDragEnd={handleDragEnd}
                onViewOnMap={(cardId) => navigate(`/boards/${boardId}/map?cardId=${cardId}`)}
                onSelect={handleSelectCard}
                onEdit={handleEditCard}
                onEditingChange={handleCardEditingChange}
                remoteSelectedBy={remoteSelectionsByCard[card.id]}
              />
            ))}
            {Object.values(remoteCursors).map((cursor) => (
              <RemoteCursor key={cursor.userId} x={cursor.x} y={cursor.y} email={cursor.email} color={cursor.color} />
            ))}
          </Layer>
        </Stage>

        <div className={styles.toolbarOverlay}>
          <AddCardToolbar boardId={boardId} nextPosition={nextPosition} onCardCreated={handleCardCreated} />
        </div>
      </div>
    </div>
  );
}
