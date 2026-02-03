// src/modules/sellers/sellers.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { SellersService } from './seller.service.js';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum(['EN_ATTENTE', 'EN_PREPARATION', 'PRET', 'LIVRE']),
  note: z.string().optional(),
});

const sellersRoutes: FastifyPluginAsync = async (fastify) => {
  const sellersService = new SellersService(fastify);

  // Get seller's station info
  fastify.get(
    '/station',
    { preHandler: [fastify.authenticateSeller] },
    async (request, reply) => {
      try {
        const station = await sellersService.getSellerStation(request.user.id);
        return reply.send({
          success: true,
          data: station,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Get requests for seller's station
  fastify.get(
    '/requests',
    { preHandler: [fastify.authenticateSeller] },
    async (request, reply) => {
      try {
        const { status, page = '1', limit = '10' } = request.query as {
          status?: string;
          page?: string;
          limit?: string;
        };

        const result = await sellersService.getStationRequests(
          request.user.id,
          status as any,
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

  // Get pending requests (available to accept)
  fastify.get(
    '/requests/pending',
    { preHandler: [fastify.authenticateSeller] },
    async (request, reply) => {
      try {
        const { page = '1', limit = '10' } = request.query as {
          page?: string;
          limit?: string;
        };
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [requests, total] = await Promise.all([
          fastify.prisma.tireRequest.findMany({
            where: {
              status: 'EN_ATTENTE',
              stationId: null,
            },
            include: {
              tire: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
            skip,
            take: parseInt(limit),
          }),
          fastify.prisma.tireRequest.count({
            where: {
              status: 'EN_ATTENTE',
              stationId: null,
            },
          }),
        ]);

        return reply.send({
          success: true,
          data: {
            requests,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total,
              totalPages: Math.ceil(total / parseInt(limit)),
            },
          },
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Accept a request
  fastify.post(
    '/requests/:requestId/accept',
    { preHandler: [fastify.authenticateSeller] },
    async (request, reply) => {
      try {
        const { requestId } = request.params as { requestId: string };
        const result = await sellersService.acceptRequest(request.user.id, requestId);

        return reply.send({
          success: true,
          message: 'Request accepted successfully',
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

  // Update request status
  fastify.patch(
    '/requests/:requestId/status',
    { preHandler: [fastify.authenticateSeller] },
    async (request, reply) => {
      try {
        const { requestId } = request.params as { requestId: string };
        const input = updateStatusSchema.parse(request.body);

        const result = await sellersService.updateRequestStatus(
          request.user.id,
          requestId,
          input.status,
          input.note
        );

        return reply.send({
          success: true,
          message: 'Status updated successfully',
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

  // Validate QR code
  fastify.post(
    '/validate/:qrHash',
    { preHandler: [fastify.authenticateSeller] },
    async (request, reply) => {
      try {
        const { qrHash } = request.params as { qrHash: string };
        const result = await sellersService.validateQRCode(request.user.id, qrHash);

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

  // Complete delivery via QR scan
  fastify.post(
    '/deliver/:qrHash',
    { preHandler: [fastify.authenticateSeller] },
    async (request, reply) => {
      try {
        const { qrHash } = request.params as { qrHash: string };
        const result = await sellersService.completeDelivery(request.user.id, qrHash);

        return reply.send({
          success: true,
          message: 'Delivery completed successfully',
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
};

export default sellersRoutes;