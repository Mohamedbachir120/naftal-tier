// src/plugin/auth.ts
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateSeller: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      phone: string;
      role: 'USER' | 'SELLER' | 'ADMIN';
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
    };
    user: {
      id: string;
      phone: string;
      role: 'USER' | 'SELLER' | 'ADMIN';
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    sign: {
      expiresIn: '7d',
    },
  });

  // Basic authentication - just verify token
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  });

  // Seller authentication - verify token and check seller role
  fastify.decorate('authenticateSeller', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (request.user.role !== 'SELLER' && request.user.role !== 'ADMIN') {
        reply.code(403).send({ error: 'Forbidden', message: 'Seller access required' });
      }
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  });

  // Admin authentication
  fastify.decorate('authenticateAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (request.user.role !== 'ADMIN') {
        reply.code(403).send({ error: 'Forbidden', message: 'Admin access required' });
      }
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  });
};

export default fp(authPlugin, { name: 'auth' });