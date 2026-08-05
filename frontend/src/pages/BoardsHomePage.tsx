import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as boardApi from '../api/boardClient';

export function BoardsHomePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const board = await boardApi.createBoard(name.trim());
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
    }
  };

  return (
    <div className="boards-home">
      <h1>Create a board</h1>
      <p>Start a new board, or pick one from the left to jump back in.</p>
      <form className="boards-create-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New board name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Create board</button>
      </form>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
