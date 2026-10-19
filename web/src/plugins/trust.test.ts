import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  loadTrustedKeys,
  saveTrustedKeys,
  setSkipTrustConfirm,
  shouldSkipTrustConfirm,
  trustKeyOf,
} from './trust';

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
});

describe('trust', () => {
  beforeEach(() => {
    store.clear();
  });

  it('trustKeyOf 由 id、version 与 128 位代码指纹组成', () => {
    const key = trustKeyOf({ id: 'a', version: '1.0.0', code: 'function process(i){return i}' });
    expect(key).toMatch(/^a@1\.0\.0@[0-9a-f]{32}$/);
    expect(key).toBe(trustKeyOf({ id: 'a', version: '1.0.0', code: 'function process(i){return i}' }));
  });

  it('同 id 同版本不同代码 → 信任键不同', () => {
    const a = trustKeyOf({ id: 'a', version: '1.0.0', code: 'function process(i){return i}' });
    const b = trustKeyOf({ id: 'a', version: '1.0.0', code: 'function process(i){return i+1}' });
    expect(a).not.toBe(b);
  });

  it('旧版无指纹键在加载时被作废并清除', () => {
    store.set('clipnote_trusted_plugins', JSON.stringify(['a@1.0.0']));
    expect(loadTrustedKeys()).toEqual([]);
    expect(store.has('clipnote_trusted_plugins')).toBe(false);
  });

  it('无存储时返回空数组', () => {
    expect(loadTrustedKeys()).toEqual([]);
  });

  it('保存后可读回', () => {
    saveTrustedKeys(['a@1.0.0@0123456789abcdef0123456789abcdef', 'b@2.1.3@ffffffffffffffffffffffffffffffff']);
    expect(loadTrustedKeys()).toEqual([
      'a@1.0.0@0123456789abcdef0123456789abcdef',
      'b@2.1.3@ffffffffffffffffffffffffffffffff',
    ]);
  });

  it('存储内容损坏时返回空数组', () => {
    store.set('clipnote_trusted_plugins_v2', 'not json');
    expect(loadTrustedKeys()).toEqual([]);
  });

  it('存储内容含非字符串时被过滤', () => {
    store.set('clipnote_trusted_plugins_v2', JSON.stringify(['ok', 1, null]));
    expect(loadTrustedKeys()).toEqual(['ok']);
  });

  it('不再提示开关默认关闭', () => {
    expect(shouldSkipTrustConfirm()).toBe(false);
  });

  it('不再提示开关可设置与清除', () => {
    setSkipTrustConfirm(true);
    expect(shouldSkipTrustConfirm()).toBe(true);
    setSkipTrustConfirm(false);
    expect(shouldSkipTrustConfirm()).toBe(false);
  });
});
