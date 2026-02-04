 

// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import prismaPlugin from './plugin/db.js';
import authPlugin from './plugin/auth.js';
import storagePlugin from './plugin/storage.js';
import authRoutes from './modules/auth/auth.routes.js';
import requestsRoutes from './modules/requests/requests.routes.js';
import tiersRoutes from './modules/tiers/tiers.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register plugins
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(storagePlugin, {
    useMinIO: false, // Set to true for MinIO
    localPath: './src/storage/documents',
    bucketName: 'naftal-documents',
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(requestsRoutes, { prefix: '/api/requests' });
  await app.register(tiersRoutes, { prefix: '/api/tires' });

  return app;
}