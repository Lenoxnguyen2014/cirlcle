import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { useCanvasZoom } from '../../composable/interactiveBoard/useCanvasZoom';
import { BoardCard as BoardCardComponent } from '../../components/board/BoardCard';
import { RemoteCursor } from '../../components/board/RemoteCursor';
import { AddCardToolbar } from '../../components/board/AddCardToolbar';
import { useBoardMapViewContext } from './context';
import styles from './BoardView.module.scss';

export function BoardView() {
  const {
    boardId,
    cards,
    cardsError,
    moveCard,
    addCard,
    editCard,
    deleteCard,
    undoDelete,
    remoteCursors,
    remoteSelectionsByCard,
    broadcastSelection,
    sendCursor,
    dayColors,
  } = useBoardMapViewContext();

  const [searchParams] = useSearchParams();
  const highlightCardId = searchParams.get('cardId');
  const navigate = useNavigate();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageWidth, setStageWidth] = useState(800);
  const [stageHeight, setStageHeight] = useState(560);

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

  // Converts the pointer to world coordinates (same space as card positions)
  // before handing it to sendCursor, which is coordinate-space-agnostic —
  // every viewer's own pan/zoom then projects it correctly with no extra
  // math needed on the receiving end.
  const handleMouseMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scale = stage.scaleX();
    sendCursor((pointer.x - stage.x()) / scale, (pointer.y - stage.y()) / scale);
  }, [sendCursor]);

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

  return (
    <>
      {cardsError && <p className="auth-error">{cardsError}</p>}

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
                dayColor={card.visitDate ? dayColors[card.visitDate] : undefined}
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
    </>
  );
}
