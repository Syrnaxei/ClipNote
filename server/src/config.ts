import path from 'node:path';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  apiKey: requiredEnv('API_KEY'),
  port: Number(process.env.PORT ?? 3000),
  dataDir: process.env.DATA_DIR ?? path.resolve('data'),
  publicDir: process.env.PUBLIC_DIR ?? path.resolve('public'),
};
