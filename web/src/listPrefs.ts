import { migrateStorageKey } from './storage';

const FOLLOW_ON_ADD_KEY = 'clipnote_follow_on_add';
migrateStorageKey('clipvault_follow_on_add', FOLLOW_ON_ADD_KEY);

/**
 * 自己添加条目后是否自动滚到最新一条。
 *
 * 默认开启：刚在底部输入框敲完回车，理应马上看到结果。
 * 关掉之后自己添加的条目和其他设备推来的条目一样，只在已经贴底时才跟随。
 */
export function loadFollowOnAdd(): boolean {
  const saved = localStorage.getItem(FOLLOW_ON_ADD_KEY);
  return saved === null ? true : saved === '1';
}

export function saveFollowOnAdd(value: boolean): void {
  localStorage.setItem(FOLLOW_ON_ADD_KEY, value ? '1' : '0');
}
