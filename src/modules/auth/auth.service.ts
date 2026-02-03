// src/modules/auth/auth.service.ts
import { FastifyInstance } from 'fastify';
import { RegisterInput, LoginInput } from './auth.schema.js';
import { cryptoUtils } from '../../utils/crypto.js';
import { UserStatus } from '@prisma/client';

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async register(
    input: RegisterInput,
    files: {
      ninDoc?: { filename: string; stream: NodeJS.ReadableStream; mimetype: string };
      cardIdDoc?: { filename: string; stream: NodeJS.ReadableStream; mimetype: string };
      carteGriseDoc?: { filename: string; stream: NodeJS.ReadableStream; mimetype: string };
    }
  ) {
    // Check if user already exists
    const existingUser = await this.fastify.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Encrypt sensitive data
    const ninEncrypted = cryptoUtils.encrypt(input.nin);
    const cardIdEncrypted = cryptoUtils.encrypt(input.cardId);
    const carteGriseEnc = cryptoUtils.encrypt(input.carteGrise);
    const passwordHash = await cryptoUtils.hashPassword(input.password);

    // Upload documents
    let ninDocPath: string | undefined;
    let cardIdDocPath: string | undefined;
    let carteGriseDocPath: string | undefined;

    if (files.ninDoc) {
      ninDocPath = await this.fastify.storage.uploadFile(
        files.ninDoc.filename,
        files.ninDoc.stream,
        files.ninDoc.mimetype
      );
    }

    if (files.cardIdDoc) {
      cardIdDocPath = await this.fastify.storage.uploadFile(
        files.cardIdDoc.filename,
        files.cardIdDoc.stream,
        files.cardIdDoc.mimetype
      );
    }

    if (files.carteGriseDoc) {
      carteGriseDocPath = await this.fastify.storage.uploadFile(
        files.carteGriseDoc.filename,
        files.carteGriseDoc.stream,
        files.carteGriseDoc.mimetype
      );
    }

    // Create user
    const user = await this.fastify.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        phone: input.phone,
        ninEncrypted,
        cardIdEncrypted,
        carteGriseEnc,
        ninDocPath,
        cardIdDocPath,
        carteGriseDocPath,
        status: 'PENDING',
        role: 'USER',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async login(input: LoginInput) {
    const user = await this.fastify.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await cryptoUtils.verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = this.fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    return {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }

  async getRegistrationStatus(userId: string) {
    const user = await this.fastify.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      status: user.status,
      message: this.getStatusMessage(user.status),
      registeredAt: user.createdAt,
      lastUpdated: user.updatedAt,
    };
  }

  private getStatusMessage(status: UserStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Your registration is pending admin approval. Please wait for verification.';
      case 'APPROVED':
        return 'Your registration has been approved. You can now make tire requests.';
      case 'REJECTED':
        return 'Your registration has been rejected. Please contact support for more information.';
      default:
        return 'Unknown status';
    }
  }

  async getProfile(userId: string) {
    const user = await this.fastify.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}