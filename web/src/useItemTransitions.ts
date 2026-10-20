import { useEffect, useRef, useState } from 'react';
import type { ClipboardItem } from './types';
import { MOTION, motionDelay } from './motion';

export interface RenderItem {
  item: ClipboardItem;
  entering?: boolean;
  exiting?: boolean;
}

/**
 * 给条目列表补上「进场 / 退场」的渲染信息。
 *
 * - 新出现的条目标记 entering，播 300ms 纸张落下；
 * - 从数据里消失的条目保留 180ms 的退场位（ghost），让高度塌陷带动下方上移；
 * - 首次拿到内容不做进场，避免整屏一起落；
 * - `scopeKey`（剪切板 id）变化时整体换页：清空进出场状态，一条都不动，
 *   否则上一个剪切板的条目会被当成「被删除」而集体塌陷，新的一批又会集体落下。
 */
export function useItemTransitions(
  items: ClipboardItem[],
  scopeKey: number | null = null,
): RenderItem[] {
  const [enteringIds, setEnteringIds] = useState<number[]>([]);
  const [ghosts, setGhosts] = useState<{ item: ClipboardItem; index: number }[]>([]);
  const seenRef = useRef<Set<number>>(new Set());
  const prevRef = useRef<ClipboardItem[]>([]);
  const scopeRef = useRef<number | null>(scopeKey);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  useEffect(() => {
    if (scopeRef.current !== scopeKey) {
      scopeRef.current = scopeKey;
      seenRef.current = new Set(items.map((item) => item.id));
      prevRef.current = items;
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      setEnteringIds([]);
      setGhosts([]);
      return;
    }

    const prev = prevRef.current;
    prevRef.current = items;

    // 首次渲染（或切换剪切板后的空列表）只记账，不播进场
    if (prev.length === 0) {
      items.forEach((item) => seenRef.current.add(item.id));
      setEnteringIds([]);
      return;
    }

    const fresh = items.filter((item) => !seenRef.current.has(item.id));
    fresh.forEach((item) => seenRef.current.add(item.id));
    if (fresh.length > 0) {
      const ids = fresh.map((item) => item.id);
      setEnteringIds((cur) => [...cur, ...ids]);
      timersRef.current.push(
        window.setTimeout(() => {
          setEnteringIds((cur) => cur.filter((id) => !ids.includes(id)));
        }, motionDelay(MOTION.listIn)),
      );
    }

    const nextIds = new Set(items.map((item) => item.id));
    const gone = prev
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !nextIds.has(item.id));
    if (gone.length > 0) {
      const goneIds = gone.map((g) => g.item.id);
      setGhosts((cur) => [
        ...cur,
        ...gone.filter((g) => !cur.some((c) => c.item.id === g.item.id)),
      ]);
      timersRef.current.push(
        window.setTimeout(() => {
          setGhosts((cur) => cur.filter((g) => !goneIds.includes(g.item.id)));
        }, motionDelay(MOTION.listOut) + 20),
      );
    }
  }, [items]);

  const merged: RenderItem[] = items.map((item) => ({
    item,
    entering: enteringIds.includes(item.id),
  }));

  ghosts.forEach(({ item, index }) => {
    merged.splice(Math.min(index, merged.length), 0, { item, exiting: true });
  });

  return merged;
}
