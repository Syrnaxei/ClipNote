import { useState } from 'react';
import './PluginTrustModal.css';
import type { Plugin } from '../types';

interface PluginTrustModalProps {
  plugin: Plugin;
  onConfirm: (skipConfirm: boolean) => void;
  onCancel: () => void;
}

const WARN_MARK = (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const UNLOCK_MARK = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>
);

const CLOCK_MARK = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const REFRESH_MARK = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const RISKS = [
  {
    icon: UNLOCK_MARK,
    title: '完全权限',
    detail: '与网页脚本同等权限，可读取页面上的任何数据并对外发送',
  },
  {
    icon: CLOCK_MARK,
    title: '主线程运行',
    detail: '死循环、重复弹窗等编写不当的代码会冻结整个页面，需刷新才能恢复',
  },
  {
    icon: REFRESH_MARK,
    title: '版本更新后需重新信任',
    detail: '信任按插件版本记录，插件更新后不会自动继承',
  },
];

function PluginTrustModal({ plugin, onConfirm, onCancel }: PluginTrustModalProps) {
  const [skipConfirm, setSkipConfirm] = useState(false);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-card plugin-trust-card">
        <div className="plugin-trust-head">
          <span className="plugin-trust-warn-icon">{WARN_MARK}</span>
          <div>
            <h3 className="modal-title">信任「{plugin.name}」</h3>
            <p className="plugin-trust-source">
              来自 {plugin.author} · v{plugin.version}
            </p>
          </div>
        </div>

        <ul className="plugin-trust-risks">
          {RISKS.map((risk) => (
            <li key={risk.title} className="plugin-trust-risk">
              <span className="plugin-trust-risk-icon">{risk.icon}</span>
              <span>
                <span className="plugin-trust-risk-title">{risk.title}</span>
                <span className="plugin-trust-risk-detail">{risk.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="plugin-trust-warning">只信任来源可信的插件。</p>

        <div className="plugin-trust-footer">
          <label className="plugin-trust-skip">
            <input
              type="checkbox"
              checked={skipConfirm}
              onChange={(e) => setSkipConfirm(e.target.checked)}
            />
            <span>不再提示</span>
          </label>
          <div className="modal-actions">
            <button className="modal-cancel" onClick={onCancel}>
              取消
            </button>
            <button className="modal-confirm plugin-trust-confirm" onClick={() => onConfirm(skipConfirm)}>
              信任
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PluginTrustModal;
