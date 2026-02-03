// src/utils/crypto.ts
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key!'; // Must be 32 chars
const IV_LENGTH = 16;
const SALT_ROUNDS = 12;

export const cryptoUtils = {
  // Encrypt sensitive data (NIN, Card ID, etc.)
  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  },

  // Decrypt sensitive data
  decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  },

  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  // Generate random token
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  },

  // Hash for QR code
  hashQRCode(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  },
};