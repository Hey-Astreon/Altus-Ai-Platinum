import { safeStorage } from 'electron';
import Store from 'electron-store';

export class SettingsService {
  private store: Store;

  constructor() {
    this.store = new Store();
  }

  public saveKeys(keys: string[]) {
    if (!safeStorage.isEncryptionAvailable()) {
      this.store.set('openrouterKeys', keys);
      return;
    }

    const encryptedKeys = keys.map(k => safeStorage.encryptString(k).toString('base64'));
    this.store.set('openrouterKeys', encryptedKeys);
  }

  public getKeys(): string[] {
    const data = this.store.get('openrouterKeys') as string[];
    if (!data || !Array.isArray(data)) return [];

    if (!safeStorage.isEncryptionAvailable()) return data;

    return data.map(encrypted => {
      try {
        return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      } catch (e) {
        return '';
      }
    }).filter(k => k !== '');
  }

  public hasKeys(): boolean {
    return this.getKeys().length > 0;
  }

  public saveSetting(key: string, value: any) {
    this.store.set(key, value);
  }

  public getSetting(key: string, defaultValue: any): any {
    return this.store.get(key, defaultValue);
  }

  public purgeAll() {
    this.store.clear();
  }
}
