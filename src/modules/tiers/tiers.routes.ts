// src/modules/tiers/tiers.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { TiersService } from './tiers.service.js';

const tiersRoutes: FastifyPluginAsync = async (fastify) => {
  const tiersService = new TiersService(fastify);

  // Get all tires (public for sellers, authenticated for users)
  fastify.get('/', async (request, reply) => {
    try {
      const { type, page = '1', limit = '20' } = request.query as {
        type?: 'LEGER' | 'LOURD';
        page?: string;
        limit?: string;
      };

      const result = await tiersService.getAllTires(type, parseInt(page), parseInt(limit));

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Get tire by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tire = await tiersService.getTireById(id);

      return reply.send({
        success: true,
        data: tire,
      });
    } catch (error: any) {
      return reply.code(404).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Get tires by type
  fastify.get('/type/:type', async (request, reply) => {
    try {
      const { type } = request.params as { type: 'LEGER' | 'LOURD' };
      const tires = await tiersService.getTiresByType(type);

      return reply.send({
        success: true,
        data: tires,
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });
};

export default tiersRoutes;