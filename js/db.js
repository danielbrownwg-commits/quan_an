    /* ==========================================================================
       3. INDEXEDDB STORAGE ENGINE & OBJECT URL MANAGER
       ========================================================================== */
import { DB_NAME, DB_VERSION } from './util.js';

    export const DB = {
      db: null,
      blobUrls: new Map(), // key -> objectURL

      async init() {
        return new Promise((resolve, reject) => {
          if (!('indexedDB' in window)) {
            reject(new Error('This browser does not support IndexedDB.'));
            return;
          }
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('places')) db.createObjectStore('places', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'key' });
            if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
          };
          req.onsuccess = (e) => {
            this.db = e.target.result;
            resolve();
          };
          req.onerror = () => reject(req.error);
        });
      },

      async getAll(storeName) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      },

      async get(storeName, key) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      },

      async put(storeName, item) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },

      async delete(storeName, key) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },

      async clearStore(storeName) {
        return new Promise((resolve, reject) => {
          const tx = this.db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },

      async getPhotoUrl(blobKey) {
        if (!blobKey) return null;
        if (this.blobUrls.has(blobKey)) return this.blobUrls.get(blobKey);
        const rec = await this.get('photos', blobKey);
        if (!rec || !rec.blob) return null;
        const url = URL.createObjectURL(rec.blob);
        this.blobUrls.set(blobKey, url);
        return url;
      },

      revokePhotoUrl(blobKey) {
        if (this.blobUrls.has(blobKey)) {
          URL.revokeObjectURL(this.blobUrls.get(blobKey));
          this.blobUrls.delete(blobKey);
        }
      },

      revokeAllUrls() {
        for (const url of this.blobUrls.values()) URL.revokeObjectURL(url);
        this.blobUrls.clear();
      }
    };
