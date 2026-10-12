import { useEffect, useRef, useState } from 'react';
import { copyText } from '../clipboard';
import { isMobileDevice } from '../mobileDetect';
import './SelectionToolbar.css';

const SHOW_DELAY_MS = 800;
const COPIED_FEEDBACK_MS = 1200;

interface ToolbarState {
  top: number;
  left: number;
  text: string;
}

function selectionInItemBody(sel: Selection): boolean {
  if (sel.isCollapsed || sel.rangeCount === 0) return false;
  const node = sel.anchorNode;
  return !!node && !!(node.parentElement?.closest('.content-text'));
}

function computePosition(sel: Selection): ToolbarState | null {
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const text = sel.toString();
  if (!text.trim()) return null;

  const toolbarWidth = 110;
  const toolbarHeight = 36;
  const gap = 8;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - toolbarWidth / 2, 8),
    window.innerWidth - toolbarWidth - 8,
  );
  const below = rect.bottom + gap;
  const above = rect.top - gap - toolbarHeight;
  const top = above >= 0 ? above : below;
  return { top, left, text };
}

function SelectionToolbar() {
  const [state, setState] = useState<ToolbarState | null>(null);
  const [copied, setCopied] = useState(false);
  const showTimerRef = useRef<number | undefined>(undefined);
  const hideTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (isMobileDevice()) return;

    const clearShowTimer = () => window.clearTimeout(showTimerRef.current);

    const scheduleShow = () => {
      clearShowTimer();
      window.clearTimeout(hideTimerRef.current);
      setCopied(false);
      setState(null);
      showTimerRef.current = window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || !selectionInItemBody(sel)) return;
        const pos = computePosition(sel);
        if (pos) setState(pos);
      }, SHOW_DELAY_MS);
    };

    const hide = () => {
      clearShowTimer();
      setState(null);
    };

    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && selectionInItemBody(sel)) scheduleShow();
      else hide();
    };
    const onScroll = () => hide();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearShowTimer();
      window.clearTimeout(hideTimerRef.current);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (isMobileDevice() || !state) return null;

  const handleCopy = async () => {
    if (await copyText(state.text)) {
      setCopied(true);
      hideTimerRef.current = window.setTimeout(() => {
        setState(null);
        setCopied(false);
      }, COPIED_FEEDBACK_MS);
    }
  };

  return (
    <div
      className="selection-toolbar"
      style={{ top: state.top, left: state.left }}
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
    >
      <button className="selection-toolbar-button" onClick={handleCopy}>
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        )}
        <span>{copied ? '已复制' : '复制文本'}</span>
      </button>
    </div>
  );
}

export default SelectionToolbar;
