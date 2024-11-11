import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})

/**
 * Injectable class to manage a local NoSQL Key-Value database.
 *
 * @property {Storage | null} _storage - Instance of the database.
 */
export class StorageService {
  private _storage: Storage | null = null;
  private storageReady: Promise<void>;

  constructor(private storage: Storage) {
    this.storageReady = this.init();
  }

  /**
   * Initializes the local database.
   */
  private async init(): Promise<void> {
    this._storage = await this.storage.create();
  }

  /**
   * Saves an item in the database.
   *
   * @param {string} key - Key of the item to store.
   * @param {any} value - Content to store.
   */
  public async set(key: string, value: any): Promise<void> {
    await this.storageReady;
    await this._storage?.set(key, value);
  }

  /**
   * Retrieves the content of an item.
   *
   * @param {string} key - Key of the item to retrieve.
   * @returns The content stored for the given key.
   */
  public async get(key: string): Promise<any> {
    await this.storageReady;
    return await this._storage?.get(key);
  }

  /**
   * Removes an item from the database.
   *
   * @param {string} key - Key of the item to remove.
   */
  public async remove(key: string): Promise<void> {
    await this.storageReady;
    await this._storage?.remove(key);
  }

  /**
   * Clears the entire database.
   */
  public async clear(): Promise<void> {
    await this.storageReady;
    await this._storage?.clear();
  }

  /**
   * Retrieves all the keys of items stored in the database.
   *
   * @returns An array of all keys stored in the database.
   */
  public async keys(): Promise<string[]> {
    await this.storageReady;
    return await this._storage?.keys() || [];
  }

  /**
   * Retrieves the number of items stored in the database.
   *
   * @returns The number of items stored in the database.
   */
  public async length(): Promise<number> {
    await this.storageReady;
    return await this._storage?.length() || 0;
  }

  /**
   * Retrieves the number of pending items stored in the database,
   * excluding items with the key 'login_credentials'.
   *
   * @returns The number of pending items in the database.
   */
  public async numberPendingRequests(): Promise<number> {
    await this.storageReady;

    // Obtén todas las claves almacenadas
    const keys = await this._storage?.keys() || [];

    // Filtra las claves que no son 'login_credentials' y cuenta el resultado
    const pendingKeys = keys.filter(key => key !== 'login_credentials');
    return pendingKeys.length;
  }

}