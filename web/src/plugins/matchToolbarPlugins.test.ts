import { describe, expect, it } from 'vitest';
import { matchToolbarPlugins, type ToolbarPlugin } from './matchToolbarPlugins';
function plugin(id: string, regex: string): ToolbarPlugin {
  return { id, name: `插件-${id}`, buttonName: '按钮', pattern: new RegExp(regex) };
}

describe('matchToolbarPlugins', () => {
  it('无命中返回空数组', () => {
    expect(matchToolbarPlugins('hello world', [plugin('a', 'ISBN')])).toEqual([]);
  });

  it('单个命中返回该插件', () => {
    const result = matchToolbarPlugins('读取 ISBN 9787020002207', [plugin('a', 'ISBN')]);
    expect(result.map((p) => p.id)).toEqual(['a']);
  });

  it('多个命中全部返回', () => {
    const result = matchToolbarPlugins('https://example.com ISBN', [
      plugin('url', 'https?://'),
      plugin('isbn', 'ISBN'),
    ]);
    expect(result.map((p) => p.id)).toEqual(['url', 'isbn']);
  });

  it('RegExp.test 语义（子串匹配）', () => {
    const result = matchToolbarPlugins('前缀 12345 后缀', [plugin('num', '\\d{5}')]);
    expect(result).toHaveLength(1);
  });

  it('匹配顺序与插件列表顺序一致', () => {
    const result = matchToolbarPlugins('abc', [plugin('x', 'a'), plugin('y', 'b')]);
    expect(result.map((p) => p.id)).toEqual(['x', 'y']);
  });

  it('非法正则的插件被跳过且不影响其余', () => {
    const broken: ToolbarPlugin = { id: 'bad', name: '坏插件', buttonName: '按钮', pattern: null };
    const result = matchToolbarPlugins('abc', [broken, plugin('good', 'a')]);
    expect(result.map((p) => p.id)).toEqual(['good']);
  });

  it('空选区文本返回空数组', () => {
    expect(matchToolbarPlugins('', [plugin('a', '.+')])).toEqual([]);
  });
});
