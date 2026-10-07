// 项目更名迁移：把旧前缀 localStorage 键搬到新键（新键已有值时不覆盖），并移除旧键
export function migrateStorageKey(oldKey: string, newKey: string): void {
  const legacy = localStorage.getItem(oldKey);
  if (legacy === null) return;
  if (localStorage.getItem(newKey) === null) {
    localStorage.setItem(newKey, legacy);
  }
  localStorage.removeItem(oldKey);
}
