// src/modules/auth/auth.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { AuthService } from './auth.service.js';
import { registerSchema, loginSchema } from './auth.schema.js';
import multipart from '@fastify/multipart';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  const authService = new AuthService(fastify);

  // Register new user
  fastify.post('/register', async (request, reply) => {
    try {
      const parts = request.parts();
      const fields: Record<string, string> = {};
      const files: Record<string, { filename: string; stream: NodeJS.ReadableStream; mimetype: string }> = {};

      for await (const part of parts) {
        if (part.type === 'file') {
          files[part.fieldname] = {
            filename: part.filename,
            stream: part.file,
            mimetype: part.mimetype,
          };
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      // Validate input
      const validatedInput = registerSchema.parse(fields);

      const user = await authService.register(validatedInput, {
     
        carteGriseDoc: files.carteGriseDoc,
      });

      return reply.code(201).send({
        success: true,
        message: 'Registration successful. Please wait for admin approval.',
        data: user,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(400).send({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(401).send({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  });

  // Get registration status
  fastify.get(
    '/status',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const status = await authService.getRegistrationStatus(request.user.id);
        return reply.send({
          success: true,
          data: status,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Get profile
  fastify.get(
    '/profile',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const profile = await authService.getProfile(request.user.id);
        return reply.send({
          success: true,
          data: profile,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );
};

export default authRoutes;