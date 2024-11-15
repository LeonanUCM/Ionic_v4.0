import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private storageInitialized: Promise<void>;

  constructor(private storage: Storage) {
    this.storageInitialized = this.initStorage();
  }

  /**
   * Inicializa el almacenamiento.
   */
  private async initStorage(): Promise<void> {
    console.debug('Initializing storage...');
    await this.storage.create();
    console.debug('Storage initialized.');
  }

  /**
   * Guarda un item individual en el storage.
   * @param item El item a guardar.
   */
  public async save(item: any, type: string = ""): Promise<void> {
    await this.storageInitialized;
    const key = `${type}_${item.id}`;
    console.debug(`Saving item with key: ${key}, item:`, item);
    await this.storage.set(key, item);
    console.debug(`Item with key: ${key} saved successfully.`);
  }

  /**
   * Obtiene un item individual del storage por ID.
   * @param id El ID del item a obtener.
   * @returns El StorageItem o null si no se encuentra.
   */
  public async get(id: number, type: string = ""): Promise<any | null> {
    await this.storageInitialized;
    const key = `${type}_${id}`;
    console.debug(`Retrieving item with key: ${key}`);
    const item = await this.storage.get(key);
    if (item) {
      console.debug(`Item retrieved successfully:`, item);
    } else {
      console.debug(`Item with key: ${key} not found.`);
    }
    return item || null;
  }

  /**
   * Actualiza un item existente en el storage.
   * @param item El item a actualizar.
   */
  public async update(item: any, type: string = ""): Promise<void> {
    await this.storageInitialized;
    const key = `${type}_${item.id}`;
    console.debug(`Updating item with key: ${key}, new item:`, item);
    await this.storage.set(key, item);
    console.debug(`Item with key: ${key} updated successfully.`);
  }

  /**
   * Elimina un item del storage por ID.
   * @param id El ID del item a eliminar.
   */
  public async remove(id: number, type: string = ""): Promise<void> {
    await this.storageInitialized;
    const key = `${type}_${id}`;
    console.debug(`Removing item with key: ${key}`);
    await this.storage.remove(key);
    console.debug(`Item with key: ${key} removed successfully.`);
  }

  /**
   * Obtiene todos los items del storage.
   * @returns Una lista de StorageItem.
   */
  public async getAll(type: string = ""): Promise<any[]> {
    await this.storageInitialized;
    console.debug(`Retrieving all items for type: ${type}`);
    const keys = await this.storage.keys();
    const itemKeys = keys.filter(key => key.startsWith(`${type}_`));
    console.debug(`Filtered keys for type: ${type}`, itemKeys);

    const items: any[] = [];
    for (const key of itemKeys) {
      const item = await this.storage.get(key);
      if (item) {
        console.debug(`Item retrieved for key: ${key}`, item);
        items.push(item);
      } else {
        console.debug(`No item found for key: ${key}`);
      }
    }

    console.debug(`All items retrieved for type: ${type}`, items);
    return items;
  }

  /**
   * Clears the entire database.
   */
  public async clearStorage(): Promise<void> {
    await this.storageInitialized;
    await this.storage.clear();
    console.warn(`Storage cleared.`);
  }
}
