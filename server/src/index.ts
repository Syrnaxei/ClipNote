import http from 'node:http';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import { config } from './config.js';
import { auth } from './auth.js';
import { errorHandler } from './errors.js';
import clipboardsRouter from './routes/clipboards.js';
import itemsRouter from './routes/items.js';
import pluginsRouter from './routes/plugins.js';
import { initWs } from './ws.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());

// 静态托管与 SPA fallback 必须置于鉴权之前:静态文件匿名可达,鉴权仅覆盖 /api 与 /ws
const publicDir = config.publicDir;
app.use(express.static(publicDir, { index: 'index.html', dotfiles: 'ignore' }));
app.get(/^\/(?!api(?:\/|$)|ws$).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(express.json({ limit: '2mb' }));
app.use(auth);

app.use('/api/clipboards', clipboardsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/plugins', pluginsRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route: ${_req.method} ${_req.originalUrl}` } });
});

app.use(errorHandler);

const server = http.createServer(app);
initWs(server);

server.listen(config.port, () => {
  console.log(`ClipNote server listening on port ${config.port}`);
});
