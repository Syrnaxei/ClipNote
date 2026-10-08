import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLongPressController } from './longPress';

describe('createLongPressController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('触摸按下 delay 后触发 onLongPress', () => {
    const onLongPress = vi.fn();
    const c = createLongPressController({ onLongPress, delay: 500 });
    c.down(10, 10, 'touch');
    vi.advanceTimersByTime(499);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('鼠标按下不触发', () => {
    const onLongPress = vi.fn();
    const c = createLongPressController({ onLongPress, delay: 500 });
    c.down(10, 10, 'mouse');
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('轻微抖动（阈值内）不取消', () => {
    const onLongPress = vi.fn();
    const c = createLongPressController({ onLongPress, delay: 500, moveThreshold: 10 });
    c.down(100, 100, 'touch');
    c.move(106, 104);
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('位移超阈值取消', () => {
    const onLongPress = vi.fn();
    const c = createLongPressController({ onLongPress, delay: 500, moveThreshold: 10 });
    c.down(100, 100, 'touch');
    c.move(120, 100);
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('抬起取消', () => {
    const onLongPress = vi.fn();
    const c = createLongPressController({ onLongPress, delay: 500 });
    c.down(0, 0, 'touch');
    c.up();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('pointercancel 取消', () => {
    const onLongPress = vi.fn();
    const c = createLongPressController({ onLongPress, delay: 500 });
    c.down(0, 0, 'touch');
    c.cancel();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('取消后再次按下可重新计时', () => {
    const onLongPress = vi.fn();
    const c = createLongPressController({ onLongPress, delay: 500 });
    c.down(0, 0, 'touch');
    c.up();
    c.down(5, 5, 'touch');
    vi.advanceTimersByTime(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
