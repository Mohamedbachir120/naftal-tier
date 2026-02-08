// src/modules/auth/auth.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AuthService } from './auth.service.js';
import {
  registerBodySchema,
  registerMultipartSchema,
  registerResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  statusResponseSchema,
  profileResponseSchema,
  errorResponseSchema,
} from './auth.schema.js';
import multipart from '@fastify/multipart';
import { Readable } from 'stream';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Scope the type provider so every route in this plugin gets Zod types
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });

  const authService = new AuthService(fastify);

  // ─── Register (multipart/form-data) ────────────────────────────
  app.route({
    method: 'POST',
    url: '/register',
    schema: {
      description: 'Register a new user. Accepts multipart/form-data with an optional Carte Grise document.',
      tags: ['Auth'],
      consumes: ['multipart/form-data'],  // Tells @fastify/swagger the content type
      body: registerMultipartSchema,       // For OpenAPI docs (includes file field)
      response: {
        201: registerResponseSchema,
        400: errorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      // Manual multipart parsing — Fastify's validator is bypassed for
      // the body because @fastify/multipart consumes the stream first.
      const parts = request.parts();
      const fields: Record<string, string> = {};
      const files: Record<
        string,
        { filename: string; stream: Readable; mimetype: string }
      > = {};

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

      // Runtime validation of the text fields
      const validatedInput = registerBodySchema.parse(fields);

      const user = await authService.register(validatedInput, {
        carteGriseDoc: files.carteGriseDoc,
      });

      return reply.code(201).send({
        success: true as const,
        message: 'Registration successful. Please wait for admin approval.',
        data: user,
      });
    },
  });

  // ─── Login ─────────────────────────────────────────────────────
  app.route({
    method: 'POST',
    url: '/login',
    schema: {
      description: 'Authenticate with phone number and password. Returns a JWT token.',
      tags: ['Auth'],
      body: loginBodySchema,
      response: {
        200: loginResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      // request.body is fully typed as { phone: string; password: string }
      try {
        const result = await authService.login(request.body);

        return reply.send({
          success: true as const,
          data: result,
        });
      } catch (error: any) {
        return reply.code(401).send({
          success: false as const,
          error: error.message || 'Login failed',
        });
      }
    },
  });

  // ─── Registration Status ──────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/status',
    schema: {
      description: 'Check the verification status of the authenticated user.',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: statusResponseSchema,
        400: errorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const status = await authService.getRegistrationStatus(
          request.user.id
        );
        return reply.send({
          success: true as const,
          data: status,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false as const,
          error: error.message,
        });
      }
    },
  });

  // ─── Profile ───────────────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/profile',
    schema: {
      description: 'Retrieve the full profile of the authenticated user.',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: profileResponseSchema,
        400: errorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const profile = await authService.getProfile(request.user.id);
        return reply.send({
          success: true as const,
          data: profile,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false as const,
          error: error.message,
        });
      }
    },
  });
};

export default authRoutes;