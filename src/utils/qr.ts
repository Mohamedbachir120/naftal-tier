// src/utils/qr.ts
import QRCode from 'qrcode';
import { cryptoUtils } from './crypto.js';

export interface QRCodeData {
  requestId: string;
  userId: string;
  tireId: string;
  timestamp: number;
}

export const qrUtils = {
  // Generate QR code data and hash
  generateQRData(requestId: string, userId: string, tireId: string): { hash: string; data: QRCodeData } {
    const timestamp = Date.now();
    const data: QRCodeData = {
      requestId,
      userId,
      tireId,
      timestamp,
    };
    
    const dataString = JSON.stringify(data);
    const hash = cryptoUtils.hashQRCode(dataString + cryptoUtils.generateToken(16));
    
    return { hash, data };
  },

  // Generate QR code as base64 image
  async generateQRCodeImage(hash: string): Promise<string> {
    const qrCodeData = {
      hash,
      validationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/seller/validate/${hash}`,
    };
    
    return QRCode.toDataURL(JSON.stringify(qrCodeData), {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
  },

  // Parse QR code content
  parseQRCode(content: string): { hash: string; validationUrl: string } | null {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  },
};