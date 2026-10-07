import { useEffect, useState } from 'react';
import type { Clipboard } from '../types';
import { copyText } from '../clipboard';
import './ClipboardEditModal.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ClipboardEditModalProps {
  clipboard: Clipboard;
  onCancel: () => void;
  onSave: (data: { name: string; uuid: string }) => Promise<void>;
}

function ClipboardEditModal({ clipboard, onCancel, onSave }: ClipboardEditModalProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(clipboard.name);
  const [uuid, setUuid] = useState(clipboard.uuid);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uuidFocused, setUuidFocused] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        if (editing) {
          setEditing(false);
        } else {
          onCancel();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, onCancel, saving]);

  const startEdit = () => {
    setName(clipboard.name);
    setUuid(clipboard.uuid);
    setError('');
    setEditing(true);
  };

  const copyUuid = async () => {
    if (!(await copyText(clipboard.uuid))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('请输入剪切板名称');
      return;
    }
    if (!uuid.trim()) {
      setError('请输入 UUID');
      return;
    }
    if (!UUID_RE.test(uuid.trim())) {
      setError('UUID 格式不正确');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), uuid: uuid.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
      setSaving(false);
    }
  };

  const dismiss = () => {
    if (editing) {
      setEditing(false);
    } else {
      onCancel();
    }
  };

  const createdAt = new Date(clipboard.created_at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !saving && dismiss()}>
      <div className="modal-card" role="dialog" aria-modal="true">
        <h3 className="modal-title">{clipboard.name}</h3>
        {editing ? (
          <>
            <div className="modal-field">
              <label className="modal-label" htmlFor="clipboard-name-input">剪切板名称</label>
              <input
                id="clipboard-name-input"
                className="modal-input"
                value={name}
                maxLength={255}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                autoFocus
              />
            </div>
            <div className="modal-field">
              <label className="modal-label" htmlFor="clipboard-uuid-input">剪切板 UUID</label>
              <input
                id="clipboard-uuid-input"
                className={`modal-input modal-input-mono ${uuidFocused ? 'modal-input-danger' : ''}`}
                value={uuid}
                onChange={(e) => {
                  setUuid(e.target.value);
                  setError('');
                }}
                onFocus={() => setUuidFocused(true)}
                onBlur={() => setUuidFocused(false)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                spellCheck={false}
              />
              {uuidFocused && (
                <p className="modal-hint modal-hint-warning">! 修改后旧 UUID 的脚本与快捷指令将失效</p>
              )}
            </div>
            {error && <div className="modal-error">{error}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setEditing(false)} disabled={saving}>
                取消
              </button>
              <button className="modal-confirm" onClick={submit} disabled={saving}>
                确认
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-field">
              <span className="modal-label">剪切板名称</span>
              <div className="modal-value">{clipboard.name}</div>
            </div>
            <div className="modal-field">
              <span className="modal-label">创建时间</span>
              <div className="modal-value">{createdAt}</div>
            </div>
            <div className="modal-field">
              <span className="modal-label">剪切板 UUID</span>
              <div className="uuid-row">
                <span className="modal-value modal-value-mono">{clipboard.uuid}</span>
                <button
                  className={`copy-button ${copied ? 'copied' : ''}`}
                  onClick={copyUuid}
                  title={copied ? '已复制' : '复制 UUID'}
                >
                  {copied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              </div>
              <p className="modal-hint">供外部 API 调用时标识此剪切板</p>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={onCancel}>
                关闭
              </button>
              <button className="modal-confirm" onClick={startEdit}>
                编辑
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ClipboardEditModal;
