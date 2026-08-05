import { useRef, useState, type FormEvent } from 'react';
import * as boardApi from '../../api/boardClient';
import type { BoardCard } from '../../types/board';

const URL_REGEX = /^https?:\/\/\S+$/i;

interface AddCardToolbarProps {
  boardId: string;
  nextPosition: () => { x: number; y: number };
  onCardCreated: (card: BoardCard) => void;
}

export function AddCardToolbar({ boardId, nextPosition, onCardCreated }: AddCardToolbarProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { x, y } = nextPosition();
      const isLink = URL_REGEX.test(text.trim());
      const card = await boardApi.createTextOrLinkCard(boardId, {
        type: isLink ? 'link' : 'text',
        url: isLink ? text.trim() : undefined,
        content: isLink ? undefined : text.trim(),
        positionX: x,
        positionY: y,
      });
      onCardCreated(card);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { x, y } = nextPosition();
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('positionX', String(x));
      formData.append('positionY', String(y));
      const card = await boardApi.createPhotoCard(boardId, formData);
      onCardCreated(card);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="board-toolbar">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Paste a link, or type a note..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          Add
        </button>
      </form>
      <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
        Upload photo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
