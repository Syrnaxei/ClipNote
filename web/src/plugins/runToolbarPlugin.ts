export class ToolbarPluginRunError extends Error {}

const RUN_TIMEOUT_MS = 3000;

export async function runToolbarPlugin(
  code: string,
  input: string,
  timeoutMs: number = RUN_TIMEOUT_MS,
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      fn(input),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ToolbarPluginRunError(`插件执行超时(${timeoutMs / 1000}秒)`)),
          timeoutMs,
        );
      }),
    ]);
    return typeof result === 'string' ? result : undefined;
  } catch (err) {
    throw err instanceof Error ? err : new ToolbarPluginRunError(String(err));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
