import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import * as boardApi from '../api/boardClient';
import { TopNavBar } from './TopNavBar';
import { LeftPanel } from './LeftPanel';
import type { Board } from '../types/board';

export function LayoutAfterSignin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    boardApi.listBoards().then(setBoards).catch(() => {});
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <TopNavBar />
      <div className="app-shell-body">
        <LeftPanel boards={boards} />
        <main className="app-shell-main">{children}</main>
      </div>
    </div>
  );
}
