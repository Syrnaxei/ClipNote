import { useEffect, useRef, useState } from 'react';
import type { Clipboard, ClipboardItem, DuplicateGroup, Plugin } from '../types';
import type { ItemActionSetting } from '../itemActions';
import ClipboardItemView from './ClipboardItem';
import ClipboardEditModal from './ClipboardEditModal';
import PluginConfirmModal from './PluginConfirmModal';
import PopConfirm from './PopConfirm';
import './ClipboardList.css';

interface ClipboardListProps {
  clipboard: Clipboard | null;
  items: ClipboardItem[];
  loading: boolean;
  dupGroups: DuplicateGroup[] | null;
  activePlugin: Plugin | null;
  itemActions: ItemActionSetting;
  onAddItem: (content: string) => void;
  onDeleteItem: (id: number) => void;
  onEditItem: (id: number, newContent: string) => void;
  onCopyItem: (content: string) => Promise<boolean>;
  onPluginApply: (item: ClipboardItem, result: string, pluginName: string) => Promise<void>;
  onCheckDuplicates: () => void;
  onClearDuplicates: () => void;
  onDeleteClipboard: (id: number) => void;
  onUpdateClipboard: (id: number, data: { name: string; uuid: string }) => Promise<void>;
  onTogglePinned: (id: number, pinned: boolean) => Promise<void>;
}

function ClipboardList({
  clipboard,
  items,
  loading,
  dupGroups,
  activePlugin,
  itemActions,
  onAddItem,
  onDeleteItem,
  onEditItem,
  onCopyItem,
  onPluginApply,
  onCheckDuplicates,
  onClearDuplicates,
  onDeleteClipboard,
  onUpdateClipboard,
  onTogglePinned,
}: ClipboardListProps) {
  const [expanded, setExpanded] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [pluginTarget, setPluginTarget] = useState<ClipboardItem | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const addItemInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (actionsRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setEditModalOpen(false);
  }, [clipboard?.id]);

  useEffect(() => {
    const el = addItemInputRef.current;
    if (!el) return;
    const prev = el.style.height;
    const prevPx = parseFloat(prev);
    if (expanded) {
      if (prevPx === 176) return;
      el.style.height = '176px';
      return;
    }
    el.style.transition = 'none';
    el.style.height = 'auto';
    const target = Math.min(el.scrollHeight + 2, 176);
    el.style.height = prev;
    void el.offsetHeight;
    el.style.transition = '';
    if (target === prevPx) return;
    el.style.height = `${target}px`;
  }, [newContent, expanded]);

  const submitNewItem = () => {
    const content = newContent.trim();
    if (!content || clipboard === null) return;
    onAddItem(content);
    setNewContent('');
    setExpanded(false);
  };

  const duplicateIds = new Set(
    dupGroups?.flatMap((group) => group.items.map((item) => item.id)) ?? [],
  );

  return (
    <div className="clipboard-list-container">
      <div className="clipboard-list-header">
        <h2>{clipboard?.name ?? '未选择剪切板'}</h2>
        {clipboard !== null && (
          <div className={`header-actions ${menuOpen ? 'open' : ''}`} ref={actionsRef}>
            <button
              className="menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              title={menuOpen ? '收起' : '更多操作'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8"></circle>
                <circle cx="12" cy="12" r="1.8"></circle>
                <circle cx="19" cy="12" r="1.8"></circle>
              </svg>
            </button>
            <button
              className={`menu-action pin ${clipboard.pinned ? 'active' : ''}`}
              onClick={() => {
                onTogglePinned(clipboard.id, !clipboard.pinned);
                setMenuOpen(false);
              }}
              title={clipboard.pinned ? '取消置顶' : '置顶'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5"></path>
                <path d="M9 10.76V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3.76a2 2 0 0 0 .59 1.42l1.82 1.82a1 1 0 0 1-.71 1.71H7.3a1 1 0 0 1-.71-1.71l1.82-1.82a2 2 0 0 0 .59-1.42z"></path>
              </svg>
            </button>
            <button
              className="menu-action check"
              onClick={() => {
                onCheckDuplicates();
                setMenuOpen(false);
              }}
              title="检查重复"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button
              className="menu-action info"
              onClick={() => {
                setEditModalOpen(true);
                setMenuOpen(false);
              }}
              title="信息"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
            <PopConfirm
              title={`确定删除剪切板「${clipboard.name}」吗？其中的所有条目都会被删除。`}
              onConfirm={() => onDeleteClipboard(clipboard.id)}
            >
              <button className="menu-action delete" title="删除">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </PopConfirm>
          </div>
        )}
      </div>

      {dupGroups !== null && duplicateIds.size > 0 && (
        <div className="duplicates-banner">
          <span>发现 {dupGroups.length} 组重复条目，已高亮显示</span>
          <button className="clear-duplicates-button" onClick={onClearDuplicates}>
            取消高亮
          </button>
        </div>
      )}

      <div className="clipboard-items">
        {loading && <div className="empty-state"><p>加载中...</p></div>}
        {!loading &&
          items.map((item) => (
            <ClipboardItemView
              key={item.id}
              item={item}
              duplicate={duplicateIds.has(item.id)}
              pluginName={activePlugin?.name ?? null}
              itemActions={itemActions}
              onDelete={onDeleteItem}
              onEdit={onEditItem}
              onCopy={onCopyItem}
              onPlugin={setPluginTarget}
            />
          ))}
        {!loading && items.length === 0 && (
          <div className="empty-state">
            <p>暂无内容，在下方输入框添加</p>
          </div>
        )}
      </div>

      <div className="list-footer">
        <div className="add-item-box">
          <textarea
            ref={addItemInputRef}
            className={`add-item-input ${expanded ? 'expanded' : ''}`}
            placeholder={clipboard !== null ? '输入要添加的内容，Enter 添加，Shift+Enter 换行' : '请先选择剪切板'}
            rows={1}
            value={newContent}
            disabled={clipboard === null}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitNewItem();
              }
              if (e.key === 'Enter' && e.shiftKey) {
                setExpanded(true);
              }
              if (e.key === 'Escape') {
                setNewContent('');
                setExpanded(false);
                e.currentTarget.blur();
              }
            }}
          />
          <button
            className={`add-item-expand ${expanded ? 'expanded' : ''}`}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? '收起' : '展开'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 15 12 9 18 15"></polyline>
            </svg>
          </button>
        </div>
        <button
          className="add-item-button"
          onClick={submitNewItem}
          disabled={clipboard === null || !newContent.trim()}
        >
          添加
        </button>
      </div>

      {editModalOpen && clipboard !== null && (
        <ClipboardEditModal
          clipboard={clipboard}
          onCancel={() => setEditModalOpen(false)}
          onSave={async (data) => {
            await onUpdateClipboard(clipboard.id, data);
            setEditModalOpen(false);
          }}
        />
      )}

      {pluginTarget !== null && activePlugin !== null && (
        <PluginConfirmModal
          plugin={activePlugin}
          content={pluginTarget.content}
          onCancel={() => setPluginTarget(null)}
          onConfirm={async (result) => {
            const target = pluginTarget;
            setPluginTarget(null);
            if (target) {
              await onPluginApply(target, result, activePlugin.name);
            }
          }}
        />
      )}
    </div>
  );
}

export default ClipboardList;
