import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import ColorPicker from 'colorpicker/dist/colorpicker.js';
import 'colorpicker/dist/colorpicker.css';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import * as boardApi from '../../api/board/boardClient';
import { GOOGLE_MAPS_API_KEY } from '../../config/loadEnv';
import { useBoardMapViewContext } from './context';
import styles from './MapView.module.scss';
import type { BoardCard, BoardLocation } from '../../types/board';

// Google-provided Map ID for prototyping Advanced Markers without
// registering a custom one in Cloud Console — fine for now, swap for a real
// Map ID later if the map needs custom styling.
const DEMO_MAP_ID = 'DEMO_MAP_ID';

function FitBounds({ locations }: { locations: BoardLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const points = locations.filter((l) => l.lat != null && l.lng != null);
    if (points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach((l) => bounds.extend({ lat: l.lat!, lng: l.lng! }));
    map.fitBounds(bounds, 40);
  }, [locations, map]);

  return null;
}

function FlyToCard({ locations, cardId }: { locations: BoardLocation[]; cardId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !cardId) return;
    const location = locations.find((l) => l.cardId === cardId && l.lat != null && l.lng != null);
    if (location) {
      map.panTo({ lat: location.lat!, lng: location.lng! });
      map.setZoom(10);
    }
  }, [cardId, locations, map]);

  return null;
}

// Click a pin to select it (highlighted purple); Delete/Backspace removes
// whichever card is currently selected — same click-to-select,
// key-to-delete pattern as the interactive board.
function PlaceMarker({
  location,
  selected,
  color,
  onSelect,
}: {
  location: BoardLocation;
  selected: boolean;
  color?: string;
  onSelect: (cardId: string) => void;
}) {
  return (
    <AdvancedMarker
      position={{ lat: location.lat!, lng: location.lng! }}
      title={location.name}
      onClick={() => onSelect(location.cardId)}
    >
      {/* Always render a Pin (rather than conditionally including one) so
          toggling `selected` reliably restyles it instead of swapping
          between "custom content" and "no content" (which AdvancedMarker
          treats differently — the latter falls back to its own default).
          `selected` (interaction state) always wins over the day's color
          (a data property) so the delete/select feedback stays legible. */}
      <Pin
        background={selected ? '#aa3bff' : color}
        borderColor={selected ? '#7a15c9' : color}
        glyphColor={selected ? '#fff' : color ? '#fff' : undefined}
      />
    </AdvancedMarker>
  );
}

interface DraftPin {
  lat: number;
  lng: number;
  name: string;
}

// A remote user's live pointer, broadcast in lat/lng (rather than Konva's
// world-pixel space) — every viewer's own Google Map projects it correctly
// with no extra math needed here.
function RemoteCursorMarker({ lat, lng, email, color }: { lat: number; lng: number; email: string; color: string }) {
  const label = email?.split('@')[0] || 'Guest';

  return (
    <AdvancedMarker position={{ lat, lng }} zIndex={1000}>
      <div className={styles.remoteCursor}>
        <span className={styles.remoteCursorDot} style={{ background: color }} />
        <span className={styles.remoteCursorLabel} style={{ background: color }}>
          {label}
        </span>
      </div>
    </AdvancedMarker>
  );
}

function cardLabel(card: BoardCard): string {
  if (card.type === 'photo') return 'Photo';
  if (card.type === 'link') return card.linkMeta?.title || card.content || 'Link';
  return card.content || 'Untitled note';
}

const UNSCHEDULED = 'unscheduled';

// Quick-pick colors offered inside the picker's swatch row — the gradient
// picker next to them covers anything outside this set.
const DAY_COLOR_PRESETS = [
  '#e63946',
  '#f4a261',
  '#e9c46a',
  '#2a9d8f',
  '#457b9d',
  '#aa3bff',
  '#f72585',
  '#06d6a0',
];

// Thin React wrapper around the vanilla-JS ColorPicker library — it binds
// itself to a real DOM element (here, a small swatch button) and manages its
// own popup dialog, so this just handles the instantiate/destroy lifecycle
// and bridges its 'pick' event back into React state.
function DayColorPicker({ color, onChange }: { color?: string; onChange: (color: string) => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<ColorPicker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!buttonRef.current) return;
    const picker = new ColorPicker(buttonRef.current, {
      color: color ?? '#aa3bff',
      swatches: DAY_COLOR_PRESETS,
      formats: ['hex'],
      submitMode: 'instant',
    });
    // `.on` is inherited from the library's own EventEmitter<...> base class,
    // which TS can't quite resolve against this project's @types/node
    // version — cast narrowly here rather than losing types on the picker
    // instance everywhere else it's used.
    (picker as unknown as { on(event: 'pick', cb: (color: { string(format: string): string } | null) => void): void }).on(
      'pick',
      (picked) => {
        if (picked) onChangeRef.current(picked.string('hex'));
      }
    );
    pickerRef.current = picker;
    return () => picker.destroy();
    // Only re-create on mount — `color` changes are pushed via setColor()
    // below instead, so picking doesn't tear down/reopen the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (color) pickerRef.current?.setColor(color, false);
  }, [color]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.colorSwatch}
      style={{ background: color ?? 'transparent' }}
      aria-label="Set day color"
    />
  );
}

// Groups cards by their assigned day, dated groups first (chronological),
// undated cards collected in a trailing "Unscheduled" bucket. extraDates are
// dates the user created via the "+ Add date" button that don't have any
// cards assigned yet — they still need to render as an (empty) drop target.
function buildDayGroups(cards: BoardCard[], extraDates: string[]): { date: string | null; cards: BoardCard[] }[] {
  // A plain object here, not the built-in Map class — `Map` in this file's
  // scope refers to the Google Maps <Map> component imported above.
  const byDate: Record<string, BoardCard[]> = {};
  for (const card of cards) {
    const key = card.visitDate ?? UNSCHEDULED;
    (byDate[key] ??= []).push(card);
  }
  for (const date of extraDates) {
    byDate[date] ??= [];
  }

  const dated = Object.keys(byDate)
    .filter((key) => key !== UNSCHEDULED)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({ date, cards: byDate[date] }));

  // Always shown, even empty — it's the only way to drag a card back off a
  // day once it's been scheduled.
  return [...dated, { date: null, cards: byDate[UNSCHEDULED] ?? [] }];
}

function DraggableCardRow({
  card,
  pinned,
  selected,
  onSelect,
}: {
  card: BoardCard;
  pinned: boolean;
  selected: boolean;
  onSelect: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });

  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={selected ? `${styles.itineraryRow} ${styles.itineraryRowSelected}` : styles.itineraryRow}
      onClick={() => onSelect(card.id)}
    >
      {pinned ? '📍 ' : ''}
      {cardLabel(card)}
    </div>
  );
}

function DaySection({
  date,
  cards,
  color,
  onColorChange,
  pinnedCardIds,
  selectedCardId,
  onSelectCard,
}: {
  date: string | null;
  cards: BoardCard[];
  color?: string;
  onColorChange: (date: string, color: string) => void;
  pinnedCardIds: Set<string>;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date ?? UNSCHEDULED });

  return (
    <div
      ref={setNodeRef}
      style={color ? { borderLeftColor: color, borderLeftWidth: 4 } : undefined}
      className={isOver ? `${styles.itineraryGroup} ${styles.itineraryGroupOver}` : styles.itineraryGroup}
    >
      <div className={styles.itineraryGroupHeader}>
        <h3 className={styles.itineraryGroupTitle}>{date ?? 'Unscheduled'}</h3>
        {/* Unscheduled has no date to key a color by, so no swatch there. */}
        {date && <DayColorPicker color={color} onChange={(picked) => onColorChange(date, picked)} />}
      </div>
      {cards.map((card) => (
        <DraggableCardRow
          key={card.id}
          card={card}
          pinned={pinnedCardIds.has(card.id)}
          selected={selectedCardId === card.id}
          onSelect={onSelectCard}
        />
      ))}
      {cards.length === 0 && <p className={styles.itineraryGroupEmpty}>Drop a card here</p>}
    </div>
  );
}

function AddDateControl({ onAdd }: { onAdd: (date: string) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className={styles.addDateButton} onClick={() => setOpen(true)}>
        + Add date
      </button>
    );
  }

  return (
    <input
      type="date"
      autoFocus
      className={styles.addDateInput}
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
        setOpen(false);
      }}
      onBlur={() => setOpen(false)}
    />
  );
}

interface ItineraryListProps {
  cards: BoardCard[];
  locations: BoardLocation[];
  extraDates: string[];
  onAddDate: (date: string) => void;
  dayColors: Record<string, string>;
  onDayColorChange: (date: string, color: string) => void;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onCardDateChange: (cardId: string, visitDate: string | null) => void;
}

function ItineraryList({
  cards,
  locations,
  extraDates,
  onAddDate,
  dayColors,
  onDayColorChange,
  selectedCardId,
  onSelectCard,
  onCardDateChange,
}: ItineraryListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const groups = buildDayGroups(cards, extraDates);
  const pinnedCardIds = new Set(locations.map((l) => l.cardId));

  const handleDragEnd = (event: DragEndEvent) => {
    const targetKey = event.over?.id;
    if (targetKey == null) return;
    const cardId = String(event.active.id);
    onCardDateChange(cardId, targetKey === UNSCHEDULED ? null : String(targetKey));
  };

  return (
    <div className={styles.itineraryList}>
      <AddDateControl onAdd={onAddDate} />
      {cards.length === 0 ? (
        <p className={styles.itineraryEmpty}>No cards on this board yet.</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {groups.map((group) => (
            <DaySection
              key={group.date ?? UNSCHEDULED}
              date={group.date}
              cards={group.cards}
              color={group.date ? dayColors[group.date] : undefined}
              onColorChange={onDayColorChange}
              pinnedCardIds={pinnedCardIds}
              selectedCardId={selectedCardId}
              onSelectCard={onSelectCard}
            />
          ))}
        </DndContext>
      )}
    </div>
  );
}

export function MapView() {
  const {
    boardId,
    cards,
    setCardDate,
    deleteCard,
    undoDelete,
    remoteCursors,
    sendCursor,
    locations,
    locationsError,
    fetchLocations,
    dayColors,
    setDayColor,
  } = useBoardMapViewContext();

  const [searchParams] = useSearchParams();
  const focusCardId = searchParams.get('cardId');

  const [error, setError] = useState<string | null>(null);
  const [draftPin, setDraftPin] = useState<DraftPin | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(focusCardId);
  // Dates the user created via "+ Add date" that don't have any cards
  // dragged onto them yet — purely a local UI affordance, not persisted;
  // once a card lands on one it becomes a real group driven by the card's
  // own visitDate.
  const [extraDates, setExtraDates] = useState<string[]>([]);

  const handleAddDate = useCallback((date: string) => {
    setExtraDates((prev) => (prev.includes(date) ? prev : [...prev, date]));
  }, []);

  // Picks up deep links into a specific card (e.g. from the board's "View
  // on map" link) even if this view was already mounted.
  useEffect(() => {
    if (focusCardId) setSelectedCardId(focusCardId);
  }, [focusCardId]);

  // Ctrl/Cmd+Z undoes the last card this client deleted; Delete/Backspace
  // removes whichever pin/card is currently selected — same pattern as the
  // interactive board's delete/undo. Deleting also directly re-fetches
  // locations once the delete lands, rather than waiting on the
  // board_locations Realtime DELETE event, which doesn't reliably arrive.
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
        const cardId = selectedCardId;
        setSelectedCardId(null);
        Promise.resolve(deleteCard(cardId)).then(fetchLocations);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoDelete, deleteCard, selectedCardId, fetchLocations]);

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const latLng = e.detail.latLng;
    if (!latLng) return;
    setDraftPin({ lat: latLng.lat, lng: latLng.lng, name: '' });
  }, []);

  // Broadcasts this user's pointer in lat/lng — sendCursor itself throttles,
  // so no extra debouncing needed here.
  const handleMapMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const latLng = e.detail.latLng;
      if (!latLng) return;
      sendCursor(latLng.lat, latLng.lng);
    },
    [sendCursor]
  );

  const handleConfirmPin = async () => {
    if (!draftPin || !boardId) return;
    setSavingPin(true);
    try {
      await boardApi.createPin(boardId, {
        name: draftPin.name.trim() || undefined,
        lat: draftPin.lat,
        lng: draftPin.lng,
      });
      // The real pin arrives via the postgres_changes subscription in
      // BoardMapViewPage — same subscription-driven pattern used everywhere
      // else in this codebase.
      setDraftPin(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pin');
    } finally {
      setSavingPin(false);
    }
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return <p className="auth-error">Missing VITE_GOOGLE_MAPS_API_KEY — set it in frontend/.env to load the map.</p>;
  }

  const firstKnownLocation = locations.find((l) => l.lat != null && l.lng != null);

  // Resolves a pin's color via its card's assigned day — same cross-reference
  // pattern pinnedCardIds already uses (location -> cardId -> card). A plain
  // object here, not the built-in Map class — see buildDayGroups above.
  const cardById: Record<string, BoardCard> = Object.fromEntries(cards.map((card) => [card.id, card]));
  const colorForLocation = (location: BoardLocation): string | undefined => {
    const visitDate = cardById[location.cardId]?.visitDate;
    return visitDate ? dayColors[visitDate] : undefined;
  };

  return (
    <>
      {(error || locationsError) && <p className="auth-error">{error || locationsError}</p>}

      <div className={styles.splitContainer}>
        <div className={styles.mapPane}>
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <Map
              className={styles.mapContainer}
              mapId={DEMO_MAP_ID}
              defaultCenter={
                firstKnownLocation
                  ? { lat: firstKnownLocation.lat!, lng: firstKnownLocation.lng! }
                  : { lat: 20, lng: 0 }
              }
              defaultZoom={firstKnownLocation ? 4 : 2}
              gestureHandling="greedy"
              onClick={handleMapClick}
              onMousemove={handleMapMouseMove}
            >
              {locations
                .filter((l) => l.lat != null && l.lng != null)
                .map((location) => (
                  <PlaceMarker
                    key={location.id}
                    location={location}
                    selected={selectedCardId === location.cardId}
                    color={colorForLocation(location)}
                    onSelect={setSelectedCardId}
                  />
                ))}

              {Object.values(remoteCursors).map((cursor) => (
                <RemoteCursorMarker key={cursor.userId} lat={cursor.x} lng={cursor.y} email={cursor.email} color={cursor.color} />
              ))}

              {draftPin && (
                <>
                  <AdvancedMarker position={{ lat: draftPin.lat, lng: draftPin.lng }} />
                  <InfoWindow
                    position={{ lat: draftPin.lat, lng: draftPin.lng }}
                    onCloseClick={() => setDraftPin(null)}
                  >
                    <div className={styles.pinForm}>
                      <input
                        autoFocus
                        className={styles.pinFormInput}
                        value={draftPin.name}
                        placeholder="Name this place"
                        onChange={(e) => setDraftPin({ ...draftPin, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmPin();
                          if (e.key === 'Escape') setDraftPin(null);
                        }}
                      />
                      <div className={styles.pinFormActions}>
                        <button type="button" onClick={() => setDraftPin(null)}>
                          Cancel
                        </button>
                        <button type="button" onClick={handleConfirmPin} disabled={savingPin}>
                          {savingPin ? 'Adding…' : 'Add pin'}
                        </button>
                      </div>
                    </div>
                  </InfoWindow>
                </>
              )}

              <FitBounds locations={locations} />
              <FlyToCard locations={locations} cardId={selectedCardId} />
            </Map>
          </APIProvider>
        </div>

        <div className={styles.itineraryPane}>
          <ItineraryList
            cards={cards}
            locations={locations}
            extraDates={extraDates}
            onAddDate={handleAddDate}
            dayColors={dayColors}
            onDayColorChange={setDayColor}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            onCardDateChange={setCardDate}
          />
        </div>
      </div>
    </>
  );
}
