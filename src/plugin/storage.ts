// src/plugin/storage.ts
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

interface StorageConfig {
  useMinIO: boolean;
  minioConfig?: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  };
  localPath?: string;
  bucketName: string;
}

interface StorageService {
  uploadFile: (filename: string, stream: Readable, contentType: string) => Promise<string>;
  getFile: (filename: string) => Promise<Buffer>;
  deleteFile: (filename: string) => Promise<void>;
  getFileUrl: (filename: string) => string;
}

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageService;
  }
}

const storagePlugin: FastifyPluginAsync<StorageConfig> = async (fastify, opts) => {
  const config: StorageConfig = {
    useMinIO: opts.useMinIO ?? false,
    minioConfig: opts.minioConfig ?? {
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    },
    localPath: opts.localPath ?? path.join(process.cwd(), 'src', 'storage', 'documents'),
    bucketName: opts.bucketName ?? 'naftal-documents',
  };

  let minioClient: Minio.Client | null = null;

  if (config.useMinIO && config.minioConfig) {
    minioClient = new Minio.Client(config.minioConfig);
    
    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(config.bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(config.bucketName);
      fastify.log.info(`Created MinIO bucket: ${config.bucketName}`);
    }
  } else {
    // Ensure local directory exists
    if (!fs.existsSync(config.localPath!)) {
      fs.mkdirSync(config.localPath!, { recursive: true });
    }
  }

  const storage: StorageService = {
    async uploadFile(filename: string, stream: Readable, contentType: string): Promise<string> {
      const uniqueFilename = `${Date.now()}-${filename}`;

      if (config.useMinIO && minioClient) {
        await minioClient.putObject(config.bucketName, uniqueFilename, stream, undefined, {
          'Content-Type': contentType,
        });
        return uniqueFilename;
      } else {
        const filePath = path.join(config.localPath!, uniqueFilename);
        const writeStream = fs.createWriteStream(filePath);
        await pipeline(stream, writeStream);
        return uniqueFilename;
      }
    },

    async getFile(filename: string): Promise<Buffer> {
      if (config.useMinIO && minioClient) {
        const stream = await minioClient.getObject(config.bucketName, filename);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } else {
        const filePath = path.join(config.localPath!, filename);
        return fs.promises.readFile(filePath);
      }
    },

    async deleteFile(filename: string): Promise<void> {
      if (config.useMinIO && minioClient) {
        await minioClient.removeObject(config.bucketName, filename);
      } else {
        const filePath = path.join(config.localPath!, filename);
        await fs.promises.unlink(filePath);
      }
    },

    getFileUrl(filename: string): string {
      if (config.useMinIO && config.minioConfig) {
        const protocol = config.minioConfig.useSSL ? 'https' : 'http';
        return `${protocol}://${config.minioConfig.endPoint}:${config.minioConfig.port}/${config.bucketName}/${filename}`;
      } else {
        return `/storage/documents/${filename}`;
      }
    },
  };

  fastify.decorate('storage', storage);
};

export default fp(storagePlugin, { name: 'storage' });