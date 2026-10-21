import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ClipboardItem } from './types';
import { MOTION, motionDelay, prefersReducedMotion, SHIFT_EASE } from './motion';

export interface ItemTransitions {
  entering: ReadonlySet<number>;
}

const EMPTY_IDS: ReadonlySet<number> = new Set();
const SHIFT_ANIMATION_ID = 'clipnote-list-shift';

function measurePositions(container: HTMLElement): Map<number, number> {
  const positions = new Map<number, number>();
  container
    .querySelectorAll<HTMLElement>(':scope > [data-item-id]')
    .forEach((el) => {
      const id = Number(el.dataset.itemId);
      if (!Number.isFinite(id)) return;
      positions.set(id, el.offsetTop);
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
 * - 新条目：占好最终位置后，卡片自身从上方 10px 落下（CSS keyframes）；
 *   旧条目用 FLIP 从原位置滑到新位置，像拖拽时整行让位。
 * - 删除条目：直接从 DOM 消失，不留退场 ghost；下方条目立即用 FLIP
 *   上移补位，仍然沿用设置拖拽的 250ms 曲线。
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
  const initializedRef = useRef(false);
  const awaitingFirstContentRef = useRef(false);
  const scopeRef = useRef<number | null>(scopeKey);
  const seenRef = useRef<Set<number>>(new Set());
  const prevRef = useRef<Map<number, number>>(new Map());
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
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      initializedRef.current = true;
      scopeRef.current = scopeKey;
      awaitingFirstContentRef.current = !ready;
      seenRef.current = new Set(currentIds);
      prevRef.current = positions;
      cancelShiftAnimations(container);
      setEntering(EMPTY_IDS);
      return;
    }

    // 首屏内容 / 切换剪切板后的首批内容只记账，避免整屏一起落下
    if (awaitingFirstContentRef.current) {
      prevRef.current = positions;
      if (!ready) return;
      awaitingFirstContentRef.current = false;
      seenRef.current = new Set(currentIds);
      return;
    }

    prevRef.current = positions;

    // 减少动态效果：不播落下与让位，行为退化为瞬切
    if (prefersReducedMotion()) {
      items.forEach((item) => seenRef.current.add(item.id));
      setEntering(EMPTY_IDS);
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

    // FLIP：删除的条目已经从 DOM 消失，下方条目立即从旧布局位置滑到新位置。
    // offsetTop 不受 transform 影响，所以连续增删时拿到的始终是稳定布局位置。
    items.forEach((item) => {
      const from = prev.get(item.id);
      const to = positions.get(item.id);
      if (from === undefined || to === undefined) return;
      const delta = from - to;
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

  return { entering };
}
