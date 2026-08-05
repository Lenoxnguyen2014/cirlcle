import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Stage, Layer } from 'react-konva';
import * as boardApi from '../api/boardClient';
import { supabaseClient } from '../lib/supabaseClient';
import { mapRowToBoardCard } from '../utils/mapRow';
import { BoardCard as BoardCardComponent } from '../components/board/BoardCard';
import { AddCardToolbar } from '../components/board/AddCardToolbar';
import { ShareBoardButton } from '../components/ShareBoardButton';
import type { BoardCard } from '../types/board';

const STAGE_HEIGHT = 560;

export function InteractiveBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const highlightCardId = searchParams.get('cardId');
  const navigate = useNavigate();

  const [cards, setCards] = useState<BoardCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!boardId) return;
    boardApi
      .listBoardCards(boardId)
      .then(setCards)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load board'));
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

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
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [boardId]);

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

  const nextPosition = useCallback(() => {
    const col = cards.length % 4;
    const row = Math.floor(cards.length / 4);
    return { x: 40 + col * 220, y: 40 + row * 180 };
  }, [cards.length]);

  const highlightCard = highlightCardId ? cards.find((c) => c.id === highlightCardId) : undefined;
  const stageOffset = highlightCard
    ? { x: stageWidth / 2 - (highlightCard.positionX + 100), y: STAGE_HEIGHT / 2 - (highlightCard.positionY + 80) }
    : { x: 0, y: 0 };

  if (!boardId) return null;

  return (
    <div className="board-page">
      <div className="board-page-header">
        <Link to="/">← Boards</Link>
        <div className="board-page-header-actions">
          <ShareBoardButton boardId={boardId} />
          <button type="button" onClick={() => navigate(`/boards/${boardId}/map`)}>
            View map
          </button>
        </div>
      </div>

      <AddCardToolbar boardId={boardId} nextPosition={nextPosition} onCardCreated={handleCardCreated} />

      {error && <p className="auth-error">{error}</p>}

      <div ref={containerRef} className="board-stage-container">
        <Stage width={stageWidth} height={STAGE_HEIGHT} x={stageOffset.x} y={stageOffset.y}>
          <Layer>
            {cards.map((card) => (
              <BoardCardComponent
                key={card.id}
                card={card}
                highlighted={card.id === highlightCardId}
                onDragEnd={handleDragEnd}
                onViewOnMap={(cardId) => navigate(`/boards/${boardId}/map?cardId=${cardId}`)}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
