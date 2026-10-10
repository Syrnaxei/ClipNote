export interface Clipboard {
  id: number;
  name: string;
  uuid: string;
  pinned: boolean;
  created_at: string;
  item_count?: number;
  latest_item_at?: string | null;
}

export const DEVICE_TYPES = [
  'iPhone',
  'iPad',
  'Mac',
  'PC',
  'Web',
  'Unknown',
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];

export interface ClipboardItem {
  id: number;
  clipboard_id: number;
  content: string;
  content_hash: string;
  device: string | null;
  device_type: DeviceType | null;
  original_content: string | null;
  created_at: string;
}

export interface Plugin {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  github_url: string | null;
  code: string;
  enabled: boolean;
  created_at: string;
}

export interface DuplicateGroup {
  hash: string;
  items: ClipboardItem[];
}

export type WsEvent =
  | { type: 'clipboard.created'; payload: Clipboard }
  | { type: 'clipboard.updated'; payload: Clipboard }
  | { type: 'clipboard.deleted'; payload: { id: number } }
  | { type: 'item.created'; payload: ClipboardItem }
  | { type: 'item.updated'; payload: ClipboardItem }
  | { type: 'item.moved'; payload: { item: ClipboardItem; fromClipboardId: number } }
  | { type: 'item.deleted'; payload: { id: number; clipboardId: number } };
