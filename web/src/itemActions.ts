import { migrateStorageKey } from './storage';

export type ItemActionId = 'plugin' | 'edit' | 'move' | 'delete' | 'copy';

export const ITEM_ACTIONS: { id: ItemActionId; label: string; desc: string }[] = [
  { id: 'plugin', label: '插件', desc: '悬停条目时应用启用中的插件' },
  { id: 'edit', label: '编辑', desc: '修改条目内容' },
  { id: 'move', label: '转移', desc: '将条目转移到其他剪切板' },
  { id: 'delete', label: '删除', desc: '删除该条目' },
  { id: 'copy', label: '复制', desc: '复制条目内容' },
];

export interface ItemActionSetting {
  order: ItemActionId[];
  hidden: ItemActionId[];
}

const STORAGE_KEY = 'clipnote_item_actions';
migrateStorageKey('clipvault_item_actions', STORAGE_KEY);
const DEFAULT_ORDER: ItemActionId[] = ITEM_ACTIONS.map((a) => a.id);

export function loadItemActions(): ItemActionSetting {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const savedOrder: ItemActionId[] = Array.isArray(parsed?.order)
        ? parsed.order.filter((id: unknown) =>
            DEFAULT_ORDER.includes(id as ItemActionId),
          )
        : [];
      const hidden: ItemActionId[] = Array.isArray(parsed?.hidden)
        ? parsed.hidden.filter((id: unknown) =>
            DEFAULT_ORDER.includes(id as ItemActionId),
          )
        : [];
      const order = [
        ...savedOrder,
        ...DEFAULT_ORDER.filter((id) => !savedOrder.includes(id)),
      ];
      return { order, hidden };
    }
  } catch {
    // fall through to default
  }
  return { order: [...DEFAULT_ORDER], hidden: [] };
}

export function saveItemActions(setting: ItemActionSetting): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(setting));
}
