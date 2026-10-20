import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginStorage,
  createToolbarBridge,
  ToolbarCapabilityError,
  validateOpenUrl,
} from './toolbarBridge';
import { buildToolbarWorkerSource } from './runToolbarPlugin';

// vitest 无配置文件，默认 node 环境无 localStorage，用 Map 桩替代。
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  });
  return store;
}

describe('validateOpenUrl', () => {
  it('放行 http/https 并返回规范化 href', () => {
    expect(validateOpenUrl('https://douban.com/search?q=1')).toBe(
      'https://douban.com/search?q=1',
    );
    expect(validateOpenUrl('http://example.com')).toBe('http://example.com/');
  });

  it('拒绝非 http/https 协议', () => {
    expect(() => validateOpenUrl('javascript:alert(1)')).toThrow(ToolbarCapabilityError);
    expect(() => validateOpenUrl('file:///etc/passwd')).toThrow('仅支持 http/https 链接');
  });

  it('拒绝非字符串与非法链接', () => {
    expect(() => validateOpenUrl(123)).toThrow('url 必须是字符串');
    expect(() => validateOpenUrl('not a url')).toThrow('url 不是合法链接');
  });
});

describe('createToolbarBridge', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  const deps = () => ({
    pluginId: 'p1',
    copy: vi.fn().mockResolvedValue(true),
    open: vi.fn(),
    notify: vi.fn().mockResolvedValue(undefined),
  });

  it('open 校验通过后交给宿主', async () => {
    const d = deps();
    await createToolbarBridge(d)('open', ['https://a.com']);
    expect(d.open).toHaveBeenCalledWith('https://a.com/');
  });

  it('copy 原样转交并返回结果', async () => {
    const d = deps();
    await expect(createToolbarBridge(d)('copy', ['hi'])).resolves.toBe(true);
    expect(d.copy).toHaveBeenCalledWith('hi');
  });

  it('storage 按插件 id 隔离', async () => {
    const bridge = createToolbarBridge(deps());
    await bridge('storageSet', ['token', 'abc']);
    await expect(bridge('storageGet', ['token'])).resolves.toBe('abc');
    expect(localStorage.getItem('clipnote_plugin_storage:p1:token')).toBe('abc');

    const other = createToolbarBridge({ ...deps(), pluginId: 'p2' });
    await expect(other('storageGet', ['token'])).resolves.toBeNull();
  });

  it('storageRemove 删除条目', async () => {
    const bridge = createToolbarBridge(deps());
    await bridge('storageSet', ['k', 'v']);
    await bridge('storageRemove', ['k']);
    await expect(bridge('storageGet', ['k'])).resolves.toBeNull();
  });

  it('storage 拒绝非字符串 key/value', async () => {
    const bridge = createToolbarBridge(deps());
    await expect(bridge('storageSet', ['k', 42])).rejects.toThrow('storage value 必须是字符串');
    await expect(bridge('storageGet', [null])).rejects.toThrow('storage key 必须是字符串');
    await expect(bridge('storageSet', ['', 'v'])).rejects.toThrow('storage key 不能为空');
  });

  it('systemNotify 转交 title/body，body 缺省为空串', async () => {
    const d = deps();
    const bridge = createToolbarBridge(d);
    await bridge('systemNotify', ['完成', '详情']);
    expect(d.notify).toHaveBeenCalledWith('完成', '详情');
    await bridge('systemNotify', ['仅标题']);
    expect(d.notify).toHaveBeenLastCalledWith('仅标题', '');
  });

  it('未知能力报错', async () => {
    await expect(createToolbarBridge(deps())('hack', [])).rejects.toThrow('未知能力: hack');
  });
});

describe('clearPluginStorage', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it('只清理指定插件前缀的条目', () => {
    localStorage.setItem('clipnote_plugin_storage:p1:a', '1');
    localStorage.setItem('clipnote_plugin_storage:p1:b', '2');
    localStorage.setItem('clipnote_plugin_storage:p2:a', '3');
    localStorage.setItem('unrelated', '4');

    clearPluginStorage('p1');

    expect(localStorage.getItem('clipnote_plugin_storage:p1:a')).toBeNull();
    expect(localStorage.getItem('clipnote_plugin_storage:p1:b')).toBeNull();
    expect(localStorage.getItem('clipnote_plugin_storage:p2:a')).toBe('3');
    expect(localStorage.getItem('unrelated')).toBe('4');
  });
});

describe('buildToolbarWorkerSource', () => {
  it('注入 clipnote 全局并内嵌插件代码', () => {
    const src = buildToolbarWorkerSource('function process(i){return i}');
    expect(src).toContain('self.clipnote');
    expect(src).toContain('callCapability');
    expect(src).toContain(JSON.stringify('function process(i){return i}'));
  });
});
