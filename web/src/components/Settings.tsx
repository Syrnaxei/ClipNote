import { useLayoutEffect, useRef, useState } from 'react';
import './Settings.css';
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

const APP_VERSION = '1.0.0';
const PROJECT_URL = 'https://github.com/Syrnaxei/ClipNote';

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
  const dragActionId = useRef<ItemActionId | null>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const blankDragRef = useRef<HTMLDivElement>(null);
  const tilePositions = useRef<Map<ItemActionId, DOMRect>>(new Map());

  useLayoutEffect(() => {
    if (tilePositions.current.size === 0) return;
    const container = tilesRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>('[data-action-id]').forEach((el) => {
      const id = el.dataset.actionId as ItemActionId;
      const prev = tilePositions.current.get(id);
      if (!prev) return;
      const dx = prev.left - el.getBoundingClientRect().left;
      if (dx === 0) return;
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.25s ease';
        el.style.transform = '';
        el.addEventListener(
          'transitionend',
          () => {
            el.style.transition = '';
            el.style.transform = '';
          },
          { once: true },
        );
      });
    });
    tilePositions.current = new Map();
  }, [itemActions.order]);

  const startEditDevice = () => {
    setDeviceDraft(deviceName);
    setEditingDevice(true);
  };

  const saveDevice = () => {
    onDeviceNameChange(deviceDraft.trim());
    setEditingDevice(false);
  };

  const reorderAction = (targetId: ItemActionId) => {
    const fromId = dragActionId.current;
    if (!fromId || fromId === targetId) return;
    const order = [...itemActions.order];
    const from = order.indexOf(fromId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    tilesRef.current?.querySelectorAll<HTMLElement>('[data-action-id]').forEach((el) => {
      const id = el.dataset.actionId as ItemActionId;
      if (id) tilePositions.current.set(id, el.getBoundingClientRect());
    });
    order.splice(from, 1);
    order.splice(to, 0, fromId);
    onItemActionsChange({ ...itemActions, order });
  };

  const toggleActionHidden = (id: ItemActionId) => {
    const hidden = itemActions.hidden.includes(id)
      ? itemActions.hidden.filter((h) => h !== id)
      : [...itemActions.hidden, id];
    onItemActionsChange({ ...itemActions, hidden });
  };

  return (
    <div className="settings">
      <div className="settings-container">
        <button className="settings-back" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          返回
        </button>

        <h1 className="settings-title">设置</h1>

        <section className="settings-section">
          <h2 className="settings-section-title">外观</h2>
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
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">条目操作</h2>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">操作按钮</span>
              <span className="settings-row-desc">
                拖动图标调整顺序，点击图标切换显示 / 隐藏
              </span>
            </div>
            <div ref={blankDragRef} className="drag-blank" aria-hidden="true" />
            <div className="item-action-tiles" ref={tilesRef}>
              {itemActions.order.map((id) => {
                const action = ITEM_ACTIONS.find((a) => a.id === id);
                if (!action) return null;
                const hidden = itemActions.hidden.includes(id);
                return (
                  <button
                    key={id}
                    data-action-id={id}
                    className={`item-action-tile ${hidden ? 'hidden' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      dragActionId.current = id;
                      e.dataTransfer.effectAllowed = 'move';
                      if (blankDragRef.current) {
                        e.dataTransfer.setDragImage(blankDragRef.current, 0, 0);
                      }
                    }}
                    onDragEnd={() => {
                      dragActionId.current = null;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDragEnter={() => reorderAction(id)}
                    onDrop={(e) => e.preventDefault()}
                    onClick={() => toggleActionHidden(id)}
                    title={hidden ? `${action.label}（已隐藏，点击显示）` : `${action.label}（点击隐藏）`}
                    aria-label={`${action.label}，${hidden ? '已隐藏' : '已显示'}，拖动调整顺序，点击切换显示`}
                  >
                    <span className="item-action-tile-icon">
                      {ACTION_ICONS[id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">连接</h2>
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
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">账户</h2>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">退出登录</span>
              <span className="settings-row-desc">清除本机保存的 API Key</span>
            </div>
            <button className="logout-button" onClick={onLogout}>
              退出
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">关于</h2>
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
        </section>
      </div>
    </div>
  );
}

export default Settings;
