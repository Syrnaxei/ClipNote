export interface LongPressOptions {
  onLongPress: () => void;
  delay?: number;
  moveThreshold?: number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancelScheduled?: (id: unknown) => void;
}

export interface LongPressController {
  down(x: number, y: number, pointerType: string): void;
  move(x: number, y: number): void;
  up(): void;
  cancel(): void;
}

export function createLongPressController({
  onLongPress,
  delay = 500,
  moveThreshold = 10,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelScheduled = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}: LongPressOptions): LongPressController {
  let timer: unknown;
  let startX = 0;
  let startY = 0;

  const clear = () => {
    if (timer !== undefined) {
      cancelScheduled(timer);
      timer = undefined;
    }
  };

  return {
    down(x, y, pointerType) {
      if (pointerType === 'mouse') return;
      clear();
      startX = x;
      startY = y;
      timer = schedule(() => {
        timer = undefined;
        onLongPress();
      }, delay);
    },
    move(x, y) {
      if (timer === undefined) return;
      const dx = x - startX;
      const dy = y - startY;
      if (dx * dx + dy * dy > moveThreshold * moveThreshold) clear();
    },
    up: clear,
    cancel: clear,
  };
}
