import { Router } from 'express';
import db from '../db.js';
import { ApiError } from '../auth.js';
import { pluginSlugParamSchema, pluginCreateSchema, pluginUpdateSchema } from '../validation.js';

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
  const githubUrl = data.github_url ?? null;
  const enabled = data.enabled === true ? 1 : 0;
  if (enabled && (data.type ?? 'text-transform') === 'text-transform') {
    db.prepare("UPDATE plugins SET enabled = 0 WHERE type = 'text-transform'").run();
  }
  db.prepare(
    `INSERT INTO plugins (slug, name, author, version, description, github_url, code, type, regex, button_name, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       author = excluded.author,
       version = excluded.version,
       description = excluded.description,
       github_url = excluded.github_url,
       code = excluded.code,
       type = excluded.type,
       regex = excluded.regex,
       button_name = excluded.button_name,
       enabled = excluded.enabled`,
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
});

router.patch('/:id', (req, res) => {
  const { id } = pluginSlugParamSchema.parse(req.params);
  const data = pluginUpdateSchema.parse(req.body);
  const existing = getPluginOrThrow(id);
  const enabled = data.enabled === undefined ? (existing.enabled as number) : data.enabled ? 1 : 0;
  const type = data.type ?? (existing.type as string) ?? 'text-transform';
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
    data.regex === undefined ? (existing.regex as string | null) : (data.regex ?? null),
    data.button_name === undefined
      ? (existing.button_name as string | null)
      : (data.button_name ?? null),
    enabled,
    id,
  );
  const plugin = getPluginOrThrow(id);
  res.json({ plugin: serialize(plugin) });
});

router.delete('/:id', (req, res) => {
  const { id } = pluginSlugParamSchema.parse(req.params);
  getPluginOrThrow(id);
  db.prepare('DELETE FROM plugins WHERE slug = ?').run(id);
  res.status(204).send();
});

export default router;
