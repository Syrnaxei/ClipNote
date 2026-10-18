import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { config } from './config.js';

const wss = new WebSocketServer({ noServer: true });
const alive = new WeakSet<WebSocket>();

function extractKey(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.searchParams.get('key');
}

export function initWs(server: Server): void {
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    if (extractKey(req) !== config.apiKey) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.on('error', (err) => {
        console.error('ws client error:', (err as Error).message);
      });
      ws.on('pong', () => alive.add(ws));
      alive.add(ws);
      wss.emit('connection', ws, req);
    });
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, 30_000);
  wss.on('close', () => clearInterval(interval));
}

export function broadcast(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload });
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}
