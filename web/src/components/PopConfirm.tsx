import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motionDelay } from '../motion';
import './PopConfirm.css';

/** 与 --dur-exit 对齐的退场时长 */
const EXIT_MS = 180;

interface PopConfirmProps {
  title: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  children: ReactNode;
}

function PopConfirm({
  title,
  confirmText = '删除',
  cancelText = '取消',
  onConfirm,
  children,
}: PopConfirmProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRect = useRef<DOMRect | null>(null);
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const close = useCallback((after?: () => void) => {
    if (timerRef.current !== 0) return;
    setClosing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = 0;
      setOpen(false);
      setClosing(false);
      after?.();
    }, motionDelay(EXIT_MS));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !triggerRect.current || !popRef.current) return;
    const el = popRef.current;
    const rect = triggerRect.current;
    const { offsetHeight: h, offsetWidth: w } = el;
    let top = rect.top - h - 8;
    if (top < 8) top = rect.bottom + 8;
    let left = rect.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current !== 0) return;
    if (!open && triggerRef.current) {
      triggerRect.current = triggerRef.current.getBoundingClientRect();
    }
    setOpen((v) => !v);
  };

  return (
    <span className="popconfirm" ref={triggerRef}>
      <span className="popconfirm-trigger" onClick={toggle}>
        {children}
      </span>
      {open && (
        <div
          className={`popconfirm-popover ${closing ? 'is-closing' : ''}`}
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="popconfirm-title">{title}</div>
          <div className="popconfirm-actions">
            <button className="popconfirm-cancel" onClick={() => close()}>
              {cancelText}
            </button>
            <button
              className="popconfirm-confirm"
              onClick={() => close(onConfirm)}
            >
              {confirmText}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export default PopConfirm;
