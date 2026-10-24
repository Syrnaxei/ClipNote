import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Clipboard, ClipboardItem, DuplicateGroup, Plugin } from '../types';
import type { ItemActionSetting } from '../itemActions';
import ClipboardItemView from './ClipboardItem';
import ClipboardEditModal from './ClipboardEditModal';
import PluginConfirmModal from './PluginConfirmModal';
import PopConfirm from './PopConfirm';
import { useItemTransitions } from '../useItemTransitions';
import {
  easePaper,
  MOTION,
  motionDelay,
  prefersReducedMotion,
  scrollToLatestDuration,
} from '../motion';
import './ClipboardList.css';

/** 距底部这个距离以内就算「已经在看最新一条」 */
const BOTTOM_TOLERANCE = 24;

function isAtBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_TOLERANCE;
}

function ClipboardListSkeleton() {
  const widths = ['78%', '64%', '72%'];
  return (
    <div className="clipboard-skeleton" role="status" aria-busy="true">
      <span className="sr-only">加载中…</span>
      {widths.map((width, index) => (
        <div className="skeleton-card" key={index} aria-hidden="true">
          <span className="skeleton-line" style={{ width }} />
          <span className="skeleton-line skeleton-meta" />
        </div>
      ))}
    </div>
  );
}

interface ClipboardListProps {
  clipboard: Clipboard | null;
  clipboards: Clipboard[];
  items: ClipboardItem[];
  loading: boolean;
  loadError: boolean;
  onRetryLoad: () => void;
  dupGroups: DuplicateGroup[] | null;
  activePlugin: Plugin | null;
  itemActions: ItemActionSetting;
  onAddItem: (content: string) => Promise<boolean>;
  onDeleteItem: (id: number) => void;
  onEditItem: (id: number, newContent: string) => void;
  onMoveItem: (id: number, targetClipboardId: number) => Promise<void>;
  onCopyItem: (content: string) => Promise<boolean>;
  onPluginApply: (item: ClipboardItem, result: string, pluginName: string) => Promise<void>;
  onCheckDuplicates: () => void;
  onClearDuplicates: () => void;
  onDeleteClipboard: (id: number) => void;
  onUpdateClipboard: (id: number, data: { name: string; uuid: string }) => Promise<void>;
  onTogglePinned: (id: number, pinned: boolean) => Promise<void>;
  followOnAdd: boolean;
  noticeVisible: boolean;
}

function ClipboardList({
  clipboard,
  clipboards,
  items,
  loading,
  loadError,
  onRetryLoad,
  dupGroups,
  activePlugin,
  itemActions,
  onAddItem,
  onDeleteItem,
  onEditItem,
  onMoveItem,
  onCopyItem,
  onPluginApply,
  onCheckDuplicates,
  onClearDuplicates,
  onDeleteClipboard,
  onUpdateClipboard,
  onTogglePinned,
  followOnAdd,
  noticeVisible,
}: ClipboardListProps) {
  const [expanded, setExpanded] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [pluginTarget, setPluginTarget] = useState<ClipboardItem | null>(null);
  const [nameCopied, setNameCopied] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const addItemInputRef = useRef<HTMLTextAreaElement>(null);
  const nameCopyTimerRef = useRef<number>(0);
  const itemsRef = useRef<HTMLDivElement>(null);
  const [switching, setSwitching] = useState(false);
  /* 标题的「翻页」相位：与内容淡出/淡入同拍，见下方 useLayoutEffect */
  const [titlePhase, setTitlePhase] = useState<'idle' | 'out' | 'in'>('idle');

  /*
   * 切换剪切板：旧内容先淡出 90ms，换上新内容并复位滚动位置后再淡入 130ms。
   * 展示层读 shown 快照，内容在淡出结束的那一刻才真正换掉——否则新列表会先闪一帧
   * 再整体淡出，看上去像是抖动。
   *
   * 标题走同一条时间线：淡出开始时旧名上滑淡出（is-out），换名那一刻新名自下方
   * 升起（is-in）。文字正好在两个相位交接、透明度为 0 的那一帧替换，所以看不到换字。
   */
  const activeBoardId = clipboard?.id ?? null;
  const [shown, setShown] = useState({
    id: activeBoardId,
    name: clipboard?.name ?? null,
    items,
    loading,
    loadError,
  });
  const latestRef = useRef({
    id: activeBoardId,
    name: clipboard?.name ?? null,
    items,
    loading,
    loadError,
  });
  latestRef.current = {
    id: activeBoardId,
    name: clipboard?.name ?? null,
    items,
    loading,
    loadError,
  };
  const swapTimerRef = useRef(0);

  /*
   * 列表贴着底部生长：新条目落到末尾。只有「已经在看最新一条」时才自动跟随，
   * 否则原地不动，底部浮出「N 条新条目」胶囊；自己刚添加的那条默认特殊对待，
   * 可以在设置里关掉。
   */
  const [unread, setUnread] = useState(0);
  const [pillCount, setPillCount] = useState(0);
  const atBottomRef = useRef(true);
  const scopeRef = useRef(shown.id);
  const seenIdsRef = useRef(new Set(shown.items.map((item) => item.id)));
  const selfAddRef = useRef(false);
  const selfAddTimerRef = useRef(0);
  const mountedRef = useRef(false);
  const scrollAnimRef = useRef(0);

  const cancelScrollAnim = () => {
    if (scrollAnimRef.current !== 0) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = 0;
    }
  };

  /**
   * 平滑滚到最新一条。自己添加时如果离底部很远，直接瞬移很生硬，
   * 这里用和 CSS 同一条「纸张余韵」曲线补间；用户中途自己滚动就让位。
   */
  const animateScrollToLatest = (el: HTMLDivElement) => {
    cancelScrollAnim();
    const from = el.scrollTop;
    const distance = el.scrollHeight - el.clientHeight - from;
    if (distance <= 0) return;
    if (prefersReducedMotion()) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    const duration = scrollToLatestDuration(distance);
    const started = performance.now();
    let expected = from;
    const step = (now: number) => {
      scrollAnimRef.current = 0;
      // 位置被别的来源改过（用户滚动、内容高度变化）就不再抢滚动条
      if (Math.abs(el.scrollTop - expected) > 2) return;
      const progress = Math.min(1, (now - started) / duration);
      const target = el.scrollHeight - el.clientHeight;
      expected = from + (target - from) * easePaper(progress);
      el.scrollTop = expected;
      if (progress < 1) scrollAnimRef.current = requestAnimationFrame(step);
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  };

  useEffect(
    () => () => {
      window.clearTimeout(swapTimerRef.current);
      window.clearTimeout(selfAddTimerRef.current);
      cancelAnimationFrame(scrollAnimRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (shown.id === activeBoardId) {
      if (
        shown.items !== items ||
        shown.loading !== loading ||
        shown.loadError !== loadError ||
        shown.name !== (clipboard?.name ?? null)
      ) {
        setShown({ ...latestRef.current });
      }
      return;
    }
    // 正在淡出：交给定时器收尾（期间又点了别的剪切板，收尾时取最新值）
    if (swapTimerRef.current !== 0) return;
    // 首次选中 / 取消选中不做淡入淡出
    if (shown.id === null || activeBoardId === null) {
      setShown({ ...latestRef.current });
      setTitlePhase('idle');
      return;
    }
    setSwitching(true);
    setTitlePhase('out');
    swapTimerRef.current = window.setTimeout(() => {
      swapTimerRef.current = 0;
      setShown({ ...latestRef.current });
      setSwitching(false);
      setTitlePhase('in');
      // 换页后的落位由下面的沉底 effect 负责（新顺序是「最新在下」）
    }, motionDelay(MOTION.switchOut));
  }, [activeBoardId, clipboard?.name, items, loading, loadError, shown]);

  /*
   * 沉底跟随必须在 useItemTransitions 之前跑：它改的是 scrollTop，
   * FLIP 的位移要按「布局位置 − 滚动位置」算，顺序反了条目就会跳一帧。
   */
  useLayoutEffect(() => {
    const el = itemsRef.current;
    if (!el) return;
    const ids = new Set(shown.items.map((item) => item.id));

    // 首次挂载（含从设置页返回）：直接落在最新一条
    if (!mountedRef.current) {
      mountedRef.current = true;
      seenIdsRef.current = ids;
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      return;
    }

    // 换剪切板：直接落到底部看最新，不计数
    if (scopeRef.current !== shown.id) {
      scopeRef.current = shown.id;
      seenIdsRef.current = ids;
      selfAddRef.current = false;
      cancelScrollAnim();
      setUnread((current) => (current === 0 ? current : 0));
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      return;
    }

    let added = 0;
    ids.forEach((id) => {
      if (!seenIdsRef.current.has(id)) added += 1;
    });
    seenIdsRef.current = ids;

    if (added === 0) {
      atBottomRef.current = isAtBottom(el);
      return;
    }

    const selfAdd = selfAddRef.current;
    selfAddRef.current = false;
    if (atBottomRef.current) {
      // 本来就贴着底部：瞬时落位，让位交给 FLIP，新卡片从下方升起
      cancelScrollAnim();
      el.scrollTop = el.scrollHeight;
      setUnread((current) => (current === 0 ? current : 0));
    } else if (selfAdd && followOnAdd) {
      // 离底部很远：滚过去，别把整屏内容瞬移
      setUnread((current) => (current === 0 ? current : 0));
      animateScrollToLatest(el);
    } else {
      setUnread((current) => current + added);
    }
    atBottomRef.current = isAtBottom(el);
  }, [shown, followOnAdd]);

  const handleItemsScroll = () => {
    const el = itemsRef.current;
    if (!el) return;
    const atBottom = isAtBottom(el);
    atBottomRef.current = atBottom;
    if (atBottom) setUnread((current) => (current === 0 ? current : 0));
  };

  const jumpToNewest = () => {
    const el = itemsRef.current;
    if (!el) return;
    setUnread(0);
    animateScrollToLatest(el);
  };

  useEffect(() => {
    if (unread > 0) setPillCount(unread);
  }, [unread]);

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

  const submitNewItem = async () => {
    const content = newContent.trim();
    if (!content || clipboard === null) return;
    // 先置位：条目经 WS 推回来，可能比 POST 的响应还早到
    selfAddRef.current = true;
    window.clearTimeout(selfAddTimerRef.current);
    selfAddTimerRef.current = window.setTimeout(() => {
      selfAddRef.current = false;
    }, 3000);
    const ok = await onAddItem(content);
    if (!ok) {
      selfAddRef.current = false;
      return;
    }
    setNewContent('');
    setExpanded(false);
  };

  const duplicateIds = new Set(
    dupGroups?.flatMap((group) => group.items.map((item) => item.id)) ?? [],
  );

  const transitions = useItemTransitions(
    shown.items,
    shown.id,
    itemsRef,
    !shown.loading && !shown.loadError,
  );

  const doCopyName = async () => {
    if (clipboard === null) return;
    if (await onCopyItem(clipboard.name)) {
      setNameCopied(true);
      window.clearTimeout(nameCopyTimerRef.current);
      nameCopyTimerRef.current = window.setTimeout(() => setNameCopied(false), 1500);
    }
  };

  return (
    <div className="clipboard-list-container">
      <div className="clipboard-list-header">
        <div className="header-title-group">
          <div className="header-title-slot">
            <h2
              className={`clipboard-title${
                titlePhase === 'idle' ? '' : ` is-${titlePhase}`
              }`}
            >
              {shown.name ?? '未选择剪切板'}
            </h2>
          </div>
          {clipboard !== null && (
            <button
              className={`header-copy-button ${nameCopied ? 'copied' : ''}`}
              onClick={doCopyName}
              title={nameCopied ? '已复制' : '复制名称'}
            >
              {nameCopied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </button>
          )}
        </div>
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

      <div className="clipboard-list-body">
        <div
          className={`clipboard-items ${switching ? 'is-switching' : ''}`}
          ref={itemsRef}
          onScroll={handleItemsScroll}
        >
          {shown.loading && <ClipboardListSkeleton />}
          {shown.loadError && (
            <div className="empty-state">
              <p>条目加载失败</p>
              <button className="load-retry-button" onClick={onRetryLoad}>
                重试
              </button>
            </div>
          )}
          {!shown.loading && !shown.loadError &&
            shown.items.map((item) => (
              <div
                key={item.id}
                data-item-id={item.id}
                className={`item-slot${
                  transitions.entering.has(item.id) ? ' is-entering' : ''
                }`}
              >
                <ClipboardItemView
                  item={item}
                  duplicate={duplicateIds.has(item.id)}
                  pluginName={activePlugin?.name ?? null}
                  itemActions={itemActions}
                  clipboards={clipboards}
                  onDelete={onDeleteItem}
                  onEdit={onEditItem}
                  onMove={onMoveItem}
                  onCopy={onCopyItem}
                  onPlugin={setPluginTarget}
                />
              </div>
            ))}
          {!shown.loading && !shown.loadError && shown.items.length === 0 && (
            <div className="empty-state">
              <p>暂无内容，在下方输入框添加</p>
            </div>
          )}
        </div>
        <button
          type="button"
          className={`new-items-pill ${
            unread > 0 && !noticeVisible ? 'is-visible' : ''
          }`}
          onClick={jumpToNewest}
          tabIndex={unread > 0 && !noticeVisible ? 0 : -1}
          aria-hidden={unread > 0 && !noticeVisible ? undefined : true}
        >
          {pillCount} 条新条目
        </button>
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
