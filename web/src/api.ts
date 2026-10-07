import type { Clipboard, ClipboardItem, DuplicateGroup, Plugin } from './types';
import { migrateStorageKey } from './storage';

const KEY_STORAGE = 'clipnote_api_key';
migrateStorageKey('clipvault_api_key', KEY_STORAGE);

let apiKey = localStorage.getItem(KEY_STORAGE) ?? '';

export class ApiKeyError extends Error {}

export function hasApiKey(): boolean {
  return apiKey.length > 0;
}

export function getApiKey(): string {
  return apiKey;
}

export function setApiKey(key: string): void {
  apiKey = key.trim();
  localStorage.setItem(KEY_STORAGE, apiKey);
}

export function clearApiKey(): void {
  apiKey = '';
  localStorage.removeItem(KEY_STORAGE);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (res.status === 401) {
    throw new ApiKeyError('Invalid API key');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  listClipboards: () =>
    request<{ clipboards: Clipboard[] }>('/api/clipboards'),
  createClipboard: (name: string) =>
    request<{ clipboard: Clipboard }>('/api/clipboards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteClipboard: (id: number) =>
    request<void>(`/api/clipboards/${id}`, { method: 'DELETE' }),
  updateClipboard: (id: number, data: { name?: string; uuid?: string }) =>
    request<{ clipboard: Clipboard }>(`/api/clipboards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  setClipboardPinned: (id: number, pinned: boolean) =>
    request<{ clipboard: Clipboard }>(`/api/clipboards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    }),
  listItems: (clipboardId: number) =>
    request<{ items: ClipboardItem[] }>(`/api/clipboards/${clipboardId}/items`),
  createItem: (
    clipboardUuid: string,
    content: string,
    deviceInfo?: { device: string; device_type: string },
  ) =>
    request<{ item: ClipboardItem }>('/api/items', {
      method: 'POST',
      body: JSON.stringify({ clipboard_uuid: clipboardUuid, content, ...deviceInfo }),
    }),
  updateItem: (
    id: number,
    content: string,
    originalContent?: string | null,
  ) =>
    request<{ item: ClipboardItem }>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(
        originalContent === undefined
          ? { content }
          : { content, original_content: originalContent },
      ),
    }),
  deleteItem: (id: number) =>
    request<void>(`/api/items/${id}`, { method: 'DELETE' }),
  duplicates: (clipboardId: number) =>
    request<{ groups: DuplicateGroup[] }>(`/api/clipboards/${clipboardId}/duplicates`),
  listPlugins: () => request<{ plugins: Plugin[] }>('/api/plugins'),
  createPlugin: (data: {
    id: string;
    name: string;
    author: string;
    version: string;
    description: string;
    github_url?: string | null;
    code: string;
  }) =>
    request<{ plugin: Plugin }>('/api/plugins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePlugin: (
    id: string,
    data: {
      name?: string;
      author?: string;
      version?: string;
      description?: string;
      github_url?: string | null;
      code?: string;
      enabled?: boolean;
    },
  ) =>
    request<{ plugin: Plugin }>(`/api/plugins/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePlugin: (id: string) =>
    request<void>(`/api/plugins/${id}`, { method: 'DELETE' }),
};
