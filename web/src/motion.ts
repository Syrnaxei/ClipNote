/**
 * 动效语言「纸张余韵」的运行时部分。
 *
 * 时长与 CSS 里的 `--dur-*` 变量保持一致；JS 只在需要等待动画结束再改状态时
 * 使用它们（退场、列表进出、视图切换）。系统开启「减少动态效果」时统一返回 0，
 * 让时序退化为瞬切，行为与视觉都不依赖动画完成。
 */
export const MOTION = {
  /** 视图切换：旧视图退场 */
  viewOut: 90,
  /** 视图切换：新视图浮入 */
  viewIn: 180,
  /** 浮层进场 */
  overlayIn: 200,
  /** 浮层退场（统一轻柔型） */
  overlayOut: 180,
  /** 列表项落下 */
  listIn: 300,
  /** 列表让位（与设置拖拽同一时长 / 曲线） */
  listShift: 250,
  /** 设置导航指示滑动 */
  navIndicator: 220,
  /** 侧栏折叠 */
  sidebar: 200,
  /** 剪切板切换：旧内容淡出 + 新内容淡入 */
  switchOut: 90,
  switchIn: 130,
} as const;

/** 列表让位与设置拖拽共用的缓动，与 CSS `--ease-shift` 保持一致。 */
export const SHIFT_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

/** 滚到最新一条的距离 → 时长：近处快、远处慢，但不超过 420ms。 */
export function scrollToLatestDuration(distance: number): number {
  return Math.min(420, 200 + Math.abs(distance) * 0.2);
}

/**
 * 「纸张余韵」主缓动 `cubic-bezier(0.22, 0.68, 0.32, 1)` 的 JS 版本。
 *
 * 给 rAF 补间的滚动用（`scrollTo({ behavior: 'smooth' })` 用的是浏览器的曲线，
 * 和这套动态语言对不上）。先用二分由 x 反解曲线参数 t，再求 y。
 */
export function easePaper(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const curve = (t: number, p1: number, p2: number) => {
    const u = 1 - t;
    return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    if (curve(mid, 0.22, 0.32) < x) lo = mid;
    else hi = mid;
  }
  return curve((lo + hi) / 2, 0.68, 1);
}

/** 系统是否要求减少动态效果。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 动画时长（毫秒）。减少动态效果下返回 0，
 * 于是 `setTimeout(fn, motionDelay(ms))` 会立刻执行。
 */
export function motionDelay(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}
