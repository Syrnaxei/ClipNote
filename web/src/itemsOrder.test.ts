import { describe, expect, it } from 'vitest';
import {
  appendChronological,
  insertChronological,
  toChronological,
} from './itemsOrder';
import type { ClipboardItem } from './types';

function item(id: number, created_at: string): ClipboardItem {
  return {
    id,
    clipboard_id: 1,
    content: `内容 ${id}`,
    content_hash: `hash-${id}`,
    device: null,
    device_type: null,
    original_content: null,
    created_at,
  };
}

const early = item(1, '2026-01-01T00:00:00.000Z');
const middle = item(2, '2026-01-02T00:00:00.000Z');
const late = item(3, '2026-01-03T00:00:00.000Z');

describe('toChronological', () => {
  it('把服务端的倒序翻成正序，且不修改原数组', () => {
    const fromServer = [late, middle, early];
    expect(toChronological(fromServer).map((i) => i.id)).toEqual([1, 2, 3]);
    expect(fromServer.map((i) => i.id)).toEqual([3, 2, 1]);
  });

  it('空列表保持为空', () => {
    expect(toChronological([])).toEqual([]);
  });
});

describe('appendChronological', () => {
  it('新条目追加到末尾', () => {
    const result = appendChronological([early, middle], late);
    expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('同 id 重投递时只保留一份，并挪到末尾', () => {
    const result = appendChronological([early, middle], middle);
    expect(result.map((i) => i.id)).toEqual([1, 2]);
    expect(result[result.length - 1]).toBe(middle);
  });
});

describe('insertChronological', () => {
  it('按创建时间插到中间', () => {
    const result = insertChronological([early, late], middle);
    expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('比现有条目都新时落在末尾', () => {
    const result = insertChronological([early, middle], late);
    expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('比现有条目都旧时落在开头', () => {
    const result = insertChronological([middle, late], early);
    expect(result.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('时间相同时排在同刻条目之后', () => {
    const sameTime = item(9, middle.created_at);
    const result = insertChronological([early, middle, late], sameTime);
    expect(result.map((i) => i.id)).toEqual([1, 2, 9, 3]);
  });
});
