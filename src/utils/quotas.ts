// src/utils/quotas.ts
import { TireType } from '@prisma/client';

export interface QuotaConfig {
  maxPerYear: number;
  type: TireType;
}

export const quotaConfig: Record<TireType, QuotaConfig> = {
  LEGER: {
    maxPerYear: 4,
    type: 'LEGER',
  },
  LOURD: {
    maxPerYear: 8,
    type: 'LOURD',
  },
};

export const quotaUtils = {
  getMaxQuota(type: TireType): number {
    return quotaConfig[type].maxPerYear;
  },

  async checkQuotaAvailability(
    prisma: any,
    userId: string,
    tireType: TireType,
    requestedQuantity: number,
    year: number
  ): Promise<{ available: boolean; remaining: number; used: number; max: number }> {
    const maxQuota = this.getMaxQuota(tireType);

    const usedQuota = await prisma.tireRequest.aggregate({
      where: {
        userId,
        year,
        tire: {
          type: tireType,
        },
        status: {
          not: 'LIVRE', // Don't count delivered as they're already consumed
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const used = usedQuota._sum.quantity || 0;
    const remaining = maxQuota - used;
    const available = remaining >= requestedQuantity;

    return {
      available,
      remaining,
      used,
      max: maxQuota,
    };
  },
};