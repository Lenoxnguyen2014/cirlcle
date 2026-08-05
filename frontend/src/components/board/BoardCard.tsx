import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type { BoardCard as BoardCardType } from '../../types/board';
import type Konva from 'konva';

const CARD_WIDTH = 200;
const CARD_HEIGHT = 160;

interface BoardCardProps {
  card: BoardCardType;
  highlighted?: boolean;
  onDragEnd: (id: string, x: number, y: number) => void;
  onViewOnMap: (cardId: string) => void;
}

function PhotoContent({ url }: { url: string }) {
  const [image] = useImage(url);
  return <KonvaImage image={image} x={8} y={8} width={CARD_WIDTH - 16} height={90} cornerRadius={4} />;
}

export function BoardCard({ card, highlighted, onDragEnd, onViewOnMap }: BoardCardProps) {
  const locationNames = (card.rawExtractedLocations ?? []).map((l) => l.name).join(', ');

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd(card.id, e.target.x(), e.target.y());
  };

  return (
    <Group x={card.positionX} y={card.positionY} draggable onDragEnd={handleDragEnd}>
      <Rect
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        fill="#ffffff"
        stroke={highlighted ? '#aa3bff' : '#e5e4e7'}
        strokeWidth={highlighted ? 3 : 1}
        cornerRadius={10}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={6}
        shadowOffsetY={2}
      />

      {card.type === 'photo' && card.photoUrl && <PhotoContent url={card.photoUrl} />}

      {card.type === 'text' && (
        <Text x={10} y={10} width={CARD_WIDTH - 20} height={90} text={card.content ?? ''} fontSize={13} fill="#08060d" />
      )}

      {card.type === 'link' && (
        <>
          <Text x={10} y={10} width={CARD_WIDTH - 20} text={card.linkMeta?.title || card.content || ''} fontSize={13} fontStyle="bold" fill="#08060d" />
          <Text x={10} y={40} width={CARD_WIDTH - 20} height={60} text={card.linkMeta?.description || card.content || ''} fontSize={11} fill="#6b6375" />
        </>
      )}

      <Text
        x={10}
        y={106}
        width={CARD_WIDTH - 20}
        text={
          card.extractionStatus === 'pending' || card.extractionStatus === 'processing'
            ? 'Extracting locations...'
            : locationNames
              ? `📍 ${locationNames}`
              : 'No locations found'
        }
        fontSize={11}
        fill="#aa3bff"
      />

      {locationNames && (
        <Text
          x={10}
          y={CARD_HEIGHT - 22}
          width={CARD_WIDTH - 20}
          text="View on map →"
          fontSize={11}
          fill="#aa3bff"
          onClick={() => onViewOnMap(card.id)}
          onTap={() => onViewOnMap(card.id)}
        />
      )}
    </Group>
  );
}
