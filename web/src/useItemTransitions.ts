import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ClipboardItem } from './types';
import { MOTION, motionDelay, prefersReducedMotion, SHIFT_EASE } from './motion';

export interface ItemTransitions {
  entering: ReadonlySet<number>;
}

const EMPTY_IDS: ReadonlySet<number> = new Set();
const SHIFT_ANIMATION_ID = 'clipnote-list-shift';

/**
 * 让位只处理「一行左右」的位移。超过这个距离就不是让位了，而是滚动跳转
 * （例如在顶部时自己添加条目、被拽到最新一条）：这时整屏卡片一起滑动会互相压住，
 * 所以直接跟随滚动瞬移，只保留新卡片自己的进场。
 */
const MAX_SHIFT = 200;

/** 一次提交结束时的布局快照，用来算 FLIP 的起点。 */
interface Snapshot {
  /** 每个条目的布局位置；offsetTop 不受 transform 影响，连续增删时始终稳定 */
  offsets: Map<number, number>;
  /** 采样这一刻的 scrollTop */
  scrollTop: number;
}

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
 * 列表按时间正序排列（最旧在上、最新在下）并贴着容器底部生长，于是：
 * - 新条目追加到末尾，占好最终位置后卡片自身从下方 10px 升起（CSS keyframes）；
 *   其余条目用 FLIP 从原位置向上滑一行，像从输入框上方抽走一张纸之后的复位。
 * - 删除条目：直接从 DOM 消失，不留退场 ghost；因为它抵着底部，上方的条目
 *   向下滑进空位，仍然沿用设置拖拽的 250ms 曲线。
 * - 首屏 / 切换剪切板时只记账不播动画；`ready` 用于区分「还在加载」和
 *   「确实是一条空列表」，空列表之后的第一条仍然会正常升起。
 *
 * FLIP 的位移必须按「布局位置 − 滚动位置」计算：贴着底部跟随新条目时会同步
 * 调整 scrollTop，只看 offsetTop 会把滚动带来的视觉位移算错，条目就会跳一下。
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
  const snapshotRef = useRef<Snapshot>({ offsets: new Map(), scrollTop: 0 });
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  // 用户手动滚动时同步快照，否则下一次增删会把「滚动」误算成「布局位移」
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      snapshotRef.current = {
        ...snapshotRef.current,
        scrollTop: container.scrollTop,
      };
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [containerRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const offsets = measurePositions(container);
    const scrollTop = container.scrollTop;
    const currentIds = new Set(items.map((item) => item.id));
    const prev = snapshotRef.current;
    const scopeChanged =
      !initializedRef.current || scopeRef.current !== scopeKey;

    if (scopeChanged) {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      initializedRef.current = true;
      scopeRef.current = scopeKey;
      awaitingFirstContentRef.current = !ready;
      seenRef.current = new Set(currentIds);
      snapshotRef.current = { offsets, scrollTop };
      cancelShiftAnimations(container);
      setEntering(EMPTY_IDS);
      return;
    }

    // 首屏内容 / 切换剪切板后的首批内容只记账，避免整屏一起升起
    if (awaitingFirstContentRef.current) {
      snapshotRef.current = { offsets, scrollTop };
      if (!ready) return;
      awaitingFirstContentRef.current = false;
      seenRef.current = new Set(currentIds);
      return;
    }

    snapshotRef.current = { offsets, scrollTop };

    // 减少动态效果：不播升起与让位，行为退化为瞬切
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

    // FLIP：删除的条目已经从 DOM 消失，邻居立即从旧视觉位置滑到新位置。
    items.forEach((item) => {
      const from = prev.offsets.get(item.id);
      const to = offsets.get(item.id);
      if (from === undefined || to === undefined) return;
      const delta = from - prev.scrollTop - (to - scrollTop);
      if (Math.abs(delta) < 0.5 || Math.abs(delta) > MAX_SHIFT) return;

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
