import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { useAuth } from '../../context/AuthContext';
import { useBoardCards } from '../../composable/interactiveBoard/useBoardCards';
import { usePresence } from '../../composable/interactiveBoard/usePresence';
import { useCanvasZoom } from '../../composable/interactiveBoard/useCanvasZoom';
import { BoardCard as BoardCardComponent } from '../../components/board/BoardCard';
import { RemoteCursor } from '../../components/board/RemoteCursor';
import { AddCardToolbar } from '../../components/board/AddCardToolbar';
import { ShareBoardButton } from '../../components/shareButton/ShareBoardButton';
import styles from './InteractiveBoardPage.module.scss';

export function InteractiveBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const highlightCardId = searchParams.get('cardId');
  const navigate = useNavigate();
  const { user } = useAuth();

  const { cards, error, moveCard, addCard, editCard, deleteCard, undoDelete } = useBoardCards(boardId);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageWidth, setStageWidth] = useState(800);
  const [stageHeight, setStageHeight] = useState(560);

  const { remoteCursors, onlineUsers, remoteSelectionsByCard, broadcastSelection, sendCursor } = usePresence(
    boardId,
    user,
    stageRef
  );
  const { handleWheel } = useCanvasZoom(stageRef);

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
      deleteCard(cardId);
      setSelectedCardId((prev) => (prev === cardId ? null : prev));
      broadcastSelection(null);
    },
    [deleteCard, broadcastSelection]
  );


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      if (isUndo) {
        e.preventDefault();
        undoDelete();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCardId) {
        e.preventDefault();
        handleDeleteCard(selectedCardId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoDelete, handleDeleteCard, selectedCardId]);

  const nextPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 40, y: 40 };

    const scale = stage.scaleX();
    const centerX = (stageWidth / 2 - stage.x()) / scale;
    const centerY = (stageHeight / 2 - stage.y()) / scale;
    const jitter = (cards.length % 5) * 24;

    return { x: centerX - 100 + jitter, y: centerY - 40 + jitter };
  }, [cards.length, stageWidth, stageHeight]);

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
          onMouseMove={sendCursor}
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
                onDragEnd={moveCard}
                onViewOnMap={(cardId) => navigate(`/boards/${boardId}/map?cardId=${cardId}`)}
                onSelect={handleSelectCard}
                onEdit={editCard}
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
          <AddCardToolbar boardId={boardId} nextPosition={nextPosition} onCardCreated={addCard} />
        </div>
      </div>
    </div>
  );
}
