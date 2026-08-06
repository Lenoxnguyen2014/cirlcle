import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import * as boardApi from '../api/board/boardClient';
import { useAuth } from '../context/AuthContext';
import styles from './LeftPanel.module.scss';
import type { Board } from '../types/board';

const COLLAPSED_STORAGE_KEY = 'left_panel_collapsed';

function getUserInitials(user: { firstName?: string; lastName?: string; email: string } | null): string {
  if (!user) return '?';
  if (user.firstName || user.lastName) {
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  }
  return user.email[0]?.toUpperCase() ?? '?';
}

function getBoardInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

interface LeftPanelProps {
  boards: Board[];
}

export function LeftPanel({ boards }: LeftPanelProps) {
  const { boardId } = useParams<{ boardId?: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  const expandAndFocusInput = () => {
    setCollapsed(false);
    localStorage.setItem(COLLAPSED_STORAGE_KEY, 'false');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const board = await boardApi.createBoard(name.trim());
      setName('');
      setError(null);
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
    }
  };

  return (
    <nav className={`${styles.panel}${collapsed ? ` ${styles.collapsed}` : ''}`}>
      <div className={styles.scrollArea}>
        <div className={styles.top}>
          {!collapsed && (
            <Link to="/" className={styles.home}>
              Boards
            </Link>
          )}
          <button
            type="button"
            className={styles.toggle}
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            title={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {collapsed ? (
          <button
            type="button"
            className={styles.iconButton}
            onClick={expandAndFocusInput}
            aria-label="Create board"
            title="Create board"
          >
            <Plus size={18} />
          </button>
        ) : (
          <>
            <form className={styles.createForm} onSubmit={handleCreate}>
              <input
                ref={inputRef}
                type="text"
                placeholder="New board name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit">Create board</button>
            </form>
            {error && <p className="auth-error">{error}</p>}
          </>
        )}

        <ul className={styles.list}>
          {boards.map((board) => {
            const active = board.id === boardId;
            return (
              <li key={board.id} className={styles.row}>
                {collapsed ? (
                  <button
                    type="button"
                    className={`${styles.boardIcon}${active ? ` ${styles.active}` : ''}`}
                    onClick={() => navigate(`/boards/${board.id}`)}
                    title={board.name}
                  >
                    {getBoardInitials(board.name)}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${styles.boardItem}${active ? ` ${styles.active}` : ''}`}
                      onClick={() => navigate(`/boards/${board.id}`)}
                    >
                      {board.name}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.bottom} ref={menuRef}>
        <button
          type="button"
          className={styles.avatar}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Account menu"
        >
          {getUserInitials(user)}
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            <button type="button" onClick={() => logout()}>
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
