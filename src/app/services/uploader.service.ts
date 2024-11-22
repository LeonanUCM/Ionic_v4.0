import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { Network } from '@capacitor/network';
import { LoadingController, ToastController } from '@ionic/angular';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ResultData } from '../models/resultData';
//import { log } from '@tensorflow/tfjs-core/dist/log';

interface UploadRequest {
  id: number;
  data: ResultData; // Reemplaza con el tipo de dato real de tus requests
  status: 'pending' | 'in-progress' | 'completed' | 'awaiting-retry';
  retries: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class UploaderService {
  private requestQueue: UploadRequest[] = [];
  private MAX_RETRIES: number = 720; //reintenta por 24 horas de conexión
  private RETRY_EVERY_X_ROUNDS: number = 3; //solo reintenta a cada 10 minutos (1 de cada 10 veces)
  private RETRY_INTERVAL_SECONDS: number = 20;  //verifica cola a cada minuto
  private lastId: number = 0;

  private badgePendingRequestsSubject: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  public badgePendingRequests$: Observable<number> = this.badgePendingRequestsSubject.asObservable();

  constructor(
    private storageService: StorageService,
    private userService: UserService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    console.log("UploaderService instance created");
    this.initializeQueue();
    this.setupTimer();
  }

  /**
   * [P1] Inicializa la cola cargando los requests pendientes del storage.
   */
  private async initializeQueue(): Promise<void> {
    try {
      const storedRequests: UploadRequest[] = await this.storageService.getAll('results');
      this.requestQueue = storedRequests
        .filter((req) => req.status === 'pending' )
        .sort((a, b) => a.id - b.id); // Ordenar por ID
      this.updateBadgePendingRequests(this.requestQueue.length);
      this.lastId = this.requestQueue.length > 0 ? this.requestQueue[this.requestQueue.length - 1].id : 0;
      console.log(`Initialized queue with ${this.requestQueue.length} pending requests, lastId=${this.lastId}.`);
    } catch (error) {
      console.error('Error initializing upload queue:', error);
    }
  }

  private hasRequestId(id: string): boolean {
    return this.requestQueue.some((req) => req.data.result_UUID === id);
  }

  /**
   * [P2] Guarda un nuevo request y lo encola para su envío.
   * @param requestData Los datos del nuevo request.
   */
  public async enqueueNewRequest(requestData: any): Promise<void> {
    console.warn(`Enqueuing new request: result_UUID ${requestData.result_UUID}.`);
    if ( this.hasRequestId(requestData.result_UUID)) {
      console.warn(`Enqueuing new request: Already existing id. Aborting.`);
    }
    else {
      try {
        const newRequest: UploadRequest = {
          id: this.generateUniqueId(),
          data: requestData,
          status: 'pending',
          retries: 0,
          timestamp: Date.now(),
        };

        await this.storageService.save(newRequest, 'results');
        this.requestQueue.push(newRequest);
        this.updateBadgePendingRequests(this.requestQueue.length);
        console.log(`Enqueued new request with ID: ${newRequest.id}`);

        await this.uploadPendingRequests('new');
      } catch (error) {
        console.error('Error enqueuing new request:', error);
      }
    }
  }

  /**
   * [P3] Configura el temporizador para enviar requests periódicamente.
   */
  private setupTimer(): void {
    setInterval(() => {
      console.log('Timer triggered: Invoking uploadPendingRequests for all pending requests.');
      this.uploadPendingRequests('timer');
    }, this.RETRY_INTERVAL_SECONDS * 1000);
  }

  /**
   * [P3] Función de envío común para manejar requests desde el botón y el temporizador.
   * @param source 'new' para solicitudes desde el botón, 'timer' para solicitudes desde el temporizador.
   */
  public async uploadPendingRequests(source: 'new' | 'timer'): Promise<void> {
    let requestsToProcess: UploadRequest[] = [];

    const { connected } = await Network.getStatus();

    if  ( !connected ) {
      console.log('---No internet connection. Skipping upload.');
    } else {
      console.log('---Found internet. Making sure user is able to send requests.');
      if ( ! await this.userService.refreshToken() ) {
        console.error('---User not able to send requests. Refresh Token Error. Aborting.');
        return;
      } else {
        if (source === 'new') {
          console.log('---Trying to send new request...');
          // Obtener solo el request más nuevo
          const latestRequest = this.getLatestRequest();
          if (latestRequest) {
            requestsToProcess.push(latestRequest);
          }
        } else if (source === 'timer') {
          // Obtener todos los requests pendientes
          requestsToProcess = [...this.requestQueue];
        }

        if (requestsToProcess.length === 0) {
          console.log('No requests to process.');
          return;
        }


        let successCount = 0;
        let failureCount = 0;
        let alreadyNotified = false;

        for (const request of requestsToProcess) {
          console.log(`---Request ID: ${request.id} with retries: ${request.retries}  status: ${request.status}`);
          // Verificar si es el turno de reintentar
          if (request.retries % this.RETRY_EVERY_X_ROUNDS !== 0) {
            console.log(`---Skipping request ID: ${request.id}`);
            console.warn(`---Not my turn. Retrying after ${this.RETRY_EVERY_X_ROUNDS - (request.retries % this.RETRY_EVERY_X_ROUNDS)} timers.`);
            request.status = 'awaiting-retry';
            request.retries += 1;
            continue;
          }

          if (request.status === 'in-progress') {
            console.warn(`---Skipping request ID already in progress: ${request.id}`);
            continue;
          }

          if (source === 'timer' && !alreadyNotified) {
            console.log('---Trying to send old requests (timer)...');
            await this.notifyUserStart();
            alreadyNotified = true;
          }

            // Marcar como en proceso
          request.status = 'in-progress';
          await this.storageService.update(request, "results");
          console.warn(`---Processing request ID: ${request.id}    request.retries: ${request.retries}`);
        
          try {
            // Realizar las tres llamadas a la API
            await this.performApiCalls(request.data);
            // Si todo salió bien, marcar como completado y eliminar del storage y la cola
            request.status = 'completed';
            await this.storageService.remove(request.id, "results");
            this.removeFromQueue(request.id);
            successCount++;
            console.warn(`---Successfully uploaded request ID: ${request.id}`);
          } catch (error) {
            console.error(`---Error uploading request ID: ${request.id}:`, error);
            // Manejar reintentos
            const { connected } = await Network.getStatus();

            if  ( connected ) {
              request.retries += 1;
              console.log(`---Request.retries incremented to: ${request.retries}`);

              if (request.retries >= this.MAX_RETRIES) {
                // [R7] Excedió el número de reintentos, eliminar y logar error
                await this.storageService.remove(request.id, "results");
                this.removeFromQueue(request.id);
                failureCount++;
                console.error(`---Request ID: ${request.id} failed after ${this.MAX_RETRIES} retries. Removing from queue.`);
              } else {
                // Actualizar en storage con el nuevo contador de reintentos
                request.status = 'pending';
                await this.storageService.update(request, "results");
                console.warn(`---Request ID: ${request.id} failed. Retry attempt ${request.retries}/${this.MAX_RETRIES}.`);
              }
            } else {
              console.warn(`---No connected. Retrying after ${this.RETRY_EVERY_X_ROUNDS - (request.retries % this.RETRY_EVERY_X_ROUNDS)} timers.`);
            }
          }
        }

        if (source === 'timer')
          await this.notifyUserEnd(successCount, failureCount);
      }
    }
  }

  /**
   * [P4] Realiza las tres llamadas a la API para un request.
   * @param data Los datos del request.
   */
  private async performApiCalls(data: any): Promise<void> {
    try {
      // Intentar subir la imagen de resultados
      if (!await this.uploadResultImage(data)) {
        throw new Error('Failed to perform API calls to upload result image');
      }
    
      // Intentar subir la imagen original
      if (!await this.uploadOriginalImage(data)) {
        throw new Error('Failed to perform API calls to upload original image');
      }
    
      // Intentar subir los datos de resultados
      if (!await this.uploadResultData(data)) {
        throw new Error('Failed to perform API calls to upload result data');
      }
    
      console.log('All API calls were successful');
    } catch (error) {
      console.error(error.message);
      throw new Error('Failed to perform API calls');
    }
  }

  /**
   * [P5] Obtiene el request más nuevo de la cola.
   */
  private getLatestRequest(): UploadRequest | undefined {
    if (this.requestQueue.length === 0) return undefined;
    return this.requestQueue.reduce((latest, request) => {
      return request.id > latest.id ? request : latest;
    }, this.requestQueue[0]);
  }
  

  /**
   * [P5] Elimina un request de la cola en memoria.
   * @param id ID del request a eliminar.
   */
  private removeFromQueue(id: number): void {
    console.log("Removing from queue.")
    this.requestQueue = this.requestQueue.filter(req => req.id !== id);
    this.updateBadgePendingRequests(this.requestQueue.length);
  }

  /**
   * [P7] Genera un ID único para cada request.
   */
  private generateUniqueId(): number {
    return this.lastId++;
  }

  /**
   * [P6] Actualiza el contador de solicitudes pendientes para el badge.
   * @param count Número de solicitudes pendientes.
   */
  private updateBadgePendingRequests(count: number): void {
    this.badgePendingRequestsSubject.next(count);
  }

  /**
   * [P5] Notifica al usuario al iniciar el envío desde el temporizador.
   */
  private async notifyUserStart(): Promise<void> {
    try {
      const pendingCount = this.requestQueue.length;
      if (pendingCount === 0) return;

      const alert = await this.toastController.create({
        message: `Iniciando envío a la nube de análisis pendientes.`,
        duration: 2000,
        position: 'top',
        cssClass: 'custom-toast',
      });
      await alert.present();
    } catch (error) {
      console.error('Error notifying user start:', error);
    }
  }

  /**
   * [P5] Notifica al usuario al finalizar el envío desde el temporizador.
   * @param success Cuántas solicitudes se enviaron con éxito.
   * @param failure Cuántas solicitudes fallaron.
   */
  private async notifyUserEnd(success: number, failure: number): Promise<void> {
    try {
      const total = success + failure;
      if (total === 0) return;

      const message = `Envío de análisis a la nube completado.`
      console.log(`${failure} requests failled.`);

      const alert = await this.toastController.create({
        message: message,
        duration: 2000,
        position: 'top',
        cssClass: 'custom-toast',
      });
      await alert.present();
    } catch (error) {
      console.error('Error notifying user end:', error);
    }
  }


  /**
     * Uploads analysis data to the backend.
     *
     * @param {any} resultData - JSON containing all the data of an analysis.
     * @returns True if the analysis data was saved successfully, false otherwise.
     */
  public async uploadResultData(resultData: any): Promise<boolean> {
    const options = {
      url: `${environment.api_url}/photo/data`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.userService.getToken(),
      },
      data: [
        {
          fruit: resultData.fruit,
          location: resultData.location,
          image_date: resultData.image_date,
          weight: resultData.weight,
          quantities: resultData.quantities,
          pre_value: resultData.pre_value,
          type: resultData.photo_type,
          small_fruits: resultData.small_fruits,
          medium_fruits: resultData.medium_fruits,
          big_fruits: resultData.big_fruits,
          original_url: resultData.url_original_image,
          url: resultData.url_result_image,
          corrected_quantities: resultData.corrected_fruit_total_quantity,
          corrected_big_fruits: resultData.corrected_fruit_big_quantity,
          corrected_medium_fruits: resultData.corrected_fruit_medium_quantity,
          corrected_small_fruits: resultData.corrected_fruit_small_quantity,
          mode: resultData.mode
        },
      ],
    };

    try {
      console.log(`Sending data request:`, resultData.result_UUID);
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log('Result data saved successfully');
        return true;
      } else {
        console.log('Result data could not be saved:', response);
        return false;
      }
    } catch (error) {
      console.error('Error in uploadResultData method:', error.message);
      return false;
    }
  }

  /**
   * Uploads the result or original image of an analysis to S3.
   *
   * @param {any} resultData - JSON containing all the data of an analysis.
   * @param {boolean} isResultImage - Indicates if the image to be uploaded is the original (false) or the result image (true).
   * @returns True if the image was uploaded successfully, false otherwise.
   */
  public async uploadImage(resultData: any, isResultImage: boolean): Promise<boolean> {
    const imageType = isResultImage ? 'result' : 'original';
    console.log(`uploadImage: Uploading ${imageType} image`);

    const options = {
      url: `${environment.api_url}/photo`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.userService.getToken(),
      },
      data: {
        name: `${resultData.result_UUID}-${imageType}`,
        file: isResultImage ? resultData.result_image : resultData.original_image,
        result: isResultImage,
      },
    };

    try {
      console.log(`uploadImage: Sending ${imageType} image upload request:`, options.data.name);
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log(`uploadImage: ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image uploaded successfully`);
        return true;
      } else {
        console.warn(`uploadImage: ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image could not be uploaded`);
      }
    } catch (error) {
      console.error('uploadImage: Error in request on uploadImage method :', error.message);
    }
    return false;
  }

  public async uploadResultImage(resultData: any): Promise<boolean> {
    return await this.uploadImage(resultData, true);
  }

  public async uploadOriginalImage(resultData: any): Promise<boolean> {
    return await this.uploadImage(resultData, false);
  }

}
