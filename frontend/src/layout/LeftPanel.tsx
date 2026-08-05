import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Board } from '../types/board';

interface LeftPanelProps {
  boards: Board[];
}

export function LeftPanel({ boards }: LeftPanelProps) {
  const { boardId } = useParams<{ boardId?: string }>();
  const navigate = useNavigate();

  return (
    <nav className="left-panel">
      <Link to="/" className="left-panel-home">
        Boards
      </Link>
      <ul className="left-panel-list">
        {boards.map((board) => (
          <li key={board.id} className="left-panel-row">
            <button
              type="button"
              className={`left-panel-board-item${board.id === boardId ? ' active' : ''}`}
              onClick={() => navigate(`/boards/${board.id}`)}
            >
              {board.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
