import type { ClipboardItem } from './types';

/**
 * 条目列表的排列顺序是「时间正序」：最旧在上，最新在下。
 *
 * 服务端 `GET /api/clipboards/:id/items` 仍按 `created_at DESC` 返回（API 契约不变），
 * 客户端在这里统一翻转一次，之后所有消费方拿到的都是正序，渲染层直接顺序铺开即可。
 */
export function toChronological(items: ClipboardItem[]): ClipboardItem[] {
  return items.slice().reverse();
}

/**
 * 新条目落在列表末尾（即最新位置）。
 * 先按 id 剔除同名条目，避免 WS 重投递时出现重复卡片。
 */
export function appendChronological(
  list: ClipboardItem[],
  item: ClipboardItem,
): ClipboardItem[] {
  return [...list.filter((existing) => existing.id !== item.id), item];
}

/** 转移进来的条目按创建时间插回正序，时间相同时排在同刻条目之后。 */
export function insertChronological(
  list: ClipboardItem[],
  item: ClipboardItem,
): ClipboardItem[] {
  const rest = list.filter((existing) => existing.id !== item.id);
  const index = rest.findIndex((existing) => existing.created_at > item.created_at);
  const at = index === -1 ? rest.length : index;
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}
