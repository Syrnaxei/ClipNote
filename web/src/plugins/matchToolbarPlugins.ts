import type { Plugin } from '../types';

export interface ToolbarPlugin {
  id: string;
  name: string;
  buttonName: string;
  pattern: RegExp | null;
}

export function toToolbarPlugins(plugins: Plugin[]): ToolbarPlugin[] {
  return plugins.map((p) => {
    let pattern: RegExp | null = null;
    if (p.regex) {
      try {
        pattern = new RegExp(p.regex);
      } catch {
        pattern = null;
      }
    }
    return { id: p.id, name: p.name, buttonName: p.button_name || p.name, pattern };
  });
}

export function matchToolbarPlugins(
  text: string,
  plugins: ToolbarPlugin[],
): ToolbarPlugin[] {
  if (!text) return [];
  return plugins.filter((p) => {
    try {
      return p.pattern !== null && p.pattern.test(text);
    } catch {
      return false;
    }
  });
}
