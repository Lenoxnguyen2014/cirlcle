import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseClient } from '../../lib/supabaseClient';
import { colorForUser } from '../../utils/presenceColor';
import type { AuthUser } from '../../types/auth';
import type { RemoteCursorState } from '../../types/remoteCursor';
import type { RemoteSelectionState } from '../../types/remoteSelection';

const CURSOR_BROADCAST_INTERVAL_MS = 50;

interface PresenceUser {
  userId: string;
  email: string;
  color: string;
}

// Owns the board's presence channel: live cursors, live selection/editing
// highlights, and "who's online" — all ephemeral pub/sub state that never
// touches Postgres, scoped to `presence-<boardId>`. Coordinate-space-agnostic
// on purpose — sendCursor just broadcasts whatever x/y it's given, so both
// the Konva canvas (world pixel space) and the Google Map (lat/lng space)
// can reuse this without either one leaking into the other.
export function usePresence(boardId: string | undefined, user: AuthUser | null) {
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursorState>>({});
  const [remoteSelections, setRemoteSelections] = useState<Record<string, RemoteSelectionState>>({});
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const lastCursorSentRef = useRef(0);

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

  // Broadcasts this user's current selection (or null to clear it), plus
  // whether they're actively editing it — so other viewers can highlight the
  // same card in this user's presence color, with a "is writing..." badge
  // while they're mid-edit.
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

  // Throttled broadcast of this user's pointer. Takes coordinates directly
  // rather than reading them from a specific rendering surface — the caller
  // decides what x/y mean (Konva world-pixel space, Google Maps lat/lng,
  // etc.) and every viewer's own page interprets it the same way back.
  const sendCursor = useCallback(
    (x: number, y: number) => {
      const channel = presenceChannelRef.current;
      if (!channel || !user) return;

      const now = Date.now();
      if (now - lastCursorSentRef.current < CURSOR_BROADCAST_INTERVAL_MS) return;
      lastCursorSentRef.current = now;

      channel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: { userId: user.id, x, y, email: user.email, color: colorForUser(user.id) },
      });
    },
    [user]
  );

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

  return { remoteCursors, onlineUsers, remoteSelectionsByCard, broadcastSelection, sendCursor };
}
