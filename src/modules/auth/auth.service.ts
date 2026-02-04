// src/modules/auth/auth.service.ts
import { FastifyInstance } from 'fastify';
import { RegisterInput, LoginInput } from './auth.schema.js';
import { cryptoUtils } from '../../utils/crypto.js';
// Removed UserStatus import, using boolean isVerified instead

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async register(
    input: RegisterInput, // Assumes input now has: firstName, lastName, phone, password
    files: {
      carteGriseDoc?: { filename: string; stream: NodeJS.ReadableStream; mimetype: string };
    }
  ) {
    // 1. Check if user already exists (By PHONE, not Email)
    const existingUser = await this.fastify.prisma.user.findUnique({
      where: { phone: input.phone },
    });

    if (existingUser) {
      throw new Error('User with this phone number already exists');
    }

    // 2. Hash Password (No encryption needed for NIN/CardID anymore)
    // Note: If you allow waitlist users to register later, you might handle empty passwords here, 
    // but for now we assume standard registration.
    const passwordHash = input.password 
      ? await cryptoUtils.hashPassword(input.password) 
      : null;

    // 3. Upload Document (Only Carte Grise is required now)
    let carteGriseDocPath: string | undefined;
    let ocrResultText = ""; 

    if (files.carteGriseDoc) {
      carteGriseDocPath = await this.fastify.storage.uploadFile(
        files.carteGriseDoc.filename,
        files.carteGriseDoc.stream,
        files.carteGriseDoc.mimetype
      );

      // TODO: Integrate your actual OCR Service here (e.g., Tesseract, Google Vision)
      // For now, we simulate extraction.
      // ocrResultText = await this.ocrService.extractText(carteGriseDocPath);
      ocrResultText = "OCR_PENDING_EXTRACTION"; 
    }

    // 4. Create user
    const user = await this.fastify.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        passwordHash,
        
        // Document & OCR Data
        carteGriseDocPath,
        carteGriseRawOCR: ocrResultText, // Immutable Audit log
        carteGriseNum: ocrResultText,    // Editable active number (initially same as OCR)
        
        // Defaults
        isVerified: false, // Replaces status: PENDING
        role: 'USER',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        isVerified: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async login(input: LoginInput) {
    // 1. Find by Phone
    const user = await this.fastify.prisma.user.findUnique({
      where: { phone: input.phone },
    });

    if (!user || !user.passwordHash) {
      throw new Error('Invalid phone number or password');
    }

    // 2. Verify Password
    const isValidPassword = await cryptoUtils.verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid phone number or password');
    }

    // 3. Generate JWT token
    const token = this.fastify.jwt.sign({
      id: user.id,
      phone: user.phone,
      role: user.role,
      status: user.isVerified ? 'APPROVED' : 'PENDING', // Simplified status for token
    });

    return {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
    };
  }

  async getRegistrationStatus(userId: string) {
    const user = await this.fastify.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        isVerified: true, // Boolean check
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Logic updated for boolean isVerified
    return {
      isVerified: user.isVerified,
      message: user.isVerified 
        ? 'Your account is verified. You can make tire requests.' 
        : 'Your registration is pending verification of your Carte Grise.',
      registeredAt: user.createdAt,
      lastUpdated: user.updatedAt,
    };
  }

  async getProfile(userId: string) {
    const user = await this.fastify.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        // Removed email
        carteGriseNum: true, // Useful for user to see their verified number
        role: true,
        isVerified: true,
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