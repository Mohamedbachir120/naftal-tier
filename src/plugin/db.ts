// src/plugin/db.ts
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'; // ← new import

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // Use file: protocol – adjust path if needed (relative to cwd or absolute)
  // Common patterns: 'file:./prisma/dev.db' or 'file:./dev.db'
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';

  const adapter = new PrismaBetterSqlite3({
    url: dbUrl,
    // Optional: if you want faster but less strict mode (PRAGMA synchronous = OFF etc.)
    // options: { ... }
  });

  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    adapter,               // ← this is the required change
  });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
    // No explicit close needed for better-sqlite3 in most cases, but safe:
    // adapter.close?.(); // if the adapter exposes it
  });
};

export default fp(prismaPlugin, { name: 'prisma' });