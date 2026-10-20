import { flushSync } from 'react-dom';

type ViewTransitionLike = { ready: Promise<void> };

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransitionLike;
};

type RevealOptions = KeyframeAnimationOptions & { pseudoElement?: string };

/** 主题圆形扩散的时长，与预览页「480ms」一致 */
export const THEME_REVEAL_MS = 480;

/**
 * 从点击位置圆形扩散到新主题。
 *
 * 用 View Transitions 先给旧界面拍快照，再把新主题的快照按圆形裁切展开；
 * 浏览器不支持时回退为瞬切。`origin` 为空表示调用方不希望做扩散。
 */
export function revealTheme(
  apply: () => void,
  origin: { x: number; y: number } | null,
  duration: number = THEME_REVEAL_MS,
): void {
  const doc = document as DocumentWithViewTransition;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!doc.startViewTransition || !origin || reduced) {
    apply();
    return;
  }

  let transition: ViewTransitionLike;
  try {
    // flushSync 让 React 在快照前把 data-theme 落进 DOM
    transition = doc.startViewTransition(() => {
      flushSync(apply);
    });
  } catch {
    apply();
    return;
  }

  transition.ready
    .then(() => {
      const radius = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y),
      );
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        } as RevealOptions,
      );
    })
    .catch(() => {
      /* 过渡被跳过时保持最终状态即可 */
    });
}
