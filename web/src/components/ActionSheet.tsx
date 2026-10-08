import { useEffect, type ReactNode } from 'react';
import './ActionSheet.css';

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

function ActionSheet({ open, onClose, title, children }: ActionSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="action-sheet-backdrop" onClick={onClose} />
      <div className="action-sheet" role="dialog" aria-modal="true">
        {title && <div className="action-sheet-title">{title}</div>}
        <div className="action-sheet-actions">{children}</div>
        <button className="action-sheet-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </>
  );
}

export default ActionSheet;
