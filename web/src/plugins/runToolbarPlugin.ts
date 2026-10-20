import { copyText } from '../clipboard';
import {
  createToolbarBridge,
  type ToolbarBridge,
} from './toolbarBridge';

export class ToolbarPluginRunError extends Error {}

const RUN_TIMEOUT_MS = 3000;

// 沙箱源码：注入 clipnote 能力对象（postMessage 回主线程代跑），
// 首条 run 消息触发 process(input)。await 期间的能力往返也计入宿主超时。
const WORKER_SOURCE_PREFIX = `let callSeq = 0;
const pending = new Map();
function callCapability(cap, args) {
  return new Promise((resolve, reject) => {
    const id = ++callSeq;
    pending.set(id, { resolve, reject });
    self.postMessage({ type: 'capability', id, cap, args });
  });
}
self.clipnote = {
  open: (url) => callCapability('open', [url]),
  copy: (text) => callCapability('copy', [text]),
  storage: {
    get: (key) => callCapability('storageGet', [key]),
    set: (key, value) => callCapability('storageSet', [key, value]),
    remove: (key) => callCapability('storageRemove', [key]),
  },
  systemNotify: (title, body) => callCapability('systemNotify', [title, body]),
};
self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'capabilityResult') {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error));
    return;
  }
  try {
    const fn = new Function('input', '"use strict";\\n' + code + '\\n;return typeof process === "function" ? process : null;')(msg.input);
    if (!fn) {
      self.postMessage({ ok: false, error: '插件代码缺少 process(input) 函数' });
      return;
    }
    const result = await fn(msg.input);
    self.postMessage({ ok: true, result: typeof result === 'string' ? result : undefined });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};`;

export function buildToolbarWorkerSource(code: string): string {
  return `const code = ${JSON.stringify(code)};\n${WORKER_SOURCE_PREFIX}`;
}

async function showSystemNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined') {
    throw new ToolbarPluginRunError('当前环境不支持系统通知');
  }
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') {
    throw new ToolbarPluginRunError('系统通知权限被拒绝');
  }
  new Notification(title, { body });
}

function createBridge(pluginId: string): ToolbarBridge {
  return createToolbarBridge({
    pluginId,
    copy: copyText,
    open: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    notify: showSystemNotification,
  });
}

export async function runToolbarPlugin(
  code: string,
  input: string,
  pluginId: string,
  timeoutMs: number = RUN_TIMEOUT_MS,
): Promise<string | undefined> {
  const url = URL.createObjectURL(
    new Blob([buildToolbarWorkerSource(code)], { type: 'text/javascript' }),
  );
  const worker = new Worker(url, { name: 'cvt-toolbar-plugin' });
  const bridge = createBridge(pluginId);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new ToolbarPluginRunError(`插件执行超时(${timeoutMs / 1000}秒)`));
      }, timeoutMs);
      worker.onmessage = async (e: MessageEvent) => {
        const msg = e.data as {
          type?: string;
          id?: number;
          cap?: string;
          args?: unknown[];
          ok?: boolean;
          result?: unknown;
          error?: string;
        };
        if (msg.type === 'capability') {
          try {
            const result = await bridge(msg.cap ?? '', msg.args ?? []);
            worker.postMessage({ type: 'capabilityResult', id: msg.id, ok: true, result });
          } catch (err) {
            worker.postMessage({
              type: 'capabilityResult',
              id: msg.id,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          return;
        }
        if (msg.ok) {
          resolve(typeof msg.result === 'string' ? msg.result : undefined);
        } else {
          reject(new ToolbarPluginRunError(msg.error ?? '插件执行失败'));
        }
      };
      worker.onerror = (e) => {
        reject(new ToolbarPluginRunError(e.message || '插件执行失败'));
      };
      worker.postMessage({ type: 'run', input });
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    URL.revokeObjectURL(url);
    worker.terminate();
  }
}
