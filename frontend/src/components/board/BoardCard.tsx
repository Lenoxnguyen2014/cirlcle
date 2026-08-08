import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Rect, Text, Label, Tag, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import type { BoardCard as BoardCardType } from '../../types/board';

const CARD_WIDTH = 240;
const PADDING = 24;
const CONTENT_WIDTH = CARD_WIDTH - PADDING * 2;
const PHOTO_HEIGHT = 90;
const GAP = 8;
const MIN_CARD_HEIGHT = 90;

// Matches --accent in index.scss — Konva draws to <canvas>, which can't read
// CSS custom properties, so the value has to be duplicated here as a literal
// rather than referenced via var(--accent). Both forms derive from the same
// value so the border and glow can't drift out of sync with each other.
const ACCENT_COLOR = '#aa3bff';
const ACCENT_GLOW = 'rgba(170, 59, 255, 0.6)';

interface BoardCardProps {
  card: BoardCardType;
  highlighted?: boolean;
  selected: boolean;
  // Color of the day this card is scheduled on (via the map's itinerary),
  // if any — shown as the card's border so a day's color-coding is visible
  // here too, not just on the map.
  dayColor?: string;
  onDragEnd: (id: string, x: number, y: number) => void;
  onViewOnMap: (cardId: string) => void;
  onSelect: (cardId: string) => void;
  onEdit: (cardId: string, type: 'text' | 'link', content: string) => void;
  onEditingChange?: (cardId: string, isEditing: boolean) => void;
  remoteSelectedBy?: { email: string; color: string; isEditing?: boolean }[];
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

export function BoardCard({
  card,
  highlighted,
  selected,
  dayColor,
  onDragEnd,
  onViewOnMap,
  onSelect,
  onEdit,
  onEditingChange,
  remoteSelectedBy,
}: BoardCardProps) {
  const groupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const [isEditing, setIsEditing] = useState(false);

  const locationNames = (card.rawExtractedLocations ?? []).map((l) => l.name).join(', ');
  const isExtracting = card.extractionStatus === 'pending' || card.extractionStatus === 'processing';
  const statusText = isExtracting ? 'Extracting locations...' : locationNames ? `📍 ${locationNames}` : 'No locations found';
  // Text cards never run AI extraction — showing "No locations found" would
  // wrongly imply extraction ran and came up empty. Manual pin cards are
  // still type 'text' but do have a location, so show status for those too.
  const showStatus = card.type !== 'text' || locationNames.length > 0;
  const linkDescription = card.linkMeta?.description || card.content || '';
  const isActive = highlighted || selected;
  const isEditable = card.type === 'text' || card.type === 'link';

  // Animates the selection glow/border in rather than snapping instantly.
  // stroke/shadowColor/shadowBlur are intentionally NOT reactive JSX props
  // on the Rect below — react-konva would re-apply them directly on every
  // render and fight this tween mid-animation, so this effect is the only
  // thing that ever changes them after mount.
  useEffect(() => {
    rectRef.current?.to({
      stroke: isActive ? ACCENT_COLOR : '#e5e4e7',
      shadowColor: isActive ? ACCENT_GLOW : 'rgba(0,0,0,0.45)',
      shadowBlur: isActive ? 18 : 10,
      duration: 0.15,
    });
  }, [isActive]);

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

    // Y cursor, advanced as each optional section below is stacked under it.
    let cursor = contentY + contentHeight;

    let statusY = 0;
    let viewMapY = 0;
    if (showStatus) {
      statusY = cursor + GAP;
      const statusHeight = measureTextHeight(statusText, 11, CONTENT_WIDTH);
      cursor = statusY + statusHeight;

      if (locationNames) {
        viewMapY = cursor + 4;
        cursor = viewMapY + 16; // fixed "View on map →" line height
      }
    }

    let visitDateY = 0;
    if (card.visitDate) {
      visitDateY = cursor + GAP;
      cursor = visitDateY + measureTextHeight(`Visited: ${card.visitDate}`, 11, CONTENT_WIDTH);
    }

    const totalHeight = Math.max(cursor + PADDING, MIN_CARD_HEIGHT);

    return { contentY, descY, contentHeight, statusY, viewMapY, visitDateY, totalHeight };
  }, [
    card.type,
    card.content,
    card.linkMeta?.title,
    card.visitDate,
    linkDescription,
    statusText,
    locationNames,
    showStatus,
  ]);

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

    onEditingChange?.(card.id, true);

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
      outline: `2px solid ${ACCENT_COLOR}`,
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
      onEditingChange?.(card.id, false);
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
        ref={rectRef}
        width={CARD_WIDTH}
        height={layout.totalHeight}
        fill="#ffffff"
        // Baseline/inactive values only — the effect above animates these
        // via Konva's own tweening once isActive changes.
        stroke="#e5e4e7"
        hitStrokeWidth={0.5}
        cornerRadius={2}
        shadowColor="rgba(0,0,0,0.45)"
        shadowBlur={10}
      />

      {/* Day-color accent — a separate strip rather than the card's own
          stroke, so it stays visible alongside the selection outline instead
          of competing with it for the same border. */}
      {dayColor && (
        <Rect width={6} height={layout.totalHeight} fill={dayColor} cornerRadius={[10, 0, 0, 10]} />
      )}

      {/* Other users' live selection — concentric outline + name badge per
          selector, in their own presence color, so it reads distinctly from
          this client's own purple selection outline above. */}
      {remoteSelectedBy?.map((sel, i) => (
        <Group key={`${sel.email}-${i}`} listening={false}>
          <Rect
            x={-4 - i * 4}
            y={-4 - i * 4}
            width={CARD_WIDTH + 8 + i * 8}
            height={layout.totalHeight + 8 + i * 8}
            stroke={sel.color}
            strokeWidth={2}
            cornerRadius={12}
          />
          <Label x={-4 - i * 4} y={-22 - i * 4}>
            <Tag fill={sel.color} cornerRadius={4} />
            <Text
              text={`${sel.email.split('@')[0] || 'Guest'}${sel.isEditing ? ' is writing...' : ''}`}
              fontSize={10}
              fill="#fff"
              padding={3}
            />
          </Label>
        </Group>
      ))}

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
        <Text x={PADDING} y={layout.statusY} width={CONTENT_WIDTH} text={statusText} fontSize={11} fill={ACCENT_COLOR} wrap="word" />
      )}

      {showStatus && locationNames && (
        <Text
          x={PADDING}
          y={layout.viewMapY}
          width={CONTENT_WIDTH}
          text="View on map →"
          fontSize={11}
          fill={ACCENT_COLOR}
          onClick={handleViewOnMapClick}
          onTap={handleViewOnMapClick}
        />
      )}

      {card.visitDate && (
        <Text
          x={PADDING}
          y={layout.visitDateY}
          width={CONTENT_WIDTH}
          text={`date: ${card.visitDate}`}
          fontSize={11}
          fill="#6b6375"
          wrap="word"
        />
      )}
    </Group>
  );
}
