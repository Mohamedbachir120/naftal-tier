// src/modules/auth/auth.schema.ts
import { z } from 'zod';
import { UserRole } from '@prisma/client';

// ─── Input Schemas ───────────────────────────────────────────────

export const registerBodySchema = z.object({
  firstName: z.string().min(2).max(50).describe('User first name'),
  lastName: z.string().min(2).max(50).describe('User last name'),
  phone: z
    .string()
    .min(10)
    .max(15)
    .describe('Phone number (unique, used for login)'),
  password: z.string().min(8).max(100).describe('Account password'),
});

export const loginBodySchema = z.object({
  phone: z.string().min(1).describe('Registered phone number'),
  password: z.string().min(1).describe('Account password'),
});

// ─── Shared Primitives ──────────────────────────────────────────
// z.date() accepts Date objects from Prisma and serializes to ISO strings in JSON.
// z.nativeEnum(UserRole) accepts the Prisma UserRole enum directly.

const roleSchema = z.nativeEnum(UserRole);

// ─── Response Schemas ────────────────────────────────────────────

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const userSummarySchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  isVerified: z.boolean(),
  role: roleSchema,
  createdAt: z.date(),  // ← Date, not string
});

export const registerResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: userSummarySchema,
});

export const loginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().describe('JWT access token'),
    user: z.object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      role: roleSchema,
      isVerified: z.boolean(),
    }),
  }),
});

export const statusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    isVerified: z.boolean(),
    message: z.string(),
    registeredAt: z.date(),   // ← Date, not string
    lastUpdated: z.date(),    // ← Date, not string
  }),
});

export const profileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    carteGriseNum: z.string().nullable(),
    role: roleSchema,
    isVerified: z.boolean(),
    createdAt: z.date(),      // ← Date, not string
    updatedAt: z.date(),      // ← Date, not string
  }),
});

// ─── Inferred Types ──────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
// ─── Multipart Schema (for OpenAPI docs only) ────────────────────
// Used to document the register endpoint which accepts multipart/form-data.
// The file field can't be validated by Zod at runtime, but this
// generates correct OpenAPI documentation.
export const registerMultipartSchema = registerBodySchema.extend({
  carteGriseDoc: z
    .any()
    .optional()
    .describe('Carte Grise document upload (image or PDF, max 5MB)'),
});

// ─── Inferred Types ──────────────────────────────────────────────
 