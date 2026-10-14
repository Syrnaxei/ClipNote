import { useEffect, useRef, useState } from 'react';
import './PluginsView.css';
import PopConfirm from './PopConfirm';
import PluginTrustModal from './PluginTrustModal';
import { api } from '../api';
import { parseCvt, CvtParseError } from '../plugins/parseCvt';
import { setSkipTrustConfirm, shouldSkipTrustConfirm, trustKeyOf } from '../plugins/trust';
import type { Plugin } from '../types';

interface PluginsViewProps {
  onBack: () => void;
  trustedKeys: string[];
  onTrustChange: (keys: string[]) => void;
}

function PluginAvatar({ plugin }: { plugin: Plugin }) {
  const [failed, setFailed] = useState(false);
  const githubUser = plugin.github_url?.split('/').pop() ?? null;
  if (githubUser && !failed) {
    return (
      <img
        className="plugins-avatar plugins-avatar-img"
        src={`https://github.com/${githubUser}.png?size=80`}
        alt={plugin.author}
        onError={() => setFailed(true)}
      />
    );
  }
  return <span className="plugins-avatar">{plugin.author.slice(0, 1)}</span>;
}

const GITHUB_MARK = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
  </svg>
);

const PLUGIN_SECTIONS = [
  {
    type: 'text-transform' as const,
    label: '文本处理插件',
    desc: '条目按钮执行，文本进文本出',
    switchHint: '启用后主界面条目显示插件按钮，再次点击恢复未启用状态',
  },
  {
    type: 'selection-toolbar' as const,
    label: '文本选择工具栏插件',
    desc: '选中文本时按正则匹配显示按钮',
    switchHint: '启用并信任后，选中文本匹配其正则时按钮将出现在文本选择工具栏',
  },
];

function PluginsView({ onBack, trustedKeys, onTrustChange }: PluginsViewProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [trusting, setTrusting] = useState<Plugin | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isTrusted = (p: Plugin) => trustedKeys.includes(trustKeyOf(p));

  const requestTrust = (plugin: Plugin) => {
    if (shouldSkipTrustConfirm()) {
      onTrustChange([...trustedKeys, trustKeyOf(plugin)]);
    } else {
      setTrusting(plugin);
    }
  };

  const handleTrustConfirm = (skipConfirm: boolean) => {
    if (!trusting) return;
    if (skipConfirm) setSkipTrustConfirm(true);
    onTrustChange([...trustedKeys, trustKeyOf(trusting)]);
    setTrusting(null);
  };

  useEffect(() => {
    api
      .listPlugins()
      .then(({ plugins: list }) => {
        setPlugins(list);
        setSelectedId((cur) => cur ?? list[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载插件失败'))
      .finally(() => setLoaded(true));
  }, []);

  const reload = async (preferId?: string) => {
    const { plugins: list } = await api.listPlugins();
    setPlugins(list);
    setSelectedId((cur) => {
      if (preferId !== undefined && list.some((p) => p.id === preferId)) return preferId;
      if (list.some((p) => p.id === cur)) return cur;
      return list[0]?.id ?? null;
    });
  };

  const selected = plugins.find((p) => p.id === selectedId) ?? null;

  const handleImport = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      const text = await file.text();
      const { meta, code, regex, buttonName } = parseCvt(text);
      const { plugin } = await api.createPlugin({
        ...meta,
        ...(regex !== undefined && buttonName !== undefined ? { regex, button_name: buttonName } : {}),
        code,
      });
      await reload(plugin.id);
    } catch (e) {
      setError(
        e instanceof CvtParseError
          ? `插件解析失败: ${e.message}`
          : e instanceof Error
            ? e.message
            : '导入失败',
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleToggleEnabled = async () => {
    if (!selected) return;
    setError('');
    setBusy(true);
    try {
      await api.updatePlugin(selected.id, { enabled: !selected.enabled });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setError('');
    setBusy(true);
    try {
      await api.deletePlugin(selected.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="plugins">
      <div className="plugins-container">
        <button className="plugins-back" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          返回
        </button>

        <div className="plugins-head">
          <div>
            <h1 className="plugins-title">插件管理</h1>
            <p className="plugins-sub">
              {loaded ? `${plugins.length} 个插件 · 按类型分区，启用后分别作用于条目与选区工具栏` : '加载中...'}
            </p>
          </div>
          <button
            className="plugins-import-button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            导入 .CVT 插件
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".cvt,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </div>

        {error && (
          <div className="plugins-error" role="alert">
            {error}
          </div>
        )}

        <div className="plugins-layout">
          <div className="plugins-master">
            {loaded && plugins.length === 0 ? (
              <div className="plugins-empty">
                <p>还没有插件</p>
                <p>点击右上角导入 .CVT 插件开始使用</p>
              </div>
            ) : (
              PLUGIN_SECTIONS.map((section) => {
                const list = plugins.filter((p) => p.type === section.type);
                if (list.length === 0) return null;
                return (
                  <div key={section.type} className="plugins-section">
                    <div className="plugins-section-head">
                      <span className="plugins-section-label">{section.label}</span>
                      <span className="plugins-section-desc">{section.desc}</span>
                    </div>
                    {list.map((p) => (
                      <button
                        key={p.id}
                        className={`plugins-master-item ${p.id === selectedId ? 'selected' : ''}`}
                        onClick={() => setSelectedId(p.id)}
                      >
                        <span className="plugins-master-name">
                          {p.name}
                          {p.enabled && <span className="plugins-tag">启用中</span>}
                          {p.type === 'selection-toolbar' && !isTrusted(p) && (
                            <span className="plugins-tag plugins-tag-warn">未信任</span>
                          )}
                        </span>
                        <span className="plugins-master-desc">{p.description}</span>
                        <span className="plugins-master-meta">
                          <span className={`plugins-dot ${p.enabled ? 'on' : 'off'}`} />
                          <span>v{p.version}</span>
                          <span>{p.author}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          <div className="plugins-detail">
            {selected ? (
              <>
                <div className="plugins-card">
                  <div className="plugins-detail-head">
                    <div>
                      <h2 className="plugins-detail-title">{selected.name}</h2>
                      <div className="plugins-author-line">
                        <PluginAvatar key={selected.id} plugin={selected} />
                        <span className="plugins-author-name">{selected.author}</span>
                        {selected.github_url && (
                          <a
                            className="plugins-github-link"
                            href={selected.github_url}
                            target="_blank"
                            rel="noreferrer"
                            title="GitHub 主页"
                            aria-label={`查看 ${selected.author} 的 GitHub 主页`}
                          >
                            {GITHUB_MARK}
                          </a>
                        )}
                        <span className="plugins-version">v{selected.version}</span>
                      </div>
                    </div>
                    {selected.enabled && <span className="plugins-tag">启用中</span>}
                  </div>

                  <p className="plugins-description">{selected.description}</p>

                  {selected.type === 'selection-toolbar' && (
                    <div className="plugins-toolbar-meta">
                      <div className="plugins-toolbar-meta-row">
                        <span className="plugins-toolbar-meta-label">按钮名称</span>
                        <span>{selected.button_name}</span>
                      </div>
                      <div className="plugins-toolbar-meta-row">
                        <span className="plugins-toolbar-meta-label">匹配正则</span>
                        <code className="plugins-toolbar-regex">{selected.regex}</code>
                      </div>
                    </div>
                  )}

                  {selected.type === 'selection-toolbar' && (
                    <>
                      <div className="plugins-divider" />

                      <div className="plugins-switch-row">
                        <div>
                          <span className="plugins-switch-label">信任该插件</span>
                          <span className="plugins-switch-hint">
                            免沙箱插件需逐个确认风险后才会出现在文本选择工具栏；插件更新版本后需重新信任
                          </span>
                        </div>
                        {isTrusted(selected) ? (
                          <span className="plugins-tag">已信任</span>
                        ) : (
                          <button
                            className="plugins-trust-button"
                            disabled={busy}
                            onClick={() => requestTrust(selected)}
                          >
                            信任
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  <div className="plugins-divider" />

                  <div className="plugins-switch-row">
                    <div>
                      <span className="plugins-switch-label">启用插件</span>
                      <span className="plugins-switch-hint">
                        {PLUGIN_SECTIONS.find((s) => s.type === selected.type)?.switchHint}
                      </span>
                    </div>
                    <button
                      className={`toggle-switch ${selected.enabled ? 'on' : ''}`}
                      role="switch"
                      aria-checked={selected.enabled}
                      aria-label="启用插件"
                      disabled={busy}
                      onClick={handleToggleEnabled}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>

                  <div className="plugins-detail-actions">
                    <PopConfirm title={`确定删除插件「${selected.name}」？`} onConfirm={handleDelete}>
                      <button className="plugins-delete-button" disabled={busy}>
                        删除插件
                      </button>
                    </PopConfirm>
                  </div>
                </div>

                <pre className="plugins-code">{selected.code}</pre>
              </>
            ) : (
              loaded && (
                <div className="plugins-empty">
                  <p>选择左侧插件查看详情</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {trusting && (
        <PluginTrustModal
          plugin={trusting}
          onConfirm={handleTrustConfirm}
          onCancel={() => setTrusting(null)}
        />
      )}
    </div>
  );
}

export default PluginsView;
