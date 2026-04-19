import { safeStorage } from 'electron';
import Store from 'electron-store';

interface AuraSettings {
  assemblyAiKey?: string;
  openRouterKey?: string;
  globalOpacity?: number;
}

export class SettingsService {
  private store: Store;

  constructor() {
    this.store = new Store();
  }

  public saveKey(type: 'assembly' | 'openrouter', key: string) {
    if (!safeStorage.isEncryptionAvailable()) {
      // Fallback if encryption is disabled (rare on Windows/Mac)
      this.store.set(type + 'Key', key);
      return;
    }

    const encrypted = safeStorage.encryptString(key).toString('base64');
    this.store.set(type + 'Key', encrypted);
  }

  public getKey(type: 'assembly' | 'openrouter'): string {
    const data = this.store.get(type + 'Key') as string;
    if (!data) return '';

    if (!safeStorage.isEncryptionAvailable()) return data;

    try {
      return safeStorage.decryptString(Buffer.from(data, 'base64'));
    } catch (e) {
      console.error(`[SettingsService] Failed to decrypt ${type} key:`, e);
      return '';
    }
  }

  public hasKeys(): boolean {
    return !!(this.getKey('assembly') && this.getKey('openrouter'));
  }

  // Generic settings (unencrypted)
  public saveSetting(key: string, value: any) {
    this.store.set(key, value);
  }

  public getSetting(key: string, defaultValue: any): any {
    return this.store.get(key, defaultValue);
  }
}
