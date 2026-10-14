import { useState } from 'react';
import './PluginTrustModal.css';
import type { Plugin } from '../types';

interface PluginTrustModalProps {
  plugin: Plugin;
  onConfirm: (skipConfirm: boolean) => void;
  onCancel: () => void;
}

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
        <h3 className="modal-title">信任插件「{plugin.name}」</h3>

        <p className="plugin-trust-intro">
          文本选择工具栏插件没有沙箱保护，信任即代表允许它在你每次选中文本并点击按钮时运行。请确认你了解以下风险：
        </p>

        <ul className="plugin-trust-risks">
          <li>
            插件代码与网页脚本<strong>同等权限</strong>，可读取页面上任何数据并对外发送
          </li>
          <li>
            插件运行在<strong>主线程</strong>：同步死循环、重复弹窗等编写不当的代码会
            <strong>冻结整个页面</strong>，需刷新才能恢复
          </li>
          <li>插件更新版本后需要重新信任</li>
        </ul>

        <p className="plugin-trust-warning">只信任来源可信的插件。</p>

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
            信任该插件
          </button>
        </div>
      </div>
    </div>
  );
}

export default PluginTrustModal;
