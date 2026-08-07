import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import * as boardApi from '../../api/board/boardClient';
import { supabaseClient } from '../../lib/supabaseClient';
import { mapRowToBoardLocation } from '../../utils/mapRow';
import styles from './MapPage.module.scss';
import type { BoardLocation } from '../../types/board';

// Vite doesn't resolve Leaflet's default marker icon paths out of the box.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function FitBounds({ locations }: { locations: BoardLocation[] }) {
  const map = useMap();

  useEffect(() => {
    const points = locations.filter((l) => l.lat != null && l.lng != null).map((l) => [l.lat!, l.lng!] as [number, number]);
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [locations, map]);

  return null;
}

function FlyToCard({ locations, cardId }: { locations: BoardLocation[]; cardId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!cardId) return;
    const location = locations.find((l) => l.cardId === cardId && l.lat != null && l.lng != null);
    if (location) {
      map.flyTo([location.lat!, location.lng!], 10);
    }
  }, [cardId, locations, map]);

  return null;
}

export function MapPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const focusCardId = searchParams.get('cardId');

  const [locations, setLocations] = useState<BoardLocation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;

    const fetchLocations = () =>
      boardApi
        .listBoardLocations(boardId)
        .then(setLocations)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load locations'));

    // Same reasoning as InteractiveBoardPage's card subscription: re-fetch on
    // every (re)connect, since postgres_changes never replays events missed
    // while the socket was briefly disconnected.
    fetchLocations();

    const channel = supabaseClient
      .channel(`board-locations-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_locations', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setLocations((prev) => prev.filter((l) => l.id !== (payload.old as any).id));
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
  }, [boardId]);

  if (!boardId) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to={`/boards/${boardId}`}>View board</Link>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {locations.length === 0 ? (
        <p>No locations pinned yet — add cards on the board and they'll show up here.</p>
      ) : (
        <MapContainer
          center={[locations[0].lat!, locations[0].lng!]}
          zoom={4}
          className={styles.mapContainer}
          key={boardId}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations
            .filter((l) => l.lat != null && l.lng != null)
            .map((location) => (
              <Marker key={location.id} position={[location.lat!, location.lng!]}>
                <Popup>
                  <strong>{location.name}</strong>
                  <br />
                  <Link to={`/boards/${boardId}?cardId=${location.cardId}`}>View card</Link>
                </Popup>
              </Marker>
            ))}
          <FitBounds locations={locations} />
          <FlyToCard locations={locations} cardId={focusCardId} />
        </MapContainer>
      )}
    </div>
  );
}
