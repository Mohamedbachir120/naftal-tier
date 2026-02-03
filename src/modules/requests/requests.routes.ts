// src/modules/requests/requests.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { RequestsService } from './requests.service.js';
import { createRequestSchema } from './requests.schema.js';

const requestsRoutes: FastifyPluginAsync = async (fastify) => {
  const requestsService = new RequestsService(fastify);

  // Create new tire request
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        // Check if user is approved
        if (request.user.status !== 'APPROVED') {
          return reply.code(403).send({
            success: false,
            error: 'Your account must be approved to make requests',
          });
        }

        const input = createRequestSchema.parse(request.body);
        const result = await requestsService.createRequest(request.user.id, input);

        return reply.code(201).send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Get requests list
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { page = '1', limit = '10' } = request.query as { page?: string; limit?: string };
        const result = await requestsService.getRequestsList(
          request.user.id,
          parseInt(page),
          parseInt(limit)
        );

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
    }
  );

  // Get request details
  fastify.get(
    '/:requestId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { requestId } = request.params as { requestId: string };
        const result = await requestsService.getRequestDetails(request.user.id, requestId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        return reply.code(404).send({
          success: false,
          error: error.message,
        });
      }
    }
  );
};

export default requestsRoutes;