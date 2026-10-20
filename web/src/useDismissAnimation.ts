import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION, motionDelay } from './motion';

/**
 * 统一的浮层退场：先标记 `closing` 让 CSS 播完退场动画，
 * 到点后再执行回调（真正关闭 / 卸载）并恢复状态。
 *
 * 回调可以带一个 `after`：用于「确认」这类既要关闭、又要提交修改的场景，
 * 保证视觉上先收起、再落数据。
 */
export function useDismissAnimation(duration: number = MOTION.overlayOut) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const dismiss = useCallback(
    (after?: () => void) => {
      if (timerRef.current !== 0) return;
      setClosing(true);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = 0;
        setClosing(false);
        after?.();
      }, motionDelay(duration));
    },
    [duration],
  );

  return { closing, dismiss };
}
