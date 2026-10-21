import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ClipboardItem } from './types';
import { MOTION, motionDelay, prefersReducedMotion, SHIFT_EASE } from './motion';

export interface ExitingItem {
  item: ClipboardItem;
  top: number;
  left: number;
  width: number;
}

export interface ItemTransitions {
  entering: ReadonlySet<number>;
  exiting: ExitingItem[];
}

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Snapshot {
  items: ClipboardItem[];
  positions: Map<number, Position>;
}

const EMPTY_IDS: ReadonlySet<number> = new Set();
const SHIFT_ANIMATION_ID = 'clipnote-list-shift';

function measurePositions(container: HTMLElement): Map<number, Position> {
  const positions = new Map<number, Position>();
  container
    .querySelectorAll<HTMLElement>(':scope > [data-item-id]')
    .forEach((el) => {
      const id = Number(el.dataset.itemId);
      if (!Number.isFinite(id)) return;
      positions.set(id, {
        top: el.offsetTop,
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
    });
  return positions;
}

function cancelShiftAnimations(container: HTMLElement): void {
  container
    .querySelectorAll<HTMLElement>(':scope > [data-item-id]')
    .forEach((el) => {
      el.getAnimations().forEach((animation) => {
        if (animation.id === SHIFT_ANIMATION_ID) animation.cancel();
      });
    });
}

/**
 * 条目列表的「添加 / 删除」让位动效。
 *
 * 与设置里拖动行共用一套语言：位移只走 transform，250ms、
 * cubic-bezier(0.65, 0, 0.35, 1)，卡片动的时候带一点抬升阴影。
 *
 * - 新条目：占好最终位置后，卡片自身从上方 10px 落下（CSS keyframes）；
 *   旧条目用 FLIP 从原位置滑到新位置，像拖拽时整行让位。
 * - 删除条目：先从 DOM 移除并留下一个绝对定位的 ghost，ghost 在原位
 *   抬升淡出；下方条目同样用 FLIP 上移补位，不再收缩容器高度。
 * - 首屏 / 切换剪切板时只记账不播动画；`ready` 用于区分「还在加载」和
 *   「确实是一条空列表」，空列表之后的第一条仍然会正常落下。
 */
export function useItemTransitions(
  items: ClipboardItem[],
  scopeKey: number | null,
  containerRef: RefObject<HTMLElement | null>,
  ready = true,
): ItemTransitions {
  const [entering, setEntering] = useState<ReadonlySet<number>>(EMPTY_IDS);
  const [exiting, setExiting] = useState<ExitingItem[]>([]);
  const initializedRef = useRef(false);
  const awaitingFirstContentRef = useRef(false);
  const scopeRef = useRef<number | null>(scopeKey);
  const seenRef = useRef<Set<number>>(new Set());
  const prevRef = useRef<Snapshot>({ items: [], positions: new Map() });
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const positions = measurePositions(container);
    const currentIds = new Set(items.map((item) => item.id));
    const prev = prevRef.current;
    const scopeChanged =
      !initializedRef.current || scopeRef.current !== scopeKey;

    if (scopeChanged) {
      const reset = () => {
        timersRef.current.forEach((timer) => window.clearTimeout(timer));
        timersRef.current.clear();
      };
      initializedRef.current = true;
      scopeRef.current = scopeKey;
      awaitingFirstContentRef.current = !ready;
      seenRef.current = new Set(currentIds);
      prevRef.current = { items, positions };
      reset();
      cancelShiftAnimations(container);
      setEntering(EMPTY_IDS);
      setExiting((cur) => (cur.length === 0 ? cur : []));
      return;
    }

    // 首屏内容 / 切换剪切板后的首批内容只记账，避免整屏一起落下
    if (awaitingFirstContentRef.current) {
      prevRef.current = { items, positions };
      if (!ready) return;
      awaitingFirstContentRef.current = false;
      seenRef.current = new Set(currentIds);
      return;
    }

    prevRef.current = { items, positions };

    // 减少动态效果：不建 ghost、不播落下与让位，行为退化为瞬切
    if (prefersReducedMotion()) {
      items.forEach((item) => seenRef.current.add(item.id));
      setEntering(EMPTY_IDS);
      setExiting((cur) => (cur.length === 0 ? cur : []));
      return;
    }

    const fresh = items.filter((item) => !seenRef.current.has(item.id));
    fresh.forEach((item) => seenRef.current.add(item.id));
    if (fresh.length > 0) {
      const freshIds = new Set(fresh.map((item) => item.id));
      setEntering((cur) => new Set([...cur, ...freshIds]));
      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        setEntering((cur) => {
          let changed = false;
          const next = new Set(cur);
          freshIds.forEach((id) => {
            if (next.delete(id)) changed = true;
          });
          return changed ? next : cur;
        });
      }, motionDelay(MOTION.listIn));
      timersRef.current.add(timer);
    }

    const gone = prev.items.filter((item) => !currentIds.has(item.id));
    if (gone.length > 0) {
      const ghosts = gone.flatMap<ExitingItem>((item) => {
        const position = prev.positions.get(item.id);
        if (!position) return [];
        return [
          {
            item,
            top: position.top,
            left: position.left,
            width: position.width,
          },
        ];
      });
      if (ghosts.length > 0) {
        const goneIds = new Set(ghosts.map((ghost) => ghost.item.id));
        setExiting((cur) => {
          const existing = new Set(cur.map((ghost) => ghost.item.id));
          const added = ghosts.filter((ghost) => !existing.has(ghost.item.id));
          return added.length === 0 ? cur : [...cur, ...added];
        });
        const timer = window.setTimeout(() => {
          timersRef.current.delete(timer);
          setExiting((cur) => cur.filter((ghost) => !goneIds.has(ghost.item.id)));
        }, motionDelay(MOTION.listOut) + 20);
        timersRef.current.add(timer);
      }
    }

    // FLIP：按旧布局位置和新布局位置的差值反推 transform，再滑回 0。
    // offsetTop 不受 transform 影响，所以连续增删时拿到的始终是稳定布局位置。
    items.forEach((item) => {
      const from = prev.positions.get(item.id);
      const to = positions.get(item.id);
      if (!from || !to) return;
      const delta = from.top - to.top;
      if (Math.abs(delta) < 0.5) return;

      const el = container.querySelector<HTMLElement>(
        `[data-item-id="${item.id}"]`,
      );
      if (!el) return;
      el.getAnimations().forEach((animation) => {
        if (animation.id === SHIFT_ANIMATION_ID) animation.cancel();
      });

      const animation = el.animate(
        [
          { transform: `translateY(${delta}px)` },
          { transform: 'translateY(0)' },
        ],
        {
          duration: MOTION.listShift,
          easing: SHIFT_EASE,
          fill: 'both',
        },
      );
      animation.id = SHIFT_ANIMATION_ID;
      animation.addEventListener(
        'finish',
        () => {
          animation.cancel();
        },
        { once: true },
      );
    });
  }, [items, scopeKey, ready, containerRef]);

  return { entering, exiting };
}
