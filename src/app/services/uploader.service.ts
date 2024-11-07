import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { Network } from '@capacitor/network';
import { LoadingController } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})

/**
 * Clase inyectable para manejar la subida automática de
 * análisis almacenados en la BD local al backend.
 */
export class UploaderService {
  constructor(
    private storageService: StorageService,
    private userService: UserService,
    private loadingController: LoadingController
  ) {}

  /**
   * Método que se encarga de revisar si el usuario está
   * conectado, si hay internet y si hay análisis almacenados
   * en la BD local.
   *
   * Sí se cumple, se genera una estructura auxiliar compuesta
   * de los análisis pendientes, los cuales se suben uno a uno
   * su data a backend y sus imagenes a S3, y en caso de no haber
   * fallos, se eliminan de la BD local.
   *
   * @param {string} loaderMessage - Indica el mensaje que debe mostrarse en el loader. (si aplica)
   * @param {boolean} showLoader - Indica si debe mostrarse o no un loader de la subida. (Por si se quiere usar este método en segundo plano)
   */
  async UploadPreviousAnalyses(
    loaderMessage: string,
    showLoader: boolean = true
  ) {
    // Refrescar token
    await this.userService.refreshToken();

    const status = await Network.getStatus();
    let pending_analyses: boolean;

    await this.pendingAnalyses().then((value) => {
      pending_analyses = value;
    });

    console.log('Hay análisis pendientes?: ', pending_analyses);
    console.log('Usuario conectado?: ', this.userService.user_log_in);
    console.log('Hay internet?: ', status.connected);

    if (status.connected && this.userService.user_log_in && pending_analyses) {
      console.log('Iniciando carga de analisis previos..');

      const loading = await this.loadingController.create({
        cssClass: 'custom-loading',
        message: loaderMessage,
      });
      if (showLoader) loading.present();

      try {
        const result = await this.storageService.keys();
        let pending_uploads = [];
        let hubo_errores: boolean = false;
        let keysToDelete = [];

        // Consultar todos los elementos en DB menos las credenciales de usuario
        for (const element of result) {
          if (element !== 'login_credentials') {
            console.log('A guardar: ', element);
            pending_uploads.push(await this.storageService.get(element));
            keysToDelete.push(element);
          }
        }

        // Recorrer la lista auxiliar con los análisis por subir
        for (let index = 0; index < pending_uploads.length; index++) {
          const element = pending_uploads[index];
          //console.log("pending upload elements", element);

          // Subir datos de análisis
          if (!(await this.userService.saveResultData(element))) {
            // Detener inmediatamente si hubo error
            hubo_errores = true;
            break;
          }

          // Subir imagen resultado a S3
          if (!(await this.userService.uploadImage(element, true))) {
            hubo_errores = true;
            break;
          }

          // Subir imagen original a S3
          if (!(await this.userService.uploadImage(element, false))) {
            hubo_errores = true;
            break;
          }
        }

        // Si no hubo errores, se eliminan los elementos subidos de la BD
        if (!hubo_errores) {
          for (const element of keysToDelete) {
            await this.storageService.remove(element + '');
          }
        } else {
          console.log(
            'Ocurrio algun error al subir todos los resultados y se aborto la operación'
          );
          // Temporalmente la mejor forma de recuperarse de una falla de subida es elimando
          // los elementos a subir, ya que uno de ello puede tener un body invalido
          for (const element of keysToDelete) {
            await this.storageService.remove(element + '');
          }
        }
      } catch (error) {
        console.error('Error subiendo previos análisis: ' + error);
      } finally {
        if (showLoader) loading.dismiss();
      }
    }
  }

  /**
   * Método que se encarga de revisar si existen elementos
   * (análisis) en la BD local, no se incluyen las credenciales
   * del usuario.
   *
   * @returns true si hay análisis en la BD local, false de lo contrario.
   */
  async pendingAnalyses(): Promise<boolean> {
    try {
      const result = await this.storageService.keys();

      for (const element of result) {
        if (element !== 'login_credentials') {
          return true;
        }
      }

      console.log('No hay análisis para subir');
      return false;
    } catch (error) {
      console.log(
        'Ocurrió un error al revisar si existían análisis para subir: ',
        error
      );
      return false;
    }
  }
}
