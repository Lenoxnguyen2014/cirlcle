import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

function getInitials(user: { firstName?: string; lastName?: string; email: string } | null): string {
  if (!user) return '?';
  if (user.firstName || user.lastName) {
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  }
  return user.email[0]?.toUpperCase() ?? '?';
}

export function TopNavBar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="top-nav">
      <span className="top-nav-title">PlanA</span>
      <div className="profile-menu-container" ref={menuRef}>
        <button
          type="button"
          className="profile-avatar"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Account menu"
        >
          {getInitials(user)}
        </button>
        {menuOpen && (
          <div className="profile-menu">
            <button type="button" onClick={() => logout()}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
