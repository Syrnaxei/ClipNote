import type { Plugin } from '../types';

export interface ToolbarPlugin {
  id: string;
  name: string;
  buttonName: string;
  pattern: RegExp | null;
}

export function toToolbarPlugins(plugins: Plugin[]): ToolbarPlugin[] {
  return plugins.map((p) => {
    let pattern: RegExp | null = null;
    if (p.regex) {
      try {
        pattern = new RegExp(p.regex);
      } catch {
        pattern = null;
      }
    }
    return { id: p.id, name: p.name, buttonName: p.button_name || p.name, pattern };
  });
}

export function matchToolbarPlugins(
  text: string,
  plugins: ToolbarPlugin[],
): ToolbarPlugin[] {
  if (!text) return [];
  return plugins.filter((p) => {
    try {
      return p.pattern !== null && p.pattern.test(text);
    } catch {
      return false;
    }
  });
}

// 灾难性回溯的正则可能冻结主线程，匹配放进 Worker 以便超时后 terminate。
// 用 toString() 注入上述纯函数，避免 Worker 内外两份匹配逻辑。
const MATCH_TIMEOUT_MS = 3000;

function buildMatchWorkerSource(): string {
  return `self.onmessage = (e) => {
  const { text, plugins } = e.data;
  try {
    const compiled = (${toToolbarPlugins.toString()})(plugins);
    const matched = (${matchToolbarPlugins.toString()})(text, compiled);
    self.postMessage({ ok: true, ids: matched.map((p) => p.id) });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};`;
}

export function matchToolbarPluginsAsync(
  text: string,
  compiled: ToolbarPlugin[],
): Promise<ToolbarPlugin[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([buildMatchWorkerSource()], { type: 'text/javascript' }),
    );
    const worker = new Worker(url, { name: 'cvt-plugin-match' });
    const cleanup = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`插件匹配超时(${MATCH_TIMEOUT_MS / 1000}秒)`));
    }, MATCH_TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent<{ ok: boolean; ids?: string[]; error?: string }>) => {
      cleanup();
      if (e.data.ok && e.data.ids) {
        const ids = new Set(e.data.ids);
        resolve(compiled.filter((p) => ids.has(p.id)));
      } else {
        reject(new Error(e.data.error ?? '插件匹配失败'));
      }
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('插件匹配失败'));
    };
    worker.postMessage({
      text,
      plugins: compiled.map((p) => ({
        id: p.id,
        name: p.name,
        button_name: p.buttonName,
        regex: p.pattern ? p.pattern.source : null,
      })),
    });
  });
}
