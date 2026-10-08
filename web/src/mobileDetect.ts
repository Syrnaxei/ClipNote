export interface DeviceSignals {
  coarsePointer: boolean;
  maxTouchPoints: number;
  userAgent: string;
}

const MOBILE_UA_PATTERN = /iPhone|iPad|iPod|Android|Mobile|Silk/i;

export function detectMobile(signals: DeviceSignals): boolean {
  if (signals.coarsePointer && signals.maxTouchPoints > 0) return true;
  return MOBILE_UA_PATTERN.test(signals.userAgent);
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return detectMobile({
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    userAgent: navigator.userAgent,
  });
}
