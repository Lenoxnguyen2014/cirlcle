import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import type { BoardCard as BoardCardType } from '../../types/board';

const CARD_WIDTH = 240;
const PADDING = 24;
const CONTENT_WIDTH = CARD_WIDTH - PADDING * 2;
const PHOTO_HEIGHT = 90;
const GAP = 8;
const MIN_CARD_HEIGHT = 90;

interface BoardCardProps {
  card: BoardCardType;
  highlighted?: boolean;
  selected: boolean;
  onDragEnd: (id: string, x: number, y: number) => void;
  onViewOnMap: (cardId: string) => void;
  onSelect: (cardId: string) => void;
  onEdit: (cardId: string, type: 'text' | 'link', content: string) => void;
}

// Konva.Text auto-computes wrapped height once width is set — create one
// off-canvas just to measure it, without ever adding it to a layer/stage.
function measureTextHeight(text: string, fontSize: number, width: number): number {
  if (!text) return 0;
  return new Konva.Text({ text, fontSize, width, wrap: 'word' }).height();
}

function PhotoContent({ url }: { url: string }) {
  const [image] = useImage(url);
  return <KonvaImage image={image} x={PADDING} y={PADDING} width={CONTENT_WIDTH} height={PHOTO_HEIGHT} cornerRadius={4} />;
}

export function BoardCard({ card, highlighted, selected, onDragEnd, onViewOnMap, onSelect, onEdit }: BoardCardProps) {
  const groupRef = useRef<Konva.Group>(null);
  const [isEditing, setIsEditing] = useState(false);

  const locationNames = (card.rawExtractedLocations ?? []).map((l) => l.name).join(', ');
  const isExtracting = card.extractionStatus === 'pending' || card.extractionStatus === 'processing';
  const statusText = isExtracting ? 'Extracting locations...' : locationNames ? `📍 ${locationNames}` : 'No locations found';
  // Text cards never run AI extraction — showing "No locations found" would
  // wrongly imply extraction ran and came up empty.
  const showStatus = card.type !== 'text';
  const linkDescription = card.linkMeta?.description || card.content || '';
  const isActive = highlighted || selected;
  const isEditable = card.type === 'text' || card.type === 'link';

  const layout = useMemo(() => {
    const contentY = PADDING;
    let contentHeight: number;
    let descY = 0;

    if (card.type === 'photo') {
      contentHeight = PHOTO_HEIGHT;
    } else if (card.type === 'text') {
      contentHeight = Math.max(measureTextHeight(card.content ?? '', 13, CONTENT_WIDTH), 18);
    } else {
      const titleHeight = measureTextHeight(card.linkMeta?.title || card.content || '', 13, CONTENT_WIDTH);
      descY = contentY + titleHeight + GAP / 2;
      const descHeight = measureTextHeight(linkDescription, 11, CONTENT_WIDTH);
      contentHeight = titleHeight + (descHeight ? GAP / 2 + descHeight : 0);
    }

    if (!showStatus) {
      return { contentY, descY, contentHeight, statusY: 0, viewMapY: 0, totalHeight: Math.max(contentHeight + PADDING * 2, MIN_CARD_HEIGHT) };
    }

    const statusY = contentY + contentHeight + GAP;
    const statusHeight = measureTextHeight(statusText, 11, CONTENT_WIDTH);
    const viewMapY = statusY + statusHeight + 4;
    const viewMapHeight = locationNames ? 16 : 0;

    const totalHeight = Math.max(
      (locationNames ? viewMapY + viewMapHeight : statusY + statusHeight) + PADDING,
      MIN_CARD_HEIGHT
    );

    return { contentY, descY, contentHeight, statusY, viewMapY, totalHeight };
  }, [card.type, card.content, card.linkMeta?.title, linkDescription, statusText, locationNames, showStatus]);

  // Overlays a real <textarea> directly on top of the card's text so you can
  // type into it in place — Konva renders to <canvas>, which has no native
  // text input, so this is the standard workaround (same one Figma/tldraw/
  // Excalidraw use). Position/size are derived from the Group's own absolute
  // transform, which already bakes in the stage's current pan/zoom.
  useEffect(() => {
    if (!isEditing) return;
    const group = groupRef.current;
    const stage = group?.getStage();
    if (!group || !stage) {
      setIsEditing(false);
      return;
    }

    const scale = stage.scaleX();
    const stageBox = stage.container().getBoundingClientRect();
    const absPos = group.getAbsolutePosition();

    const textarea = document.createElement('textarea');
    textarea.value = card.content ?? '';
    document.body.appendChild(textarea);

    Object.assign(textarea.style, {
      position: 'fixed',
      top: `${stageBox.top + (absPos.y + layout.contentY) * scale}px`,
      left: `${stageBox.left + (absPos.x + PADDING) * scale}px`,
      width: `${CONTENT_WIDTH * scale}px`,
      height: `${Math.max(layout.contentHeight, 18) * scale}px`,
      fontSize: `${13 * scale}px`,
      lineHeight: '1.3',
      fontFamily: 'inherit',
      padding: '0',
      margin: '0',
      border: 'none',
      outline: '2px solid #aa3bff',
      outlineOffset: '2px',
      resize: 'none',
      overflow: 'hidden',
      background: '#fff',
      color: '#08060d',
      zIndex: '1000',
    });

    textarea.focus();
    textarea.select();

    let settled = false;
    const commit = () => {
      if (settled) return;
      settled = true;
      const value = textarea.value.trim();
      cleanup();
      if (value && value !== (card.content ?? '')) {
        onEdit(card.id, card.type as 'text' | 'link', value);
      }
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
    };
    function cleanup() {
      textarea.removeEventListener('blur', commit);
      textarea.removeEventListener('keydown', handleKeyDown);
      textarea.remove();
      setIsEditing(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      // Link URLs are single-line; Enter commits instead of adding a newline.
      if (e.key === 'Enter' && !e.shiftKey && card.type === 'link') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
      e.stopPropagation(); // don't let Delete/Backspace/Ctrl+Z reach the page-level shortcuts
    }

    textarea.addEventListener('blur', commit);
    textarea.addEventListener('keydown', handleKeyDown);

    return () => {
      textarea.removeEventListener('blur', commit);
      textarea.removeEventListener('keydown', handleKeyDown);
      textarea.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd(card.id, e.target.x(), e.target.y());
  };

  // First click selects; clicking an already-selected card again edits it in
  // place. Deleting is handled at the page level via the Delete/Backspace
  // key, acting on whichever card is currently selected.
  const handleClick = () => {
    if (!selected) {
      onSelect(card.id);
      return;
    }
    if (!isEditable) return; // nothing to edit on a photo card
    setIsEditing(true);
  };

  const handleViewOnMapClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    onViewOnMap(card.id);
  };

  return (
    <Group
      ref={groupRef}
      x={card.positionX}
      y={card.positionY}
      draggable={!isEditing}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      <Rect
        width={CARD_WIDTH}
        height={layout.totalHeight}
        fill="#ffffff"
        stroke={isActive ? '#aa3bff' : '#e5e4e7'}
        strokeWidth={isActive ? 3 : 1}
        cornerRadius={10}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={6}
        shadowOffsetY={2}
      />

      {card.type === 'photo' && card.photoUrl && <PhotoContent url={card.photoUrl} />}

      {card.type === 'text' && !isEditing && (
        <Text
          x={PADDING}
          y={layout.contentY}
          width={CONTENT_WIDTH}
          text={card.content ?? ''}
          fontSize={13}
          fill="#08060d"
          wrap="word"
        />
      )}

      {card.type === 'link' && (
        <>
          {!isEditing && (
            <Text
              x={PADDING}
              y={layout.contentY}
              width={CONTENT_WIDTH}
              text={card.linkMeta?.title || card.content || ''}
              fontSize={13}
              fontStyle="bold"
              fill="#08060d"
              wrap="word"
            />
          )}
          {linkDescription && (
            <Text
              x={PADDING}
              y={layout.descY}
              width={CONTENT_WIDTH}
              text={linkDescription}
              fontSize={11}
              fill="#6b6375"
              wrap="word"
            />
          )}
        </>
      )}

      {showStatus && (
        <Text x={PADDING} y={layout.statusY} width={CONTENT_WIDTH} text={statusText} fontSize={11} fill="#aa3bff" wrap="word" />
      )}

      {showStatus && locationNames && (
        <Text
          x={PADDING}
          y={layout.viewMapY}
          width={CONTENT_WIDTH}
          text="View on map →"
          fontSize={11}
          fill="#aa3bff"
          onClick={handleViewOnMapClick}
          onTap={handleViewOnMapClick}
        />
      )}
    </Group>
  );
}
