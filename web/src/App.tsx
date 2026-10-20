import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './App.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ClipboardList from './components/ClipboardList';
import Settings from './components/Settings';
import PluginsView from './components/PluginsView';
import SelectionToolbar from './components/SelectionToolbar';
import { api, ApiKeyError, clearApiKey, getApiKey, hasApiKey, setApiKey } from './api';
import { copyText } from './clipboard';
import { connectWs } from './ws';
import { isMobileDevice } from './mobileDetect';
import { loadPinStyle, savePinStyle, type PinStyle } from './pinStyle';
import {
  loadItemActions,
  saveItemActions,
  type ItemActionSetting,
} from './itemActions';
import type { Clipboard, ClipboardItem, DuplicateGroup, Plugin, WsEvent } from './types';
import { migrateStorageKey } from './storage';
import { MOTION, motionDelay } from './motion';
import { revealTheme } from './viewTransition';

type Theme = 'light' | 'dark';

const THEME_KEY = 'clipnote_theme';
const DEVICE_NAME_KEY = 'clipnote_device_name';
migrateStorageKey('clipvault_theme', THEME_KEY);
migrateStorageKey('clipvault_device_name', DEVICE_NAME_KEY);

function initialTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function KeyGate({ onAuthed }: { onAuthed: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setApiKey(key);
    try {
      await api.listClipboards();
      onAuthed();
    } catch (err) {
      clearApiKey();
      setError(err instanceof ApiKeyError ? 'API Key 无效' : '连接服务器失败');
    }
  };

  return (
    <div className="key-gate">
      <form className="key-gate-card" onSubmit={submit}>
        <h1>ClipNote</h1>
        <p>请输入 API Key 以访问剪切板</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API Key"
          autoFocus
        />
        {error && <div className="key-gate-error">{error}</div>}
        <button type="submit" disabled={!key.trim()}>进入</button>
      </form>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState(hasApiKey());
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [pinStyle, setPinStyle] = useState<PinStyle>(loadPinStyle);
  const [itemActions, setItemActions] = useState<ItemActionSetting>(loadItemActions);
  const [deviceName, setDeviceName] = useState(
    () => localStorage.getItem(DEVICE_NAME_KEY) ?? '我的电脑',
  );
  const [view, setView] = useState<'main' | 'settings' | 'plugins'>('main');
  const [renderedView, setRenderedView] = useState<'main' | 'settings' | 'plugins'>('main');
  const [viewLeaving, setViewLeaving] = useState(false);
  const [isMobile] = useState(isMobileDevice);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [clipboards, setClipboards] = useState<Clipboard[]>([]);
  const [itemsByClipboard, setItemsByClipboard] = useState<Record<number, ClipboardItem[]>>({});
  const [failedItemLoads, setFailedItemLoads] = useState<ReadonlySet<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[] | null>(null);
  const [activePlugin, setActivePlugin] = useState<Plugin | null>(null);
  const [toolbarPlugins, setToolbarPlugins] = useState<Plugin[]>([]);
  const [notice, setNotice] = useState<{
    text: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [noticeBottom, setNoticeBottom] = useState<number | null>(null);
  const [noticeLeaving, setNoticeLeaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (isMobile) {
      document.documentElement.classList.add('mobile');
    }
  }, [isMobile]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const syncTheme = useCallback(
    (next: Theme, origin?: { x: number; y: number }) => {
      revealTheme(() => setTheme(next), origin ?? null);
    },
    [],
  );

  /* 视图切换：旧视图先退 90ms，新视图再浮入 180ms（CSS 负责浮入） */
  useEffect(() => {
    if (view === renderedView) {
      setViewLeaving(false);
      return;
    }
    setViewLeaving(true);
    const timer = window.setTimeout(() => {
      setRenderedView(view);
      setViewLeaving(false);
    }, motionDelay(MOTION.viewOut));
    return () => window.clearTimeout(timer);
  }, [view, renderedView]);

  useEffect(() => {
    savePinStyle(pinStyle);
  }, [pinStyle]);

  useEffect(() => {
    saveItemActions(itemActions);
  }, [itemActions]);

  useEffect(() => {
    localStorage.setItem(DEVICE_NAME_KEY, deviceName);
  }, [deviceName]);

  const refreshAll = useCallback(async () => {
    const { clipboards: list } = await api.listClipboards();
    setClipboards(list);
    const active = activeIdRef.current;
    if (active !== null) {
      const { items } = await api.listItems(active);
      setItemsByClipboard((prev) => ({ ...prev, [active]: items }));
    }
  }, []);

  const refreshAggregates = useCallback(() => {
    api
      .listClipboards()
      .then(({ clipboards: list }) => setClipboards(list))
      .catch(() => {});
  }, []);

  const refreshActivePlugin = useCallback(async () => {
    try {
      const { plugins } = await api.listPlugins();
      setActivePlugin(
        plugins.find((p) => p.enabled && p.type === 'text-transform') ?? null,
      );
      setToolbarPlugins(
        plugins.filter((p) => p.enabled && p.type === 'selection-toolbar'),
      );
    } catch {
      setActivePlugin(null);
      setToolbarPlugins([]);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;

    let disposed = false;

    (async () => {
      try {
        await refreshAll();
        if (disposed) return;
        setClipboards((list) => {
          if (list.length > 0 && activeIdRef.current === null) {
            setActiveId(list[0].id);
          }
          return list;
        });
      } catch (err) {
        if (err instanceof ApiKeyError) {
          clearApiKey();
          setAuthed(false);
        }
      }
    })();

    const closeWs = connectWs(
      getApiKey(),
      (event: WsEvent) => {
        switch (event.type) {
          case 'clipboard.created':
            setClipboards((prev) =>
              prev.some((c) => c.id === event.payload.id) ? prev : [...prev, event.payload],
            );
            break;
          case 'clipboard.updated':
            setClipboards((prev) =>
              prev.map((c) => (c.id === event.payload.id ? { ...c, ...event.payload } : c)),
            );
            break;
          case 'clipboard.deleted': {
            const { id } = event.payload;
            setClipboards((prev) => prev.filter((c) => c.id !== id));
            setItemsByClipboard((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            setActiveId((cur) => (cur === id ? null : cur));
            break;
          }
          case 'item.created':
            refreshAggregates();
            setItemsByClipboard((prev) => {
              const list = prev[event.payload.clipboard_id];
              if (!list) return prev;
              return {
                ...prev,
                [event.payload.clipboard_id]: [
                  event.payload,
                  ...list.filter((i) => i.id !== event.payload.id),
                ],
              };
            });
            break;
          case 'item.updated':
            setItemsByClipboard((prev) => {
              const list = prev[event.payload.clipboard_id];
              if (!list) return prev;
              return {
                ...prev,
                [event.payload.clipboard_id]: list.map((i) =>
                  i.id === event.payload.id ? event.payload : i,
                ),
              };
            });
            break;
          case 'item.moved': {
            refreshAggregates();
            const { item, fromClipboardId } = event.payload;
            setItemsByClipboard((prev) => {
              const next = { ...prev };
              const from = next[fromClipboardId];
              if (from) {
                next[fromClipboardId] = from.filter((i) => i.id !== item.id);
              }
              const to = next[item.clipboard_id];
              if (to && !to.some((i) => i.id === item.id)) {
                const idx = to.findIndex((i) => i.created_at < item.created_at);
                const insertAt = idx === -1 ? to.length : idx;
                next[item.clipboard_id] = [
                  ...to.slice(0, insertAt),
                  item,
                  ...to.slice(insertAt),
                ];
              }
              return next;
            });
            break;
          }
          case 'item.deleted': {
            refreshAggregates();
            const { id, clipboardId } = event.payload;
            setItemsByClipboard((prev) => {
              const list = prev[clipboardId];
              if (!list) return prev;
              return { ...prev, [clipboardId]: list.filter((i) => i.id !== id) };
            });
            break;
          }
          case 'plugin.created':
          case 'plugin.updated':
          case 'plugin.deleted':
            refreshActivePlugin();
            break;
        }
      },
      (status) => {
        setConnected(status);
        if (status) {
          refreshAll().catch(() => {});
        }
      },
    );

    return () => {
      disposed = true;
      closeWs();
    };
  }, [authed, refreshAll, refreshAggregates, refreshActivePlugin]);

  useEffect(() => {
    if (
      activeId !== null &&
      itemsByClipboard[activeId] === undefined &&
      !failedItemLoads.has(activeId)
    ) {
      api
        .listItems(activeId)
        .then(({ items }) => setItemsByClipboard((prev) => ({ ...prev, [activeId]: items })))
        .catch(() => {
          setFailedItemLoads((prev) =>
            prev.has(activeId) ? prev : new Set(prev).add(activeId),
          );
        });
    }
  }, [activeId, itemsByClipboard, failedItemLoads]);

  const handleAddClipboard = async (name: string) => {
    await api.createClipboard(name);
  };

  const handleDeleteClipboard = async (id: number) => {
    await api.deleteClipboard(id);
    if (activeId === id) setActiveId(null);
  };

  const handleUpdateClipboard = async (id: number, data: { name: string; uuid: string }) => {
    await api.updateClipboard(id, data);
  };

  const handleTogglePinned = async (id: number, pinned: boolean) => {
    await api.setClipboardPinned(id, pinned);
  };

  const handleAddItem = async (content: string): Promise<boolean> => {
    const clipboard = clipboards.find((c) => c.id === activeId);
    if (!clipboard) return false;
    const device = deviceName.trim();
    try {
      await api.createItem(
        clipboard.uuid,
        content,
        device ? { device, device_type: 'Web' } : undefined,
      );
      return true;
    } catch {
      showNotice({ text: '添加失败，请重试' });
      return false;
    }
  };

  const handleEditItem = async (id: number, newContent: string) => {
    if (!newContent.trim()) return;
    await api.updateItem(id, newContent);
  };

  const handleMoveItem = async (id: number, targetClipboardId: number) => {
    await api.moveItem(id, targetClipboardId);
    const target = clipboards.find((c) => c.id === targetClipboardId);
    if (target) {
      showNotice({ text: `已转移到「${target.name}」` });
    }
  };

  const handleCopyItem = async (content: string) => {
    const ok = await copyText(content);
    if (!ok) showNotice({ text: '复制失败，请手动复制' });
    return ok;
  };

  useEffect(() => {
    if (authed && view === 'main') {
      refreshActivePlugin();
    }
  }, [authed, view, refreshActivePlugin]);

  const noticeTimerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), []);

  const hideNotice = useCallback(() => {
    setNoticeLeaving(true);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      setNoticeLeaving(false);
    }, motionDelay(MOTION.overlayOut));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(hideNotice, 6000);
    return () => window.clearTimeout(timer);
  }, [notice, hideNotice]);

  const showNotice = (n: { text: string; actionLabel?: string; onAction?: () => void }) => {
    window.clearTimeout(noticeTimerRef.current);
    setNoticeLeaving(false);
    const input = document.querySelector<HTMLElement>('.add-item-input');
    setNoticeBottom(
      input ? window.innerHeight - input.getBoundingClientRect().top + 12 : null,
    );
    setNotice(n);
  };

  const handlePluginApply = async (item: ClipboardItem, result: string, pluginName: string) => {
    if (!activePlugin) return;
    await api.updateItem(item.id, result, item.content);
    showNotice({
      text: `已应用插件「${pluginName}」`,
      actionLabel: '撤销',
      onAction: async () => {
        hideNotice();
        await api.updateItem(item.id, item.content, null);
      },
    });
  };

  const handleCheckDuplicates = async () => {
    if (activeId === null) return;
    const { groups } = await api.duplicates(activeId);
    setDupGroups(groups.length > 0 ? groups : []);
    if (groups.length === 0) {
      showNotice({ text: '未发现重复条目' });
    }
  };

  const activeItems = activeId !== null ? itemsByClipboard[activeId] : undefined;
  const activeLoadFailed =
    activeId !== null && activeItems === undefined && failedItemLoads.has(activeId);

  const retryLoadItems = () => {
    setFailedItemLoads((prev) => {
      if (activeId === null || !prev.has(activeId)) return prev;
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
  };

  useEffect(() => {
    setDupGroups(null);
  }, [activeId]);

  if (!authed) {
    return (
      <KeyGate
        onAuthed={() => {
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="app">
      <SelectionToolbar plugins={toolbarPlugins} onNotice={showNotice} />
      <Header
        sidebarOpen={sidebarOpen}
        showSidebarToggle={view === 'main'}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        settingsOpen={view === 'settings'}
        onToggleSettings={() => setView((v) => (v === 'settings' ? 'main' : 'settings'))}
        pluginsOpen={view === 'plugins'}
        onTogglePlugins={() => setView((v) => (v === 'plugins' ? 'main' : 'plugins'))}
      />
      <div
        key={renderedView}
        className={`view-frame ${viewLeaving ? 'is-leaving' : ''}`}
      >
      {renderedView === 'settings' ? (
        <Settings
          theme={theme}
          onThemeChange={syncTheme}
          pinStyle={pinStyle}
          onPinStyleChange={setPinStyle}
          deviceName={deviceName}
          onDeviceNameChange={setDeviceName}
          connected={connected}
          itemActions={itemActions}
          onItemActionsChange={setItemActions}
          onBack={() => setView('main')}
          onLogout={() => {
            clearApiKey();
            setAuthed(false);
            setView('main');
          }}
        />
      ) : renderedView === 'plugins' ? (
        <PluginsView onBack={() => setView('main')} />
      ) : (
        <div className="main-container">
          <Sidebar
            clipboards={clipboards}
            activeId={activeId}
            collapsed={!sidebarOpen}
            pinStyle={pinStyle}
            onSelectClipboard={(id) => {
              setActiveId(id);
              if (isMobile) setSidebarOpen(false);
            }}
            onAddClipboard={handleAddClipboard}
            onRequestClose={() => setSidebarOpen(false)}
          />
          <ClipboardList
            clipboard={clipboards.find((c) => c.id === activeId) ?? null}
            clipboards={clipboards}
            items={activeItems ?? []}
            loading={activeId !== null && activeItems === undefined && !activeLoadFailed}
            loadError={activeLoadFailed}
            onRetryLoad={retryLoadItems}
            dupGroups={dupGroups}
            activePlugin={activePlugin}
            itemActions={itemActions}
            onAddItem={handleAddItem}
            onDeleteItem={async (id) => {
              await api.deleteItem(id);
            }}
            onEditItem={handleEditItem}
            onMoveItem={handleMoveItem}
            onCopyItem={handleCopyItem}
            onPluginApply={handlePluginApply}
            onCheckDuplicates={handleCheckDuplicates}
            onClearDuplicates={() => setDupGroups(null)}
            onDeleteClipboard={handleDeleteClipboard}
            onUpdateClipboard={handleUpdateClipboard}
            onTogglePinned={handleTogglePinned}
          />
        </div>
      )}
      </div>

      {notice && (
        <div
          className={`notice-toast ${noticeLeaving ? 'is-leaving' : ''}`}
          role="status"
          style={noticeBottom !== null ? { bottom: noticeBottom } : undefined}
        >
          <span>{notice.text}</span>
          {notice.actionLabel && (
            <button className="notice-action-button" onClick={notice.onAction}>
              {notice.actionLabel}
            </button>
          )}
          <button
            className="notice-close"
            aria-label="关闭"
            onClick={hideNotice}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
