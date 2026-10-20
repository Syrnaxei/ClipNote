import { Router } from 'express';
import db from '../db.js';
import { ApiError } from '../auth.js';
import { pluginSlugParamSchema, pluginCreateSchema, pluginUpdateSchema, pluginStateError } from '../validation.js';
import { broadcast } from '../ws.js';

const router = Router();

const PLUGIN_FIELDS =
  'slug AS id, name, author, version, description, github_url, code, type, regex, button_name, enabled, created_at';

interface PluginRow {
  enabled: number;
  github_url: string | null;
  [key: string]: unknown;
}

function serialize(plugin: PluginRow) {
  return { ...plugin, enabled: !!plugin.enabled };
}

function getPluginOrThrow(id: string) {
  const plugin = db
    .prepare(`SELECT ${PLUGIN_FIELDS} FROM plugins WHERE slug = ?`)
    .get(id) as PluginRow | undefined;
  if (!plugin) {
    throw new ApiError(404, 'NOT_FOUND', 'Plugin not found');
  }
  return plugin;
}

router.get('/', (req, res) => {
  const plugins = db
    .prepare(`SELECT ${PLUGIN_FIELDS} FROM plugins ORDER BY created_at DESC, slug DESC`)
    .all() as PluginRow[];
  res.json({ plugins: plugins.map(serialize) });
});

router.post('/', (req, res) => {
  const data = pluginCreateSchema.parse(req.body);
  // 静默 upsert 会在同 id 同版本下换掉代码而不触发重新信任，重复导入必须显式确认。
  const exists = db.prepare('SELECT 1 FROM plugins WHERE slug = ?').get(data.id);
  if (exists) {
    throw new ApiError(409, 'PLUGIN_EXISTS', `Plugin "${data.id}" already exists, delete it or use PATCH to overwrite`);
  }
  const githubUrl = data.github_url ?? null;
  const enabled = data.enabled === true ? 1 : 0;
  if (enabled && (data.type ?? 'text-transform') === 'text-transform') {
    db.prepare("UPDATE plugins SET enabled = 0 WHERE type = 'text-transform'").run();
  }
  db.prepare(
    `INSERT INTO plugins (slug, name, author, version, description, github_url, code, type, regex, button_name, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    data.id,
    data.name,
    data.author,
    data.version,
    data.description,
    githubUrl,
    data.code,
    data.type ?? 'text-transform',
    data.regex ?? null,
    data.button_name ?? null,
    enabled,
  );
  const plugin = db
    .prepare(`SELECT ${PLUGIN_FIELDS} FROM plugins WHERE slug = ?`)
    .get(data.id) as PluginRow;
  res.status(201).json({ plugin: serialize(plugin) });
  broadcast('plugin.created', serialize(plugin));
});

router.patch('/:id', (req, res) => {
  const { id } = pluginSlugParamSchema.parse(req.params);
  const data = pluginUpdateSchema.parse(req.body);
  const existing = getPluginOrThrow(id);
  const enabled = data.enabled === undefined ? (existing.enabled as number) : data.enabled ? 1 : 0;
  const type = data.type ?? (existing.type as string) ?? 'text-transform';
  const regex = data.regex === undefined ? (existing.regex as string | null) : (data.regex ?? null);
  const buttonName =
    data.button_name === undefined ? (existing.button_name as string | null) : (data.button_name ?? null);
  const stateError = pluginStateError(type, regex, buttonName);
  if (stateError) {
    throw new ApiError(400, 'VALIDATION_ERROR', stateError);
  }
  if (data.enabled === true && type === 'text-transform') {
    db.prepare("UPDATE plugins SET enabled = 0 WHERE type = 'text-transform'").run();
  }
  db.prepare(
    `UPDATE plugins SET name = ?, author = ?, version = ?, description = ?, github_url = ?, code = ?, type = ?, regex = ?, button_name = ?, enabled = ? WHERE slug = ?`,
  ).run(
    data.name ?? (existing.name as string),
    data.author ?? (existing.author as string),
    data.version ?? (existing.version as string),
    data.description ?? (existing.description as string),
    data.github_url === undefined
      ? existing.github_url
      : data.github_url === null
        ? null
        : data.github_url,
    data.code ?? (existing.code as string),
    type,
    regex,
    buttonName,
    enabled,
    id,
  );
  const plugin = getPluginOrThrow(id);
  res.json({ plugin: serialize(plugin) });
  broadcast('plugin.updated', serialize(plugin));
});

router.delete('/:id', (req, res) => {
  const { id } = pluginSlugParamSchema.parse(req.params);
  getPluginOrThrow(id);
  db.prepare('DELETE FROM plugins WHERE slug = ?').run(id);
  res.status(204).send();
  broadcast('plugin.deleted', { id });
});

export default router;
