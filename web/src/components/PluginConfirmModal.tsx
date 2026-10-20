import { useEffect, useState } from 'react';
import './PluginConfirmModal.css';
import { runPlugin } from '../plugins/sandbox';
import { useDismissAnimation } from '../useDismissAnimation';
import type { Plugin } from '../types';

interface PluginConfirmModalProps {
  plugin: Plugin;
  content: string;
  onConfirm: (result: string) => void;
  onCancel: () => void;
}

function PluginConfirmModal({ plugin, content, onConfirm, onCancel }: PluginConfirmModalProps) {
  const [status, setStatus] = useState<'running' | 'ok' | 'error'>('running');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const { closing, dismiss } = useDismissAnimation();

  useEffect(() => {
    let cancelled = false;
    setStatus('running');
    setError('');
    runPlugin(plugin.code, content)
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStatus('ok');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '插件执行失败');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [plugin.code, content]);

  const identical = status === 'ok' && result === content;

  return (
    <div
      className={`modal-overlay ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !closing) dismiss(onCancel);
      }}
    >
      <div className="modal-card plugin-confirm-card">
        <h3 className="modal-title">
          应用插件「{plugin.name}」
        </h3>

        {status === 'running' && <div className="plugin-confirm-running">正在执行插件...</div>}
        {status === 'error' && <div className="plugin-confirm-error">{error}</div>}

        {status === 'ok' && (
          <>
            {identical && (
              <div className="plugin-confirm-identical">处理结果与原文相同</div>
            )}
            <div className="plugin-confirm-columns">
              <div className="plugin-confirm-col">
                <div className="plugin-confirm-col-label">原文</div>
                <pre className="plugin-confirm-text">{content}</pre>
              </div>
              <div className="plugin-confirm-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
              <div className="plugin-confirm-col">
                <div className="plugin-confirm-col-label">处理结果</div>
                <pre className="plugin-confirm-text highlight">{result}</pre>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={() => dismiss(onCancel)}>
            取消
          </button>
          <button
            className="modal-confirm"
            disabled={status !== 'ok'}
            onClick={() => dismiss(() => onConfirm(result))}
          >
            覆盖原文
          </button>
        </div>
      </div>
    </div>
  );
}

export default PluginConfirmModal;
