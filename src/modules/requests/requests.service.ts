// src/modules/requests/requests.service.ts
import { FastifyInstance } from 'fastify';
import { CreateRequestInput } from './requests.schema.js';
import { qrUtils } from '../../utils/qr.js';
import { quotaUtils } from '../../utils/quotas.js';
import { RequestStatus } from '@prisma/client';

export class RequestsService {
  constructor(private fastify: FastifyInstance) {}

  async createRequest(userId: string, input: CreateRequestInput) {
    // Check user status
    const user = await this.fastify.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== 'APPROVED') {
      throw new Error('Your account must be approved to make requests');
    }

    // Get tire info
    const tire = await this.fastify.prisma.tire.findUnique({
      where: { id: input.tireId },
    });

    if (!tire) {
      throw new Error('Tire not found');
    }

    // Check quota
    const currentYear = new Date().getFullYear();
    const quotaCheck = await quotaUtils.checkQuotaAvailability(
      this.fastify.prisma,
      userId,
      tire.type,
      input.quantity,
      currentYear
    );

    if (!quotaCheck.available) {
      throw new Error(
        `Quota exceeded. You have ${quotaCheck.remaining} remaining for ${tire.type} tires this year.`
      );
    }

    // Generate QR code
    const tempRequestId = crypto.randomUUID();
    const { hash } = qrUtils.generateQRData(tempRequestId, userId, input.tireId);

    // Create request with status history
    const request = await this.fastify.prisma.tireRequest.create({
      data: {
        userId,
        tireId: input.tireId,
        stationId: input.stationId,
        status: 'EN_ATTENTE',
        qrCodeHash: hash,
        year: currentYear,
        quantity: input.quantity,
        statusHistory: {
          create: {
            status: 'EN_ATTENTE',
            changedBy: userId,
            note: 'Request created',
          },
        },
      },
      include: {
        tire: true,
        station: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Generate QR code image
    const qrCodeImage = await qrUtils.generateQRCodeImage(hash);

    return {
      request,
      qrCodeImage,
      quotaInfo: {
        used: quotaCheck.used + input.quantity,
        remaining: quotaCheck.remaining - input.quantity,
        max: quotaCheck.max,
      },
    };
  }

  async getRequestsList(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      this.fastify.prisma.tireRequest.findMany({
        where: { userId },
        include: {
          tire: true,
          station: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.fastify.prisma.tireRequest.count({
        where: { userId },
      }),
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

  async getRequestDetails(userId: string, requestId: string) {
    const request = await this.fastify.prisma.tireRequest.findFirst({
      where: {
        id: requestId,
        userId,
      },
      include: {
        tire: true,
        station: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    // Generate QR code image
    const qrCodeImage = await qrUtils.generateQRCodeImage(request.qrCodeHash);

    return {
      request,
      qrCodeImage,
    };
  }

  async getRequestByQRHash(qrHash: string) {
    const request = await this.fastify.prisma.tireRequest.findUnique({
      where: { qrCodeHash: qrHash },
      include: {
        tire: true,
        station: true,
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
        },
      },
    });

    return request;
  }

  async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    changedBy: string,
    note?: string
  ) {
    const request = await this.fastify.prisma.tireRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(status === 'LIVRE' && { deliveredAt: new Date(), qrUsed: true }),
        statusHistory: {
          create: {
            status,
            changedBy,
            note,
          },
        },
      },
      include: {
        tire: true,
        station: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return request;
  }
}