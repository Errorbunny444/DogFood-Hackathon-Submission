import fs from 'node:fs';
import path from 'node:path';
import { StorageProvider, StorageUploadResult } from './types.js';

export class LocalStorageProvider implements StorageProvider {
  public readonly name = 'local';
  private readonly baseDir: string;
  private readonly publicBaseUrl: string;

  constructor(options?: { baseDir?: string; publicBaseUrl?: string }) {
    this.baseDir = path.resolve(options?.baseDir || process.env.STORAGE_LOCAL_DIR || './uploads');
    this.publicBaseUrl = (options?.publicBaseUrl || process.env.STORAGE_PUBLIC_BASE_URL || '/uploads').replace(/\/+$/, '');

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveKeyPath(key: string): string {
    const cleanKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(this.baseDir, cleanKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error(`Security Exception: Access denied outside storage root for key '${key}'`);
    }
    return fullPath;
  }

  async upload(key: string, data: Buffer, mimeType: string): Promise<StorageUploadResult> {
    const targetPath = this.resolveKeyPath(key);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(targetPath, data);

    const publicUrl = this.getPublicUrl(key);
    return {
      key,
      publicUrl,
      size: data.length,
      mimeType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const targetPath = this.resolveKeyPath(key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Storage file '${key}' not found.`);
    }
    return await fs.promises.readFile(targetPath);
  }

  getPublicUrl(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${this.publicBaseUrl}/${normalized}`;
  }

  async delete(key: string): Promise<boolean> {
    const targetPath = this.resolveKeyPath(key);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
      return true;
    }
    return false;
  }

  async exists(key: string): Promise<boolean> {
    const targetPath = this.resolveKeyPath(key);
    return fs.existsSync(targetPath);
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}
