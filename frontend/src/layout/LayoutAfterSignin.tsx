import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import * as boardApi from '../api/board/boardClient';
import { LeftPanel } from './LeftPanel';
import styles from './LayoutAfterSignin.module.scss';
import type { Board } from '../types/board';

export function LayoutAfterSignin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { boardId } = useParams<{ boardId?: string }>();
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    boardApi.listBoards().then(setBoards).catch(() => {});
  }, [location.pathname]);

  // Records membership (idempotent) whenever a board-scoped route is
  // visited — covers both the canvas and map views, and someone arriving
  // fresh via a shared link. Only used by Realtime Authorization, see
  // boardService.joinBoard.
  useEffect(() => {
    if (boardId) boardApi.joinBoard(boardId).catch(() => {});
  }, [boardId]);

  return (
    <div className={styles.shell}>
      <LeftPanel boards={boards} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
