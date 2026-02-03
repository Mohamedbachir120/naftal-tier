// src/modules/tiers/tiers.service.ts
import { FastifyInstance } from 'fastify';
import { TireType } from '@prisma/client';

export class TiersService {
  constructor(private fastify: FastifyInstance) {}

  async getAllTires(type?: TireType, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) {
      where.type = type;
    }

    const [tires, total] = await Promise.all([
      this.fastify.prisma.tire.findMany({
        where,
        orderBy: [{ type: 'asc' }, { dimension: 'asc' }],
        skip,
        take: limit,
      }),
      this.fastify.prisma.tire.count({ where }),
    ]);

    return {
      tires,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTireById(id: string) {
    const tire = await this.fastify.prisma.tire.findUnique({
      where: { id },
    });

    if (!tire) {
      throw new Error('Tire not found');
    }

    return tire;
  }

  async getTiresByType(type: TireType) {
    return this.fastify.prisma.tire.findMany({
      where: { type },
      orderBy: { dimension: 'asc' },
    });
  }
}