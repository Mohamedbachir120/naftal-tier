// src/modules/requests/requests.service.ts
import { FastifyInstance } from 'fastify';
import { CreateRequestInput } from './requests.schema.js';
import { qrUtils } from '../../utils/qr.js';
import { quotaUtils } from '../../utils/quotas.js';
import { RequestStatus } from '@prisma/client';
import * as crypto from 'crypto';

export class RequestsService {
  constructor(private fastify: FastifyInstance) {}

  // Helper to access Redis without Type errors
  private get redis() {
    return (this.fastify as any).redis;
  }

  // Helper to sync Redis after SQL updates
  private async updateRedisStock(stationId: string, tireId: string, newQuantity: number) {
    try {
      const key = `station:${stationId}:tire:${tireId}:stock`;
      await this.redis.set(key, newQuantity.toString());
    } catch (err) {
      this.fastify.log.error(err, `Failed to update Redis for ${stationId}/${tireId}`);
    }
  }

  async createRequest(userId: string, input: CreateRequestInput) {
    // 1. Guard Clause: Check existence
    if (!input.stationId) {
      throw new Error('Station ID is required to create a request');
    }

    // Capture constants for strict typing inside closure
    const stationId = input.stationId;
    const tireId = input.tireId;
    const quantity = input.quantity;

    // 2. Check user status
    const user = await this.fastify.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isVerified) {
      throw new Error('Your account must be verified (Carte Grise approved) to make requests');
    }

    // 3. Get tire info
    const tire = await this.fastify.prisma.tire.findUnique({
      where: { id: tireId },
    });

    if (!tire) {
      throw new Error('Tire definition not found');
    }

    // 4. Check Quota
    const currentYear = new Date().getFullYear();
    const quotaCheck = await quotaUtils.checkQuotaAvailability(
      this.fastify.prisma,
      userId,
      tire.type,
      quantity,
      currentYear
    );

    if (!quotaCheck.available) {
      throw new Error(
        `Quota exceeded. You have ${quotaCheck.remaining} remaining for ${tire.type} tires this year.`
      );
    }

    // 5. THE CRITICAL TRANSACTION
    let request;
    let finalStockCount = 0;

    try {
      request = await this.fastify.prisma.$transaction(async (tx) => {
        // A. ATOMIC UPDATE
        const updateResult = await tx.stationInventory.updateMany({
          where: {
            stationId: stationId, 
            tireId: tireId,
            quantity: { gte: quantity }
          },
          data: {
            quantity: { decrement: quantity }
          }
        });

        if (updateResult.count === 0) {
          throw new Error('OUT_OF_STOCK');
        }

        // B. Fetch new stock level
        const inventory = await tx.stationInventory.findUnique({
          where: { 
            stationId_tireId: { 
              stationId: stationId,
              tireId: tireId 
            } 
          }
        });
        finalStockCount = inventory?.quantity || 0;

        // C. Generate QR (Local scope only)
        const tempRequestId = crypto.randomUUID();
        const qrData = qrUtils.generateQRData(tempRequestId, userId, tireId);
        const qrHash = qrData.hash;

        // D. Create Request
        return await tx.tireRequest.create({
          data: {
            userId,
            tireId: tireId,
            stationId: stationId,
            status: 'EN_ATTENTE',
            qrCodeHash: qrHash,
            year: currentYear,
            quantity: quantity,
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
      });
    } catch (error: any) {
      if (error.message === 'OUT_OF_STOCK') {
        await this.updateRedisStock(stationId, tireId, 0);
        throw new Error('Sorry, this tire just sold out at this station.');
      }
      throw error;
    }

    // 6. Update Redis
    this.updateRedisStock(stationId, tireId, finalStockCount);

    // 7. Generate QR Image
    // FIX: Use the hash from the created request object (It is guaranteed to be a string)
    const qrCodeImage = await qrUtils.generateQRCodeImage(request.qrCodeHash);

    return {
      request,
      qrCodeImage,
      quotaInfo: {
        used: quotaCheck.used + quantity,
        remaining: quotaCheck.remaining - quantity,
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
            phone: true,
            isVerified: true
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
    const result = await this.fastify.prisma.$transaction(async (tx) => {
      
      const currentRequest = await tx.tireRequest.findUnique({
        where: { id: requestId },
        select: { status: true, stationId: true, tireId: true, quantity: true }
      });

      if (!currentRequest) throw new Error("Request not found");

      // Logic: If Cancelling, return stock
      if (status === 'ANNULE' && currentRequest.status !== 'ANNULE' && currentRequest.status !== 'LIVRE') {
        if (currentRequest.stationId) {
            await tx.stationInventory.update({
                where: { 
                    stationId_tireId: { 
                        stationId: currentRequest.stationId, 
                        tireId: currentRequest.tireId 
                    } 
                },
                data: { quantity: { increment: currentRequest.quantity } }
            });
        }
      }

      const updatedRequest = await tx.tireRequest.update({
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

      return updatedRequest;
    });

    // Sync Redis if canceled
    if (status === 'ANNULE' && result.stationId) {
        const freshStock = await this.fastify.prisma.stationInventory.findUnique({
             where: { stationId_tireId: { stationId: result.stationId, tireId: result.tireId } }
        });
        if (freshStock) {
            this.updateRedisStock(result.stationId, result.tireId, freshStock.quantity);
        }
    }

    return result;
  }
}