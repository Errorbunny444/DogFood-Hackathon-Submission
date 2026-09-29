import { StorageProvider } from './types.js';
import { LocalStorageProvider } from './local-provider.js';
import { S3StorageProvider } from './s3-provider.js';

export * from './types.js';
export * from './local-provider.js';
export * from './s3-provider.js';

let defaultStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!defaultStorageProvider) {
    const providerType = (process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
    if (providerType === 's3' || providerType === 'r2' || providerType === 'minio') {
      defaultStorageProvider = new S3StorageProvider();
    } else {
      defaultStorageProvider = new LocalStorageProvider();
    }
  }
  return defaultStorageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  defaultStorageProvider = provider;
}
