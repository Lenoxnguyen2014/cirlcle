import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import styles from './ShareBoardButton.module.scss';

export function ShareBoardButton({ boardId }: { boardId: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}/boards/${boardId}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      aria-label="Copy share link"
      title={copied ? 'Copied!' : 'Copy share link'}
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
    </button>
  );
}
