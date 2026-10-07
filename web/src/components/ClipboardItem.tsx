import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClipboardItem } from '../types';
import { DEVICE_TYPES } from '../types';
import type { ItemActionId, ItemActionSetting } from '../itemActions';
import PopConfirm from './PopConfirm';
import './ClipboardItem.css';

const DEVICE_ICONS: Record<string, ReactNode> = {
  iPhone: (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
      <line x1="12" y1="18" x2="12.01" y2="18"></line>
    </svg>
  ),
  iPad: (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <line x1="12" y1="18" x2="12.01" y2="18"></line>
    </svg>
  ),
  Mac: (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="12" rx="2" ry="2"></rect>
      <path d="M2 19h20"></path>
    </svg>
  ),
  PC: (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  ),
  Web: (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="6" y1="6.5" x2="6.01" y2="6.5"></line>
    </svg>
  ),
  Unknown: (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
};

function DeviceIcon({ type }: { type: string | null }) {
  const key = type
    ? DEVICE_TYPES.find((t) => t.toLowerCase() === type.toLowerCase())
    : undefined;
  return <>{DEVICE_ICONS[key ?? ''] ?? DEVICE_ICONS.Unknown}</>;
}

interface ClipboardItemProps {
  item: ClipboardItem;
  duplicate: boolean;
  pluginName: string | null;
  itemActions: ItemActionSetting;
  onDelete: (id: number) => void;
  onEdit: (id: number, newContent: string) => void;
  onCopy: (content: string) => Promise<boolean>;
  onPlugin: (item: ClipboardItem) => void;
}

function ClipboardItem({
  item,
  duplicate,
  pluginName,
  itemActions,
  onDelete,
  onEdit,
  onCopy,
  onPlugin,
}: ClipboardItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [copied, setCopied] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  useEffect(() => {
    const el = editInputRef.current;
    if (!el) return;
    const prev = el.style.height;
    const prevPx = parseFloat(prev);
    el.style.transition = 'none';
    el.style.height = 'auto';
    const target = Math.min(el.scrollHeight + 2, 320);
    el.style.height = prev;
    void el.offsetHeight;
    el.style.transition = '';
    if (target === prevPx) return;
    el.style.height = `${target}px`;
  }, [editContent, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(item.content);
  };

  const handleSave = async () => {
    await onEdit(item.id, editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(item.content);
  };

  const visibleActions = itemActions.order.filter(
    (id) => !itemActions.hidden.includes(id) && (id !== 'plugin' || pluginName),
  );

  const renderAction = (id: ItemActionId) => {
    switch (id) {
      case 'plugin':
        return (
          <button
            onClick={() => onPlugin(item)}
            className="action-button plugin"
            title={`插件: ${pluginName}`}
            aria-label={`应用插件 ${pluginName}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"></path>
            </svg>
          </button>
        );
      case 'edit':
        return (
          <button onClick={handleEdit} className="action-button edit" title="编辑">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        );
      case 'delete':
        return (
          <PopConfirm title="确定删除这条内容吗？" onConfirm={() => onDelete(item.id)}>
            <button className="action-button delete" title="删除">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </PopConfirm>
        );
      case 'copy':
        return (
          <button
            onClick={async () => {
              if (await onCopy(item.content)) {
                setCopied(true);
                window.clearTimeout(copyTimerRef.current);
                copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
              }
            }}
            className={`action-button copy ${copied ? 'copied' : ''}`}
            title={copied ? '已复制' : '复制'}
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        );
    }
  };

  return (
    <div className={`clipboard-item-content ${duplicate ? 'duplicate' : ''}`}>
      {isEditing ? (
        <div className="edit-mode">
          <textarea
            ref={editInputRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === 'Escape') handleCancel();
            }}
            className="edit-input"
            rows={1}
            autoFocus
          />
          <div className="edit-actions">
            <button onClick={handleSave} className="save-button">保存</button>
            <button onClick={handleCancel} className="cancel-button">取消</button>
          </div>
        </div>
      ) : (
        <div className="view-mode">
          <div className="item-body">
            <span className="content-text">{item.content}</span>
            <div className="item-meta">
              <span className="item-time">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>
                  {new Date(item.created_at).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              {(item.device || item.device_type) && (
                <span className="item-device">
                  <DeviceIcon type={item.device_type} />
                  {item.device && <span className="item-device-name">{item.device}</span>}
                </span>
              )}
            </div>
          </div>
          {visibleActions.length > 0 && (
            <div className="action-buttons">
              {visibleActions.map((id) => (
                <Fragment key={id}>{renderAction(id)}</Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClipboardItem;
