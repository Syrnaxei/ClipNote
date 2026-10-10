import { useEffect, useState } from 'react';
import type { Clipboard, ClipboardItem } from '../types';
import '../components/Sidebar.css';
import './ClipboardEditModal.css';
import './ItemMoveModal.css';

interface ItemMoveModalProps {
  item: ClipboardItem;
  clipboards: Clipboard[];
  onCancel: () => void;
  onMove: (targetClipboardId: number) => Promise<void>;
}

function ItemMoveModal({ item, clipboards, onCancel, onMove }: ItemMoveModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState(false);

  const targets = [...clipboards]
    .filter((c) => c.id !== item.clipboard_id)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = a.latest_item_at ? new Date(a.latest_item_at).getTime() : 0;
      const tb = b.latest_item_at ? new Date(b.latest_item_at).getTime() : 0;
      return tb - ta;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !moving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moving, onCancel]);

  const submit = async () => {
    if (selectedId === null) {
      setError('请选择目标剪切板');
      return;
    }
    setMoving(true);
    setError('');
    try {
      await onMove(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '转移失败，请重试');
      setMoving(false);
    }
  };

  const preview = item.content.length > 60 ? `${item.content.slice(0, 60)}…` : item.content;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !moving && onCancel()}
    >
      <div className="modal-card" role="dialog" aria-modal="true">
        <h3 className="modal-title">转移到…</h3>
        <p className="move-preview">{preview}</p>
        <div className="move-target-list">
          {targets.length === 0 && <p className="move-empty">暂无其他剪切板，请先创建</p>}
          {targets.map((c) => (
            <div
              key={c.id}
              className={`clipboard-card ${selectedId === c.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedId(c.id);
                setError('');
              }}
            >
              <div className="clipboard-info">
                <span className="clipboard-name">{c.name}</span>
                <div className="clipboard-meta">
                  <span className="clipboard-time">
                    {c.latest_item_at
                      ? new Date(c.latest_item_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '暂无内容'}
                  </span>
                  <span className="clipboard-preview">{c.item_count ?? 0} 条</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel} disabled={moving}>
            取消
          </button>
          <button className="modal-confirm" onClick={submit} disabled={moving || selectedId === null}>
            转移
          </button>
        </div>
      </div>
    </div>
  );
}

export default ItemMoveModal;
