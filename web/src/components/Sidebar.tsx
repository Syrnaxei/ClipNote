import { useState } from 'react';
import type { Clipboard } from '../types';
import type { PinStyle } from '../pinStyle';
import './Sidebar.css';

interface SidebarProps {
  clipboards: Clipboard[];
  activeId: number | null;
  collapsed: boolean;
  pinStyle: PinStyle;
  onSelectClipboard: (id: number) => void;
  onAddClipboard: (name: string) => Promise<void>;
  onRequestClose?: () => void;
}

function Sidebar({
  clipboards,
  activeId,
  collapsed,
  pinStyle,
  onSelectClipboard,
  onAddClipboard,
  onRequestClose,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getTime = (clipboard: Clipboard) =>
    clipboard.latest_item_at ? new Date(clipboard.latest_item_at).getTime() : 0;

  const filtered = clipboards
    .filter((clipboard) =>
      clipboard.name.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return getTime(b) - getTime(a);
    });

  const openForm = () => {
    setAdding(true);
    setNewName('');
    setError('');
  };

  const closeForm = () => {
    setAdding(false);
    setNewName('');
    setError('');
  };

  const submitNewClipboard = async () => {
    const name = newName.trim();
    if (!name) {
      setError('请输入剪切板名称');
      return;
    }
    if (
      clipboards.some((c) => c.name.toLowerCase() === name.toLowerCase())
    ) {
      setError('已存在同名剪切板');
      return;
    }
    setSubmitting(true);
    try {
      await onAddClipboard(name);
      closeForm();
    } catch {
      setError('创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {!collapsed && onRequestClose && (
        <div className="sidebar-backdrop" onClick={onRequestClose} />
      )}
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-inner">
        <div className="search-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="搜索剪切板"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="clipboard-list">
          {filtered.length === 0 && (
            <div className="sidebar-empty">
              {clipboards.length === 0 ? '还没有剪切板' : '没有匹配的结果'}
            </div>
          )}
          {filtered.map((clipboard) => (
            <div
              key={clipboard.id}
              className={`clipboard-card ${
                clipboard.pinned ? `pin-${pinStyle}` : ''
              } ${activeId === clipboard.id ? 'active' : ''}`}
              onClick={() => onSelectClipboard(clipboard.id)}
            >
              <div className="clipboard-info">
                <span className="clipboard-name">
                  {clipboard.name}
                </span>
                <div className="clipboard-meta">
                  <span className="clipboard-time">
                    {clipboard.latest_item_at
                      ? new Date(clipboard.latest_item_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '暂无内容'}
                  </span>
                  <span className="clipboard-preview">
                    {clipboard.item_count ?? 0} 条
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="add-clipboard-section">
          {adding ? (
            <div className="add-clipboard-form">
              <input
                className="add-clipboard-input"
                placeholder="剪切板名称"
                value={newName}
                maxLength={255}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNewClipboard();
                  if (e.key === 'Escape') closeForm();
                }}
                autoFocus
              />
              {error && <div className="add-clipboard-error">{error}</div>}
              <div className="add-clipboard-actions">
                <button
                  className="confirm-add-clipboard"
                  onClick={submitNewClipboard}
                  disabled={submitting}
                >
                  创建
                </button>
                <button className="cancel-add-clipboard" onClick={closeForm}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button className="add-button" onClick={openForm}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              新建剪切板
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

export default Sidebar;
