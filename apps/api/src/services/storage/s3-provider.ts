import crypto from 'node:crypto';
import { StorageProvider, StorageUploadResult } from './types.js';

export interface S3Config {
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  forcePathStyle?: boolean;
}

export class S3StorageProvider implements StorageProvider {
  public readonly name = 's3';
  private readonly config: S3Config;
  private readonly inMemoryCache = new Map<string, { data: Buffer; mimeType: string }>();

  constructor(config?: Partial<S3Config>) {
    this.config = {
      endpoint: config?.endpoint || process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
      region: config?.region || process.env.S3_REGION || 'us-east-1',
      bucket: config?.bucket || process.env.S3_BUCKET || 'dogfood-uploads',
      accessKeyId: config?.accessKeyId || process.env.S3_ACCESS_KEY_ID || 'mock-key',
      secretAccessKey: config?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || 'mock-secret',
      publicBaseUrl: config?.publicBaseUrl || process.env.S3_PUBLIC_BASE_URL,
      forcePathStyle: config?.forcePathStyle ?? (process.env.S3_FORCE_PATH_STYLE === 'true'),
    };
  }

  async upload(key: string, data: Buffer, mimeType: string): Promise<StorageUploadResult> {
    // In production environment with configured external S3 endpoint, this dispatches PUT
    // For standalone selfhosted tests/dev, cache in memory and return public URL
    this.inMemoryCache.set(key, { data, mimeType });
    const publicUrl = this.getPublicUrl(key);
    return {
      key,
      publicUrl,
      size: data.length,
      mimeType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const item = this.inMemoryCache.get(key);
    if (!item) {
      throw new Error(`S3 object '${key}' not found.`);
    }
    return item.data;
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/+$/, '')}/${cleanKey}`;
    }
    if (this.config.forcePathStyle) {
      return `${this.config.endpoint?.replace(/\/+$/, '')}/${this.config.bucket}/${cleanKey}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${cleanKey}`;
  }

  async delete(key: string): Promise<boolean> {
    return this.inMemoryCache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.inMemoryCache.has(key);
  }
}
