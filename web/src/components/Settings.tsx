import { useEffect, useRef, useState } from 'react';
import './Settings.css';
import './ClipboardItem.css';
import { PIN_STYLES, type PinStyle } from '../pinStyle';
import {
  ITEM_ACTIONS,
  type ItemActionId,
  type ItemActionSetting,
} from '../itemActions';

const ACTION_ICONS: Record<ItemActionId, React.ReactNode> = {
  plugin: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"></path>
    </svg>
  ),
  edit: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
  move: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-2-3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>
      <polyline points="10 13 13 16 16 13"></polyline>
      <line x1="13" y1="9" x2="13" y2="16"></line>
    </svg>
  ),
  delete: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  copy: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  ),
};

const NAV_ICONS: Record<SectionId, React.ReactNode> = {
  appearance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  actions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
    </svg>
  ),
  connection: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  ),
};

type SectionId = 'appearance' | 'actions' | 'connection' | 'account' | 'about';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'appearance', label: '外观' },
  { id: 'actions', label: '条目操作' },
  { id: 'connection', label: '连接' },
  { id: 'account', label: '账户' },
  { id: 'about', label: '关于' },
];

const APP_VERSION = '1.2.4';
const PROJECT_URL = 'https://github.com/Syrnaxei/ClipNote';

const ROW_HEIGHT_FALLBACK = 48;
const ROW_EASE = 'transform 250ms cubic-bezier(0.65, 0, 0.35, 1)';

interface SettingsProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  pinStyle: PinStyle;
  onPinStyleChange: (style: PinStyle) => void;
  deviceName: string;
  onDeviceNameChange: (name: string) => void;
  connected: boolean;
  itemActions: ItemActionSetting;
  onItemActionsChange: (setting: ItemActionSetting) => void;
  onBack: () => void;
  onLogout: () => void;
}

function Settings({
  theme,
  onThemeChange,
  pinStyle,
  onPinStyleChange,
  deviceName,
  onDeviceNameChange,
  connected,
  itemActions,
  onItemActionsChange,
  onBack,
  onLogout,
}: SettingsProps) {
  const [editingDevice, setEditingDevice] = useState(false);
  const [deviceDraft, setDeviceDraft] = useState(deviceName);
  const [activeSection, setActiveSection] = useState<SectionId>('appearance');
  const mainRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [transitionDisabled, setTransitionDisabled] = useState(false);
  const dragRef = useRef({
    index: -1,
    overIndex: -1,
    startY: 0,
    offsetY: 0,
    itemHeight: 0,
  });
  const itemActionsRef = useRef(itemActions);
  itemActionsRef.current = itemActions;

  useEffect(() => {
    if (dragIndex === null) return;
    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      d.offsetY = e.clientY - d.startY;
      setDragY(d.offsetY);
      const h = d.itemHeight || ROW_HEIGHT_FALLBACK;
      const len = itemActionsRef.current.order.length;
      let target = d.index;
      if (d.offsetY > h / 2) {
        target = Math.min(
          len - 1,
          d.index + Math.floor((d.offsetY + h / 2) / h),
        );
      } else if (d.offsetY < -h / 2) {
        target = Math.max(0, d.index + Math.ceil((d.offsetY - h / 2) / h));
      }
      if (target !== d.overIndex) {
        d.overIndex = target;
        setDragOverIndex(target);
      }
    };
    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const { index: from, overIndex: to } = dragRef.current;
      setTransitionDisabled(true);
      setDragIndex(null);
      setDragOverIndex(null);
      setDragY(0);
      if (from !== to) {
        const order = [...itemActionsRef.current.order];
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        onItemActionsChange({ ...itemActionsRef.current, order });
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setTransitionDisabled(false)),
      );
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragIndex, onItemActionsChange]);

  const handleActionDragStart = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const row = (e.currentTarget as HTMLElement).closest(
      '.action-row',
    ) as HTMLElement | null;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    dragRef.current = {
      index,
      overIndex: index,
      startY: e.clientY,
      offsetY: 0,
      itemHeight: rect.height,
    };
    setDragIndex(index);
    setDragOverIndex(index);
    setDragY(0);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };

  const getActionRowStyle = (index: number): React.CSSProperties => {
    if (dragIndex === null) {
      return { transition: transitionDisabled ? 'none' : ROW_EASE };
    }
    const h = dragRef.current.itemHeight || ROW_HEIGHT_FALLBACK;
    if (index === dragIndex) {
      return {
        transform: `translateY(${dragY}px)`,
        zIndex: 1000,
        opacity: 0.92,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        backgroundColor: 'var(--surface)',
        borderRadius: '8px',
        transition: 'none',
        position: 'relative',
      };
    }
    if (dragOverIndex! > dragIndex) {
      if (index > dragIndex && index <= dragOverIndex!) {
        return { transform: `translateY(-${h}px)`, transition: ROW_EASE };
      }
    } else if (dragOverIndex! < dragIndex) {
      if (index >= dragOverIndex! && index < dragIndex) {
        return { transform: `translateY(${h}px)`, transition: ROW_EASE };
      }
    }
    return { transition: ROW_EASE };
  };

  const scrollToSection = (id: SectionId) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleMainScroll = () => {
    const main = mainRef.current;
    if (!main) return;
    const scrollTop = main.scrollTop;
    let current: SectionId = SECTIONS[0].id;
    for (const { id } of SECTIONS) {
      const el = sectionRefs.current[id];
      if (el && el.offsetTop - 24 <= scrollTop) current = id;
    }
    if (scrollTop + main.clientHeight >= main.scrollHeight - 4) {
      current = SECTIONS[SECTIONS.length - 1].id;
    }
    setActiveSection(current);
  };

  const startEditDevice = () => {
    setDeviceDraft(deviceName);
    setEditingDevice(true);
  };

  const saveDevice = () => {
    onDeviceNameChange(deviceDraft.trim());
    setEditingDevice(false);
  };

  const toggleActionHidden = (id: ItemActionId) => {
    const hidden = itemActions.hidden.includes(id)
      ? itemActions.hidden.filter((h) => h !== id)
      : [...itemActions.hidden, id];
    onItemActionsChange({ ...itemActions, hidden });
  };

  return (
    <div className="settings">
      <div className="settings-topbar">
        <button className="settings-back" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          返回
        </button>
      </div>

      <div className="settings-body">
        <nav className="settings-nav" aria-label="设置分区">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              className={`settings-nav-item ${activeSection === id ? 'active' : ''}`}
              onClick={() => scrollToSection(id)}
            >
              {NAV_ICONS[id]}
              {label}
            </button>
          ))}
          <div className="settings-nav-spacer" />
          <span className="settings-nav-version">v{APP_VERSION}</span>
        </nav>

        <div className="settings-main" ref={mainRef} onScroll={handleMainScroll}>
          <section
            className="settings-section"
            ref={(el) => {
              sectionRefs.current.appearance = el;
            }}
          >
            <h2 className="settings-section-heading">外观</h2>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">夜间模式</span>
                  <span className="settings-row-desc">使用深色暖色调界面</span>
                </div>
                <button
                  className={`toggle-switch ${theme === 'dark' ? 'on' : ''}`}
                  role="switch"
                  aria-checked={theme === 'dark'}
                  aria-label="夜间模式"
                  onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">置顶选中样式</span>
                  <span className="settings-row-desc">置顶剪切板的几何标识样式</span>
                </div>
                <div className="pin-style-options">
                  {PIN_STYLES.map(({ value, label }) => (
                    <button
                      key={value}
                      className={`pin-style-option ${pinStyle === value ? 'selected' : ''}`}
                      onClick={() => onPinStyleChange(value)}
                    >
                      <span className={`pin-style-swatch ${value}`} />
                      <span className="pin-style-name">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">设备名称</span>
                  <span className="settings-row-desc">添加条目时记录的来源设备，留空则不记录</span>
                </div>
                {editingDevice ? (
                  <div className="device-edit">
                    <input
                      className="settings-input"
                      value={deviceDraft}
                      maxLength={100}
                      placeholder="我的电脑"
                      autoFocus
                      onChange={(e) => setDeviceDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDevice();
                        if (e.key === 'Escape') setEditingDevice(false);
                      }}
                    />
                    <button className="device-save-button" onClick={saveDevice}>
                      保存
                    </button>
                  </div>
                ) : (
                  <div className="device-display">
                    <span className="device-value">{deviceName || '未设置'}</span>
                    <button className="device-edit-button" onClick={startEditDevice}>
                      编辑
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section
            className="settings-section"
            ref={(el) => {
              sectionRefs.current.actions = el;
            }}
          >
            <h2 className="settings-section-heading">条目操作</h2>
            <div
              className={`settings-card ${dragIndex !== null ? 'card-dragging' : ''}`}
            >
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">操作按钮</span>
                  <span className="settings-row-desc">
                    拖动手柄调整顺序，开关控制显示 / 隐藏
                  </span>
                </div>
              </div>
              <div className="action-list">
                {itemActions.order.map((id, index) => {
                  const action = ITEM_ACTIONS.find((a) => a.id === id);
                  if (!action) return null;
                  const hidden = itemActions.hidden.includes(id);
                  return (
                    <div
                      key={id}
                      className={`action-row ${hidden ? 'hidden-row' : ''}`}
                      style={getActionRowStyle(index)}
                    >
                      <span
                        className="action-drag"
                        aria-hidden="true"
                        onMouseDown={(e) => handleActionDragStart(index, e)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="5" r="1.7" />
                          <circle cx="15" cy="5" r="1.7" />
                          <circle cx="9" cy="12" r="1.7" />
                          <circle cx="15" cy="12" r="1.7" />
                          <circle cx="9" cy="19" r="1.7" />
                          <circle cx="15" cy="19" r="1.7" />
                        </svg>
                      </span>
                      <span className="action-icon">{ACTION_ICONS[id]}</span>
                      <div className="action-text">
                        <span className="action-name">{action.label}</span>
                        <span className="action-desc">{action.desc}</span>
                      </div>
                      <button
                        className={`toggle-switch ${hidden ? '' : 'on'}`}
                        role="switch"
                        aria-checked={!hidden}
                        aria-label={`${action.label}，${hidden ? '已隐藏' : '已显示'}`}
                        onClick={() => toggleActionHidden(id)}
                      >
                        <span className="toggle-knob" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="settings-card action-preview" aria-hidden="true">
              <div className="action-preview-item">
                <span className="action-preview-thumb" />
                <div className="action-preview-text">
                  <span className="action-preview-line" />
                  <span className="action-preview-line short" />
                </div>
                <div className="action-preview-actions">
                  {itemActions.order
                    .filter((id) => !itemActions.hidden.includes(id))
                    .map((id) => (
                      <button key={id} type="button" tabIndex={-1} className="action-button">
                        {ACTION_ICONS[id]}
                      </button>
                    ))}
                  {itemActions.order.every((id) =>
                    itemActions.hidden.includes(id),
                  ) && (
                    <span className="action-preview-empty">
                      全部隐藏后条目卡片不显示操作按钮
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section
            className="settings-section"
            ref={(el) => {
              sectionRefs.current.connection = el;
            }}
          >
            <h2 className="settings-section-heading">连接</h2>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">实时同步</span>
                  <span className="settings-row-desc">通过 WebSocket 推送变更</span>
                </div>
                <span className={`connection-badge ${connected ? 'online' : 'offline'}`}>
                  <span className="connection-badge-dot" />
                  {connected ? '已连接' : '连接中...'}
                </span>
              </div>
            </div>
          </section>

          <section
            className="settings-section"
            ref={(el) => {
              sectionRefs.current.account = el;
            }}
          >
            <h2 className="settings-section-heading">账户</h2>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">退出登录</span>
                  <span className="settings-row-desc">清除本机保存的 API Key</span>
                </div>
                <button className="logout-button" onClick={onLogout}>
                  退出
                </button>
              </div>
            </div>
          </section>

          <section
            className="settings-section"
            ref={(el) => {
              sectionRefs.current.about = el;
            }}
          >
            <h2 className="settings-section-heading">关于</h2>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">版本</span>
                </div>
                <span className="about-version">v{APP_VERSION}</span>
              </div>
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">项目地址</span>
                  <span className="settings-row-desc">在 GitHub 上查看源码与更新</span>
                </div>
                <a
                  className="about-link"
                  href={PROJECT_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 2.88-.39c.98 0 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.66.41.36.78 1.05.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .3.2.67.8.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                  </svg>
                  GitHub
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Settings;
