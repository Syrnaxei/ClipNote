import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ClipboardList from './components/ClipboardList';
import Settings from './components/Settings';
import PluginsView from './components/PluginsView';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile] = useState(isMobileDevice);
  const [clipboards, setClipboards] = useState<Clipboard[]>([]);
  const [itemsByClipboard, setItemsByClipboard] = useState<Record<number, ClipboardItem[]>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[] | null>(null);
  const [activePlugin, setActivePlugin] = useState<Plugin | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [noticeBottom, setNoticeBottom] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (isMobile) {
      document.documentElement.classList.add('mobile');
    }
  }, [isMobile]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

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
  }, [authed, refreshAll, refreshAggregates]);

  useEffect(() => {
    if (activeId !== null && itemsByClipboard[activeId] === undefined) {
      api
        .listItems(activeId)
        .then(({ items }) => setItemsByClipboard((prev) => ({ ...prev, [activeId]: items })))
        .catch(() => {});
    }
  }, [activeId, itemsByClipboard]);

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

  const handleAddItem = async (content: string) => {
    const clipboard = clipboards.find((c) => c.id === activeId);
    if (!clipboard) return;
    const device = deviceName.trim();
    await api.createItem(
      clipboard.uuid,
      content,
      device ? { device, device_type: 'Web' } : undefined,
    );
  };

  const handleEditItem = async (id: number, newContent: string) => {
    if (!newContent.trim()) return;
    await api.updateItem(id, newContent);
  };

  const handleCopyItem = async (content: string) => {
    const ok = await copyText(content);
    if (!ok) showNotice({ text: '复制失败，请手动复制' });
    return ok;
  };

  const refreshActivePlugin = useCallback(async () => {
    try {
      const { plugins } = await api.listPlugins();
      setActivePlugin(plugins.find((p) => p.enabled) ?? null);
    } catch {
      setActivePlugin(null);
    }
  }, []);

  useEffect(() => {
    if (authed && view === 'main') {
      refreshActivePlugin();
    }
  }, [authed, view, refreshActivePlugin]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const showNotice = (n: { text: string; actionLabel?: string; onAction?: () => void }) => {
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
        setNotice(null);
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
      <Header
        sidebarOpen={sidebarOpen}
        showSidebarToggle={view === 'main'}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        settingsOpen={view === 'settings'}
        onToggleSettings={() => setView((v) => (v === 'settings' ? 'main' : 'settings'))}
        pluginsOpen={view === 'plugins'}
        onTogglePlugins={() => setView((v) => (v === 'plugins' ? 'main' : 'plugins'))}
      />
      {view === 'settings' ? (
        <Settings
          theme={theme}
          onThemeChange={setTheme}
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
      ) : view === 'plugins' ? (
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
            items={activeItems ?? []}
            loading={activeId !== null && activeItems === undefined}
            dupGroups={dupGroups}
            activePlugin={activePlugin}
            itemActions={itemActions}
            onAddItem={handleAddItem}
            onDeleteItem={async (id) => {
              await api.deleteItem(id);
            }}
            onEditItem={handleEditItem}
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

      {notice && (
        <div
          className="notice-toast"
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
            onClick={() => setNotice(null)}
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
