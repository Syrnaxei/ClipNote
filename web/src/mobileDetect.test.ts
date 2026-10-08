import { describe, expect, it } from 'vitest';
import { detectMobile } from './mobileDetect';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

describe('detectMobile', () => {
  it('iPhone：coarse + 触摸 → 移动端', () => {
    expect(
      detectMobile({ coarsePointer: true, maxTouchPoints: 5, userAgent: IPHONE_UA }),
    ).toBe(true);
  });

  it('iPad Safari（桌面 UA）：coarse + 触摸 → 移动端', () => {
    expect(
      detectMobile({ coarsePointer: true, maxTouchPoints: 5, userAgent: IPAD_DESKTOP_UA }),
    ).toBe(true);
  });

  it('Android：coarse + 触摸 → 移动端', () => {
    expect(
      detectMobile({ coarsePointer: true, maxTouchPoints: 5, userAgent: ANDROID_UA }),
    ).toBe(true);
  });

  it('桌面 Chrome：fine + 无触摸 → 桌面', () => {
    expect(
      detectMobile({ coarsePointer: false, maxTouchPoints: 0, userAgent: DESKTOP_UA }),
    ).toBe(false);
  });

  it('桌面缩窄窗口：判定与视口宽度无关，仍为桌面', () => {
    expect(
      detectMobile({ coarsePointer: false, maxTouchPoints: 0, userAgent: DESKTOP_UA }),
    ).toBe(false);
  });

  it('触摸屏笔记本（主输入鼠标）：不判定为移动端', () => {
    expect(
      detectMobile({ coarsePointer: false, maxTouchPoints: 10, userAgent: DESKTOP_UA }),
    ).toBe(false);
  });

  it('主输入为触摸的触屏设备 → 移动端（ADR-0001 接受的代价）', () => {
    expect(
      detectMobile({ coarsePointer: true, maxTouchPoints: 10, userAgent: DESKTOP_UA }),
    ).toBe(true);
  });

  it('UA 兜底：主输入信号缺失但 UA 为移动端 → 移动端', () => {
    expect(
      detectMobile({ coarsePointer: false, maxTouchPoints: 0, userAgent: IPHONE_UA }),
    ).toBe(true);
  });
});
