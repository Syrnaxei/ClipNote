import { migrateStorageKey } from './storage';

export type PinStyle = 'bar' | 'corner' | 'stripes' | 'notch';

export const PIN_STYLES: { value: PinStyle; label: string }[] = [
  { value: 'bar', label: '左竖条' },
  { value: 'corner', label: '右上三角' },
  { value: 'stripes', label: '斜纹条' },
  { value: 'notch', label: '切角' },
];

const STORAGE_KEY = 'clipnote_pin_style';
migrateStorageKey('clipvault_pin_style', STORAGE_KEY);

export function loadPinStyle(): PinStyle {
  const saved = localStorage.getItem(STORAGE_KEY);
  return PIN_STYLES.some((s) => s.value === saved) ? (saved as PinStyle) : 'bar';
}

export function savePinStyle(style: PinStyle): void {
  localStorage.setItem(STORAGE_KEY, style);
}
