// 能力桥宿主端：接收沙箱内插件发来的能力请求，校验后代为执行。
// 隔离本身由 Worker 容器提供（见 ADR 0003）；这里的校验是能力语义的地板。

export class ToolbarCapabilityError extends Error {}

const PLUGIN_STORAGE_PREFIX = 'clipnote_plugin_storage';

export interface ToolbarBridgeDeps {
  pluginId: string;
  copy: (text: string) => Promise<boolean>;
  open: (url: string) => void;
  notify: (title: string, body: string) => void | Promise<void>;
}

function mustString(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new ToolbarCapabilityError(`${name} 必须是字符串`);
  }
  return value;
}

// open 的两行地板：仅放行 http/https，返回规范化后的 href。
export function validateOpenUrl(url: unknown): string {
  const raw = mustString(url, 'url');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ToolbarCapabilityError('url 不是合法链接');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ToolbarCapabilityError('仅支持 http/https 链接');
  }
  return parsed.href;
}

function storageKeyOf(pluginId: string, key: string): string {
  return `${PLUGIN_STORAGE_PREFIX}:${pluginId}:${key}`;
}

function mustStorageKey(key: unknown): string {
  const k = mustString(key, 'storage key');
  if (k.length === 0) throw new ToolbarCapabilityError('storage key 不能为空');
  return k;
}

// 删除插件时清理其全部私有 KV。
export function clearPluginStorage(pluginId: string): void {
  const prefix = `${PLUGIN_STORAGE_PREFIX}:${pluginId}:`;
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k !== null && k.startsWith(prefix)) doomed.push(k);
  }
  for (const k of doomed) localStorage.removeItem(k);
}

export type ToolbarBridge = (cap: string, args: unknown[]) => Promise<unknown>;

export function createToolbarBridge(deps: ToolbarBridgeDeps): ToolbarBridge {
  return async (cap, args) => {
    switch (cap) {
      case 'open': {
        const href = validateOpenUrl(args[0]);
        deps.open(href);
        return undefined;
      }
      case 'copy': {
        const text = mustString(args[0], 'text');
        return await deps.copy(text);
      }
      case 'storageGet': {
        const key = mustStorageKey(args[0]);
        return localStorage.getItem(storageKeyOf(deps.pluginId, key));
      }
      case 'storageSet': {
        const key = mustStorageKey(args[0]);
        const value = mustString(args[1], 'storage value');
        localStorage.setItem(storageKeyOf(deps.pluginId, key), value);
        return undefined;
      }
      case 'storageRemove': {
        const key = mustStorageKey(args[0]);
        localStorage.removeItem(storageKeyOf(deps.pluginId, key));
        return undefined;
      }
      case 'systemNotify': {
        const title = mustString(args[0], 'title');
        const body = args[1] === undefined ? '' : mustString(args[1], 'body');
        await deps.notify(title, body);
        return undefined;
      }
      default:
        throw new ToolbarCapabilityError(`未知能力: ${cap}`);
    }
  };
}
