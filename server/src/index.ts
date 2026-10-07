import http from 'node:http';
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
app.use(express.json({ limit: '2mb' }));
app.use(auth);

app.use('/api/clipboards', clipboardsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/plugins', pluginsRouter);

app.use(errorHandler);

const server = http.createServer(app);
initWs(server);

server.listen(config.port, () => {
  console.log(`ClipNote server listening on port ${config.port}`);
});
