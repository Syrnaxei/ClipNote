export interface TrustTarget {
  id: string;
  version: string;
}

const TRUSTED_KEY = 'clipnote_trusted_plugins_v2';
// v1 键只含 id@version、无代码指纹，升级后整体作废并在加载时清除
const LEGACY_TRUSTED_KEY = 'clipnote_trusted_plugins';
const SKIP_CONFIRM_KEY = 'clipnote_trust_skip_confirm';

// cyrb128：4 路 32 位混合输出 128 位十六进制指纹。信任键必须绑定代码内容，
// 否则同 id 同版本换码即可继承旧信任（审计 H3）。
function fingerprint(code: string): string {
  let h1 = 1779033703 ^ code.length;
  let h2 = 3144134277 ^ code.length;
  let h3 = 1013904242 ^ code.length;
  let h4 = 2773480762 ^ code.length;
  for (let i = 0; i < code.length; i++) {
    const k = code.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1 ^ h2 ^ h3 ^ h4) + hex(h2 ^ h1) + hex(h3 ^ h1) + hex(h4 ^ h1);
}

export function trustKeyOf(p: TrustTarget & { code: string }): string {
  return `${p.id}@${p.version}@${fingerprint(p.code)}`;
}

export function loadTrustedKeys(): string[] {
  localStorage.removeItem(LEGACY_TRUSTED_KEY);
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TRUSTED_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveTrustedKeys(keys: string[]): void {
  localStorage.setItem(TRUSTED_KEY, JSON.stringify(keys));
}

export function shouldSkipTrustConfirm(): boolean {
  return localStorage.getItem(SKIP_CONFIRM_KEY) === '1';
}

export function setSkipTrustConfirm(skip: boolean): void {
  if (skip) localStorage.setItem(SKIP_CONFIRM_KEY, '1');
  else localStorage.removeItem(SKIP_CONFIRM_KEY);
}
