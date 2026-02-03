// src/modules/sellers/sellers.service.ts
import { FastifyInstance } from 'fastify';
import { RequestStatus } from '@prisma/client';

export class SellersService {
  constructor(private fastify: FastifyInstance) {}

  async getSellerStation(userId: string) {
    const seller = await this.fastify.prisma.seller.findUnique({
      where: { userId },
      include: {
        station: true,
      },
    });

    if (!seller) {
      throw new Error('Seller not found');
    }

    return seller;
  }

  async getStationRequests(
    sellerId: string,
    status?: RequestStatus,
    page: number = 1,
    limit: number = 10
  ) {
    const seller = await this.getSellerStation(sellerId);
    const skip = (page - 1) * limit;

    const where: any = {
      stationId: seller.stationId,
    };

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      this.fastify.prisma.tireRequest.findMany({
        where,
        include: {
          tire: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.fastify.prisma.tireRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async validateQRCode(sellerId: string, qrHash: string) {
    const seller = await this.getSellerStation(sellerId);

    const request = await this.fastify.prisma.tireRequest.findUnique({
      where: { qrCodeHash: qrHash },
      include: {
        tire: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        station: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      return {
        valid: false,
        error: 'Invalid QR code - Request not found',
      };
    }

    if (request.qrUsed) {
      return {
        valid: false,
        error: 'QR code has already been used',
        request,
      };
    }

    if (request.status !== 'PRET') {
      return {
        valid: false,
        error: `Request is not ready for delivery. Current status: ${request.status}`,
        request,
      };
    }

    if (request.stationId !== seller.stationId) {
      return {
        valid: false,
        error: 'This request is assigned to a different station',
        request,
      };
    }

    return {
      valid: true,
      request,
    };
  }

  async completeDelivery(sellerId: string, qrHash: string) {
    const validation = await this.validateQRCode(sellerId, qrHash);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const request = await this.fastify.prisma.tireRequest.update({
      where: { qrCodeHash: qrHash },
      data: {
        status: 'LIVRE',
        qrUsed: true,
        deliveredAt: new Date(),
        statusHistory: {
          create: {
            status: 'LIVRE',
            changedBy: sellerId,
            note: 'Delivered via QR code scan',
          },
        },
      },
      include: {
        tire: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        station: true,
      },
    });

    return request;
  }

  async updateRequestStatus(
    sellerId: string,
    requestId: string,
    status: RequestStatus,
    note?: string
  ) {
    const seller = await this.getSellerStation(sellerId);

    const request = await this.fastify.prisma.tireRequest.findFirst({
      where: {
        id: requestId,
        stationId: seller.stationId,
      },
    });

    if (!request) {
      throw new Error('Request not found or not assigned to your station');
    }

    const updatedRequest = await this.fastify.prisma.tireRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(status === 'LIVRE' && { deliveredAt: new Date(), qrUsed: true }),
        statusHistory: {
          create: {
            status,
            changedBy: sellerId,
            note,
          },
        },
      },
      include: {
        tire: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return updatedRequest;
  }

  async acceptRequest(sellerId: string, requestId: string) {
    const seller = await this.getSellerStation(sellerId);

    const request = await this.fastify.prisma.tireRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'EN_ATTENTE') {
      throw new Error('Request is not in pending status');
    }

    const updatedRequest = await this.fastify.prisma.tireRequest.update({
      where: { id: requestId },
      data: {
        stationId: seller.stationId,
        status: 'EN_PREPARATION',
        statusHistory: {
          create: {
            status: 'EN_PREPARATION',
            changedBy: sellerId,
            note: 'Request accepted by seller',
          },
        },
      },
      include: {
        tire: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        station: true,
      },
    });

    return updatedRequest;
  }
}