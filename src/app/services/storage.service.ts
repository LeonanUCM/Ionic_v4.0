import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})

/**
 * Clase inyectable para manejar una base de datos local
 * No-Sql Clave - Valor.
 * 
 * @property {Storage | null} _storage - Instancia de la base de datos.
 */
export class StorageService {
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {
    this.init();
  }

  /**
   * Método encargado de inicializar la BD local.
   */
  async init() {
    const storage = await this.storage.create();
    this._storage = storage;
  }

  /**
   * Método encargado de guardar un elemento en la BD.
   * 
   * @param {string} key - Llave del elemento a almacenar.
   * @param {any} value - Contenido a almacenar.
   */
  public async set(key: string, value: any) {
    await this._storage?.set(key, value);
  }

  /**
   * Método para obtener el contenido de un elemento.
   * 
   * @param {string} key - Llave del elemento a obtener su contenido.
   * @returns Contenido almacenado para la llave dada.
   */
  public async get(key: string) {
    return await this._storage?.get(key);
  }

  /**
   * Método encargado de eliminar un elemento.
   * 
   * @param {string} key -  Llave del elemento a eliminar.
   * @returns Promesa que indica si el valor fue eliminado o no.
   */
  public async remove(key: string) {
    return await this._storage?.remove(key);
  }

  /**
   * Método encargado de vaciar completamente la BD.
   */
  public async clear() {
    await this._storage?.clear();
  }

  /**
   * Método que se encarga de consultar todas las llaves
   * de elementos almacenados en la BD.
   * 
   * @returns Todas las llaves almacenadas en la BD.
   */
  public async keys() {
    return await this._storage?.keys();
  }

  /**
   * Método que se encarga de consultar la cantidad de
   * elementos almacenados en la BD.
   * 
   * @returns Cantidad de elementos almacenados en DB.
   */
  public async length() {
    return await this._storage?.length();
  }
}
