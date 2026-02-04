// src/modules/auth/auth.schema.ts
import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().min(10).max(15),
  nin: z.string().min(10).max(20), // National ID Number
  cardId: z.string().min(5).max(20),
  carteGrise: z.string().min(5).max(20),
});

export const loginSchema = z.object({
  phone: z.string(),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;