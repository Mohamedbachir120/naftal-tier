

// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import prismaPlugin from './plugin/db.js';
import authPlugin from './plugin/auth.js';
import storagePlugin from './plugin/storage.js';
import authRoutes from './modules/auth/auth.routes.js';
import requestsRoutes from './modules/requests/requests.routes.js';
import tiersRoutes from './modules/tiers/tiers.routes.js';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { ZodType } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod';

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
  }).withTypeProvider<ZodTypeProvider>();

  // Register CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Naftal API',
        description: 'API documentation for Naftal backend',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],

    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
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