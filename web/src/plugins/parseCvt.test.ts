import { describe, expect, it } from 'vitest';
import { CvtParseError, parseCvt } from './parseCvt';

function cvt(meta: Record<string, unknown>, code = 'function process(input) { return input; }') {
  return `/* ClipNote-Plugin ${JSON.stringify(meta)} */\n${code}`;
}

const baseMeta = {
  id: 'my-plugin',
  name: '我的插件',
  author: 'alice',
  version: '1.0.0',
  description: '测试插件',
};

describe('parseCvt 文本处理插件（存量兼容）', () => {
  it('无 type 字段默认为 text-transform', () => {
    const { meta, code } = parseCvt(cvt(baseMeta));
    expect(meta.type).toBe('text-transform');
    expect(code).toContain('process');
  });

  it('显式 type: text-transform 合法', () => {
    const { meta } = parseCvt(cvt({ ...baseMeta, type: 'text-transform' }));
    expect(meta.type).toBe('text-transform');
  });
});

describe('parseCvt type 字段校验', () => {
  it('未知 type 报错', () => {
    expect(() => parseCvt(cvt({ ...baseMeta, type: 'unknown-kind' }))).toThrow(CvtParseError);
  });

  it('type 非字符串报错', () => {
    expect(() => parseCvt(cvt({ ...baseMeta, type: 123 }))).toThrow(CvtParseError);
  });
});

describe('parseCvt 工具栏插件元数据', () => {
  const toolbarMeta = {
    ...baseMeta,
    type: 'selection-toolbar',
    regex: 'https?://\\S+',
    button_name: '打开链接',
  };

  it('合法工具栏插件解析出 type/regex/button_name', () => {
    const { meta, regex, buttonName } = parseCvt(cvt(toolbarMeta));
    expect(meta.type).toBe('selection-toolbar');
    expect(regex).toBe('https?://\\S+');
    expect(buttonName).toBe('打开链接');
  });

  it('缺少 regex 报错', () => {
    const { regex: _r, button_name: _b, ...rest } = toolbarMeta;
    expect(() => parseCvt(cvt(rest))).toThrow(/regex/);
  });

  it('非法正则报错', () => {
    expect(() =>
      parseCvt(cvt({ ...toolbarMeta, regex: '([unclosed' })),
    ).toThrow(CvtParseError);
  });

  it('缺少 button_name 报错', () => {
    const { button_name: _b, ...rest } = toolbarMeta;
    expect(() => parseCvt(cvt(rest))).toThrow(/button_name/);
  });

  it('button_name 超过 8 个字符报错', () => {
    expect(() =>
      parseCvt(cvt({ ...toolbarMeta, button_name: '一二三四五六七八九' })),
    ).toThrow(CvtParseError);
  });

  it('button_name 恰好 8 个字符合法', () => {
    const { buttonName } = parseCvt(
      cvt({ ...toolbarMeta, button_name: '一二三四五六七八' }),
    );
    expect(buttonName).toBe('一二三四五六七八');
  });

  it('text-transform 类型下多余的 regex/button_name 被忽略', () => {
    const { regex, buttonName } = parseCvt(
      cvt({ ...baseMeta, regex: 'abc', button_name: '名字' }),
    );
    expect(regex).toBeUndefined();
    expect(buttonName).toBeUndefined();
  });
});
