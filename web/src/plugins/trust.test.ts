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

  it('trustKeyOf 由 id 与 version 组成', () => {
    expect(trustKeyOf({ id: 'a', version: '1.0.0' })).toBe('a@1.0.0');
  });

  it('无存储时返回空数组', () => {
    expect(loadTrustedKeys()).toEqual([]);
  });

  it('保存后可读回', () => {
    saveTrustedKeys(['a@1.0.0', 'b@2.1.3']);
    expect(loadTrustedKeys()).toEqual(['a@1.0.0', 'b@2.1.3']);
  });

  it('存储内容损坏时返回空数组', () => {
    store.set('clipnote_trusted_plugins', 'not json');
    expect(loadTrustedKeys()).toEqual([]);
  });

  it('存储内容含非字符串时被过滤', () => {
    store.set('clipnote_trusted_plugins', JSON.stringify(['ok', 1, null]));
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
