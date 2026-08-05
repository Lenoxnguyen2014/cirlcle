import type { Board, BoardCard, BoardLocation } from '../types/board';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const STORAGE_KEY = 'board_auth';

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });
  } catch {
    throw new Error('Network error: unable to reach the backend');
  }

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    throw new Error('Unauthorized');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return body.data as T;
}

export const createBoard = (name: string) =>
  request<Board>('/boards', { method: 'POST', body: JSON.stringify({ name }) });

export const listBoards = () => request<Board[]>('/boards');

export const getBoard = (boardId: string) => request<Board>(`/boards/${boardId}`);

export const listBoardCards = (boardId: string) => request<BoardCard[]>(`/boards/${boardId}/cards`);

export const createTextOrLinkCard = (
  boardId: string,
  payload: { type: 'text' | 'link'; content?: string; url?: string; positionX: number; positionY: number }
) => request<BoardCard>(`/boards/${boardId}/cards`, { method: 'POST', body: JSON.stringify(payload) });

export const createPhotoCard = (boardId: string, formData: FormData) =>
  request<BoardCard>(`/boards/${boardId}/cards/photo`, { method: 'POST', body: formData });

export const updateCardPosition = (boardId: string, cardId: string, x: number, y: number) =>
  request<void>(`/boards/${boardId}/cards/${cardId}/position`, {
    method: 'PATCH',
    body: JSON.stringify({ x, y }),
  });

export const deleteCard = (boardId: string, cardId: string) =>
  request<void>(`/boards/${boardId}/cards/${cardId}`, { method: 'DELETE' });

export const listBoardLocations = (boardId: string) => request<BoardLocation[]>(`/boards/${boardId}/locations`);
