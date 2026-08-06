import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import * as boardApi from '../api/board/boardClient';
import { LeftPanel } from './LeftPanel';
import styles from './LayoutAfterSignin.module.scss';
import type { Board } from '../types/board';

export function LayoutAfterSignin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    boardApi.listBoards().then(setBoards).catch(() => {});
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
      <LeftPanel boards={boards} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
