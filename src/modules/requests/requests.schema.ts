// src/modules/requests/requests.schema.ts
import { z } from 'zod';

export const createRequestSchema = z.object({
  tireId: z.string().uuid(),
  stationId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(4).default(1),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(['EN_ATTENTE', 'EN_PREPARATION', 'PRET', 'LIVRE']),
  note: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;