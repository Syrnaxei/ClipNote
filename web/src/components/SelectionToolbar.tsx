import { useEffect, useRef, useState } from 'react';
import { copyText } from '../clipboard';
import { isMobileDevice } from '../mobileDetect';
import {
  matchToolbarPluginsAsync,
  toToolbarPlugins,
  type ToolbarPlugin,
} from '../plugins/matchToolbarPlugins';
import { runToolbarPlugin } from '../plugins/runToolbarPlugin';
import type { Plugin } from '../types';
import './SelectionToolbar.css';

const SHOW_DELAY_MS = 800;
const COPIED_FEEDBACK_MS = 1200;
const BUTTON_BASE_WIDTH = 40;
const BUTTON_CHAR_WIDTH = 13;

function estimateButtonWidth(label: string): number {
  return BUTTON_BASE_WIDTH + label.length * BUTTON_CHAR_WIDTH;
}

interface SelectionToolbarProps {
  plugins: Plugin[];
  onNotice: (n: { text: string }) => void;
}

interface ToolbarState {
  top: number;
  left: number;
  text: string;
  url: string | null;
  matched: ToolbarPlugin[];
}

function extractUrl(text: string): string | null {
  const first = text.trim().split(/\s+/)[0] ?? '';
  if (!/^https?:\/\//i.test(first)) return null;
  try {
    const url = new URL(first);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    // 非法 URL 则不提供跳转
  }
  return null;
}

function selectionInItemBody(sel: Selection): boolean {
  if (sel.isCollapsed || sel.rangeCount === 0) return false;
  const node = sel.anchorNode;
  return !!node && !!(node.parentElement?.closest('.content-text'));
}

function computePosition(
  sel: Selection,
  toolbarWidth: number,
): Pick<ToolbarState, 'top' | 'left' | 'text' | 'url'> | null {
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const text = sel.toString();
  if (!text.trim()) return null;

  const url = extractUrl(text);
  const toolbarHeight = 36;
  const gap = 8;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - toolbarWidth / 2, 8),
    window.innerWidth - toolbarWidth - 8,
  );
  const below = rect.bottom + gap;
  const above = rect.top - gap - toolbarHeight;
  const top = above >= 0 ? above : below;
  return { top, left, text, url };
}

function SelectionToolbar({ plugins, onNotice }: SelectionToolbarProps) {
  const [state, setState] = useState<ToolbarState | null>(null);
  const [copied, setCopied] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const showTimerRef = useRef<number | undefined>(undefined);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const matchSeqRef = useRef(0);
  const pluginsRef = useRef<Plugin[]>(plugins);
  pluginsRef.current = plugins;

  useEffect(() => {
    if (isMobileDevice()) return;

    const clearShowTimer = () => window.clearTimeout(showTimerRef.current);

    const scheduleShow = () => {
      clearShowTimer();
      window.clearTimeout(hideTimerRef.current);
      setCopied(false);
      setState(null);
      showTimerRef.current = window.setTimeout(async () => {
        const sel = window.getSelection();
        if (!sel || !selectionInItemBody(sel)) return;
        const selText = sel.toString();
        const seq = ++matchSeqRef.current;
        let matched: ToolbarPlugin[] = [];
        try {
          matched = await matchToolbarPluginsAsync(
            selText,
            toToolbarPlugins(pluginsRef.current),
          );
        } catch {
          matched = [];
        }
        if (seq !== matchSeqRef.current) return;
        const cur = window.getSelection();
        if (!cur || !selectionInItemBody(cur) || cur.toString() !== selText) return;
        const labels = ['复制文本', ...(extractUrl(selText) ? ['跳转到网页'] : []), ...matched.map((p) => p.buttonName)];
        const width = labels.reduce((sum, label) => sum + estimateButtonWidth(label), 0);
        const pos = computePosition(cur, width);
        if (pos) setState({ ...pos, matched });
      }, SHOW_DELAY_MS);
    };

    const hide = () => {
      clearShowTimer();
      matchSeqRef.current += 1;
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

  const handleOpen = () => {
    if (!state.url) return;
    window.open(state.url, '_blank', 'noopener,noreferrer');
    setState(null);
  };

  const handleRunPlugin = async (plugin: ToolbarPlugin) => {
    if (!state || runningId) return;
    setRunningId(plugin.id);
    setState(null);
    const input = state.text;
    try {
      const message = await runToolbarPlugin(
        plugins.find((p) => p.id === plugin.id)?.code ?? '',
        input,
      );
      onNotice({ text: message ?? `已执行「${plugin.buttonName}」` });
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : '';
      onNotice({
        text: detail ? `「${plugin.buttonName}」执行失败：${detail}` : `「${plugin.buttonName}」执行失败`,
      });
    } finally {
      setRunningId(null);
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
      {state.url && (
        <button className="selection-toolbar-button" onClick={handleOpen}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span>跳转到网页</span>
        </button>
      )}
      {state.matched.map((plugin) => (
        <button
          key={plugin.id}
          className="selection-toolbar-button"
          onClick={() => handleRunPlugin(plugin)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span>{plugin.buttonName}</span>
        </button>
      ))}
    </div>
  );
}

export default SelectionToolbar;
