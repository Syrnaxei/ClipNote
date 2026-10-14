import { describe, expect, it } from 'vitest';
import { runToolbarPlugin, ToolbarPluginRunError } from './runToolbarPlugin';

describe('runToolbarPlugin', () => {
  it('返回字符串时原样返回', async () => {
    await expect(
      runToolbarPlugin('function process(input) { return input + "!"; }', 'hi'),
    ).resolves.toBe('hi!');
  });

  it('返回非字符串时结果为 undefined', async () => {
    await expect(
      runToolbarPlugin('async function process(input) { await null; }', 'hi'),
    ).resolves.toBeUndefined();
  });

  it('同步抛出异常时报错', async () => {
    await expect(
      runToolbarPlugin('function process() { throw new Error("boom"); }', ''),
    ).rejects.toThrow('boom');
  });

  it('async reject 时报错', async () => {
    await expect(
      runToolbarPlugin(
        'async function process() { throw new Error("async boom"); }',
        '',
      ),
    ).rejects.toThrow('async boom');
  });

  it('缺少 process 函数时报错', async () => {
    await expect(runToolbarPlugin('const x = 1;', '')).rejects.toThrow(
      '插件代码缺少 process(input) 函数',
    );
  });

  it('编译期语法错误报错', async () => {
    await expect(runToolbarPlugin('function process( {', '')).rejects.toBeInstanceOf(
      ToolbarPluginRunError,
    );
  });

  it('永不 settle 的 Promise 会被超时打断', async () => {
    await expect(
      runToolbarPlugin('async function process() { await new Promise(() => {}); }', '', 20),
    ).rejects.toThrow('插件执行超时');
  });
});
