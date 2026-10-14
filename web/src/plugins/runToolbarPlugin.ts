export class ToolbarPluginRunError extends Error {}

export async function runToolbarPlugin(
  code: string,
  input: string,
): Promise<string | undefined> {
  let fn: ((input: string) => unknown) | null;
  try {
    fn = new Function(
      'input',
      `"use strict";\n${code}\n;return typeof process === "function" ? process : null;`,
    )(input) as ((input: string) => unknown) | null;
  } catch (err) {
    throw new ToolbarPluginRunError(
      String((err instanceof Error && err.message) || err),
    );
  }
  if (!fn) {
    throw new ToolbarPluginRunError('插件代码缺少 process(input) 函数');
  }
  try {
    const result = await fn(input);
    return typeof result === 'string' ? result : undefined;
  } catch (err) {
    throw err instanceof Error ? err : new ToolbarPluginRunError(String(err));
  }
}
