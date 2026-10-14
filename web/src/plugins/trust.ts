export interface TrustTarget {
  id: string;
  version: string;
}

const TRUSTED_KEY = 'clipnote_trusted_plugins';
const SKIP_CONFIRM_KEY = 'clipnote_trust_skip_confirm';

export function trustKeyOf(p: TrustTarget): string {
  return `${p.id}@${p.version}`;
}

export function loadTrustedKeys(): string[] {
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
