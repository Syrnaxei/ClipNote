import { z } from 'zod';

export const clipboardNameSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

export const clipboardUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    uuid: z.string().uuid().optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.uuid !== undefined || v.pinned !== undefined, {
    message: 'At least one of name, uuid, pinned is required',
  });

export const uuidParamSchema = z.object({
  uuid: z.string().uuid(),
});

export const DEVICE_TYPES = ['iPhone', 'iPad', 'Mac', 'PC', 'Web', 'Unknown'] as const;

export const itemContentSchema = z.object({
  content: z.string().min(1).max(1_048_576),
});

export const itemCreateSchema = z.object({
  clipboard_uuid: z.string().uuid(),
  content: z.string().min(1).max(1_048_576),
  device: z.string().trim().max(100).optional(),
  device_type: z.string().optional(),
});

export const itemUpdateSchema = z
  .object({
    content: z.string().min(1).max(1_048_576).optional(),
    original_content: z.string().max(1_048_576).nullable().optional(),
  })
  .refine((v) => v.content !== undefined || v.original_content !== undefined, {
    message: 'At least one of content, original_content is required',
  });

export const itemMoveSchema = z.object({
  clipboard_id: z.coerce.number().int().positive(),
});

export const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
export const PLUGIN_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const pluginSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(PLUGIN_SLUG_PATTERN, 'id must be lowercase letters, digits and dashes');

export function normalizeGithubUrl(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
  const m = /^github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)$/.exec(cleaned);
  return m ? `https://github.com/${m[1]}` : null;
}

export const pluginGithubUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .transform(normalizeGithubUrl)
  .refine((v): v is string => v !== null, {
    message: 'github_url must be a GitHub user profile URL (github.com/<user>)',
  });

export const pluginMetaSchema = z.object({
  id: pluginSlugSchema,
  name: z.string().trim().min(1).max(100),
  author: z.string().trim().min(1).max(100),
  version: z.string().trim().regex(PLUGIN_VERSION_PATTERN, 'version must be in x.y.z format'),
  description: z.string().trim().min(1).max(1000),
  github_url: pluginGithubUrlSchema.optional(),
});

export const pluginCreateSchema = pluginMetaSchema.extend({
  code: z.string().min(1).max(1_048_576),
  enabled: z.boolean().optional(),
});

export const pluginUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    author: z.string().trim().min(1).max(100).optional(),
    version: z.string().trim().regex(PLUGIN_VERSION_PATTERN).optional(),
    description: z.string().trim().min(1).max(1000).optional(),
    github_url: z.union([pluginGithubUrlSchema, z.null()]).optional(),
    code: z.string().min(1).max(1_048_576).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export function normalizeDevice(device?: string, deviceType?: string) {
  if (device === undefined && deviceType === undefined) {
    return { device: null, device_type: null };
  }
  const canonical = DEVICE_TYPES.find(
    (t) => t.toLowerCase() === (deviceType ?? '').toLowerCase(),
  );
  return {
    device: device || null,
    device_type: canonical ?? 'Unknown',
  };
}

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const pluginSlugParamSchema = z.object({
  id: pluginSlugSchema,
});
