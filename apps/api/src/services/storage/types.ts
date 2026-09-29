export interface StorageUploadResult {
  key: string;
  publicUrl: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  name: string;
  upload(key: string, data: Buffer, mimeType: string): Promise<StorageUploadResult>;
  download(key: string): Promise<Buffer>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

export type AssetCategory = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'ARCHIVE' | 'OTHER';

export const ASSET_LIMITS: Record<AssetCategory, { maxSize: number; allowedMimes: string[] }> = {
  IMAGE: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  },
  VIDEO: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
  DOCUMENT: {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedMimes: ['application/pdf', 'text/markdown', 'text/plain'],
  },
  ARCHIVE: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedMimes: ['application/zip', 'application/x-zip-compressed', 'application/gzip', 'application/x-tar'],
  },
  OTHER: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimes: ['application/octet-stream', 'application/json'],
  },
};

export function classifyMimeType(mimeType: string): AssetCategory {
  const normalized = (mimeType || '').toLowerCase().trim();
  for (const [category, rule] of Object.entries(ASSET_LIMITS)) {
    if (rule.allowedMimes.includes(normalized)) {
      return category as AssetCategory;
    }
  }
  if (normalized.startsWith('image/')) return 'IMAGE';
  if (normalized.startsWith('video/')) return 'VIDEO';
  if (normalized.startsWith('text/')) return 'DOCUMENT';
  return 'OTHER';
}
