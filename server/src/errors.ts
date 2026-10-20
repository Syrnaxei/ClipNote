import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from './auth.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // body-parser 等中间件会把客户端错误标在 err.status（400/413），不能落进 500 兜底。
  const status = (err as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const type = (err as { type?: string }).type;
    res.status(status).json({
      error: {
        code: type ? type.toUpperCase().replace(/\./g, '_') : 'BAD_REQUEST',
        message: 'Invalid request body',
      },
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};
