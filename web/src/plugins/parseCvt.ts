export interface CvtMeta {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  github_url: string | null;
}

export interface CvtPlugin {
  meta: CvtMeta;
  code: string;
}

export class CvtParseError extends Error {}

// 兼容旧名称 ClipVault-Plugin 的元数据块
const META_BLOCK_RE = /\/\*\s*Clip(?:Note|Vault)-Plugin\s*([\s\S]*?)\*\//;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireString(
  value: unknown,
  field: string,
  min: number,
  max: number,
): string {
  if (typeof value !== 'string') {
    throw new CvtParseError(`元数据缺少字段: ${field}`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new CvtParseError(`元数据字段 ${field} 长度须在 ${min}-${max} 之间`);
  }
  return trimmed;
}

function parseGithubUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new CvtParseError('元数据字段 github_url 须为字符串');
  }
  const cleaned = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
  const m = /^github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)$/.exec(cleaned);
  if (!m) {
    throw new CvtParseError('github_url 须为 GitHub 用户主页链接（github.com/用户名）');
  }
  return `https://github.com/${m[1]}`;
}

export function parseCvt(source: string): CvtPlugin {
  const match = META_BLOCK_RE.exec(source);
  if (!match) {
    throw new CvtParseError('未找到插件元数据块(须为 /* ClipNote-Plugin { … } */，旧版 /* ClipVault-Plugin { … } */ 仍兼容)');
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    throw new CvtParseError('元数据块不是合法 JSON');
  }
  const id = requireString(raw.id, 'id', 3, 64);
  if (!SLUG_RE.test(id)) {
    throw new CvtParseError('id 须为小写字母、数字与短横线组成的 slug（如 my-upper-case）');
  }
  const meta: CvtMeta = {
    id,
    name: requireString(raw.name, 'name', 1, 100),
    author: requireString(raw.author, 'author', 1, 100),
    version: requireString(raw.version, 'version', 1, 20),
    description: requireString(raw.description, 'description', 1, 1000),
    github_url: parseGithubUrl(raw.github_url),
  };
  if (!VERSION_RE.test(meta.version)) {
    throw new CvtParseError('version 须为 x.y.z 格式');
  }
  const code = source.slice(match.index + match[0].length).trim();
  if (!code) {
    throw new CvtParseError('插件代码为空');
  }
  if (!/\bfunction\s+process\s*\(/.test(code)) {
    throw new CvtParseError('插件代码缺少 process(input) 函数');
  }
  return { meta, code };
}
