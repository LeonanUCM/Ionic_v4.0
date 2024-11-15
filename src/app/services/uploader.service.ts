import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { Network } from '@capacitor/network';
import { LoadingController } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Injectable class to handle the automatic upload of
 * analyses stored in the local database to the backend.
 */


@Injectable({
  providedIn: 'root',
})
export class UploaderService {
  private badgePendingRequestsSubject: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  public badgePendingRequests$: Observable<number> = this.badgePendingRequestsSubject.asObservable();
  private MAX_RETRIES = 5; // Número máximo de reintentos por upload
  private retryIntervalInSeconds = 300;
  private static isUploadingFlag: boolean = false;


  constructor(
    private storageService: StorageService,
    private userService: UserService, 
    private loadingController: LoadingController
  ) {
    console.log("First attempt to retry pending uploads.")
    this.uploadPreviousAnalyses(true);
    
    // Set up periodic invocation every X seconds
    setInterval(() => {
      console.log(`Invoking uploadPreviousAnalyses by timer.`)
      this.uploadPreviousAnalyses(true);
    }, this.retryIntervalInSeconds * 1000);    
}


  // Método para actualizar el valor del badge
  public updateBadgePendingRequests(newValue: number): void {
    if (this.badgePendingRequestsSubject.value !== newValue) {
      console.log('updateBadgePendingRequests:', newValue);
      this.badgePendingRequestsSubject.next(newValue);
    }
  }

  /**
   * Method responsible for checking if the user is logged in,
   * if there is internet connectivity, and if there are analyses
   * stored in the local database.
   *
   * If conditions are met, it generates an auxiliary structure
   * composed of the pending analyses, which are uploaded one by one:
   * their data to the backend and their images to S3. In case of no errors,
   * they are removed from the local database.
   *
   * @param {boolean} showLoader - Indicates whether to show a loader during the upload.
   */ 

  public async uploadPreviousAnalyses(showLoader: boolean = false) {

    if (UploaderService.isUploadingFlag) {
      console.warn(`performUpload: Upload already in progress. Skipping...`);
      return;
    }

    const { connected } = await Network.getStatus();
    const pendingAnalyses = await this.pendingAnalyses();
    const numberRequests = await this.storageService.numberPendingRequests();
    const userLoggedIn = this.userService.userLoggedIn;

    console.log(`pendingAnalyses=${pendingAnalyses}(${numberRequests}), userLoggedIn=${userLoggedIn}, connected=${connected}`);

    this.updateBadgePendingRequests(numberRequests);

    if (connected && pendingAnalyses) {
      if (userLoggedIn) {
        console.log('User is connected. Trying to upload previous analyses to cloud...');
        await this.userService.refreshToken();

        if (showLoader) {
          this.presentLoader(`${numberRequests} análisis pendientes están siendo enviados.`, 4000);
        }
      
        // Ejecutar performUpload en segundo plano sin esperar a que termine
        this.performUpload().then(() => {
          // Aquí puedes manejar cualquier lógica adicional después de la carga, si es necesario
          console.log('Upload completed in background.');
          if (showLoader)
            this.presentLoader(`Análisis pendientes enviados a la nube.`, 4000, false);
        });
      }
      else {
        console.warn('User is not logged in, but there is Internet, redirecting.');
        await this.userService.logOff();
        return;
      }
    }
    else if (!connected && pendingAnalyses) {
      console.warn('There is no Internet to try to to send pending análisis.');
      return;
    }
  }

  /**
   * Performs the upload of analyses data and images.
   */
  private async performUpload() {

    if (UploaderService.isUploadingFlag) {
      console.warn(`performUpload: Upload already in progress. Skipping...`);
    }
    else {
      console.warn(`setting isUploadingFlag to true.`);
      UploaderService.isUploadingFlag = true; // Set flag to indicate upload is in progress

      console.groupCollapsed("Performing Upload");
      try {
        const keys = await this.storageService.keys();
        const pendingUploads = [];
    
        // Retrieve all elements in DB except user credentials, and initialize retries to current attempts
        for (const key of keys) {
          if (key !== 'login_credentials') {
            console.log('performUpload: Preparing to upload:', key);
            const item = await this.storageService.get(key);
            pendingUploads.push({ key, item, retries: item.retries || 0 });
          }
        }
    
        let numberRequests = pendingUploads.length;
        console.log("Number of pending uploads:", numberRequests);
        this.updateBadgePendingRequests(numberRequests);
    
        // Process the queue
        while (pendingUploads.length > 0) {
          // Check for internet connectivity
          const status = await Network.getStatus();
          if (!status.connected) {
            console.warn('No internet connection. Stopping upload process.');
            // Exit the processing loop; items will be retried in next invocation
            break;
          }
    
          const currentUpload = pendingUploads.shift(); // Get the first item in the queue
    
          console.log(
            `Processing item with key: ${currentUpload.key}, Retry attempt: ${currentUpload.retries + 1}`
          );
    
          let success = true;
    
          // Upload analysis data
          const dataSaved = await this.userService.uploadResultData(currentUpload.item);
          if (!dataSaved) {
            success = false;
          } else {
            // Upload result image to S3
            const resultImageUploaded = await this.userService.uploadImage(currentUpload.item, true);
            if (!resultImageUploaded) {
              success = false;
            } else {
              // Upload original image to S3
              const originalImageUploaded = await this.userService.uploadImage(currentUpload.item, false);
              if (!originalImageUploaded) {
                success = false;
              }
            }
          }
    
          if (success) {
            // Remove the item from storage upon successful upload
            await this.storageService.remove(currentUpload.key);
            numberRequests--;
            this.updateBadgePendingRequests(numberRequests);
            console.log(`Successfully uploaded and removed item with key: ${currentUpload.key}`);
          } else {
            currentUpload.retries++;
            currentUpload.item.retries = currentUpload.retries; // Update retries in the item
    
            if (currentUpload.retries < this.MAX_RETRIES) {
              // Update the item in storage with the new retries count
              await this.storageService.set(currentUpload.key, currentUpload.item);
              console.warn(
                `Failed to upload item with key: ${currentUpload.key}. Will retry in next invocation (${currentUpload.retries}/${this.MAX_RETRIES})`
              );
            } else {
              // Remove the item from storage after exceeding max retries
              await this.storageService.remove(currentUpload.key);
              numberRequests--;
              this.updateBadgePendingRequests(numberRequests);
              console.error(`Failed to upload item with key: ${currentUpload.key} after ${this.MAX_RETRIES} retries. Removing from storage.`);
            }
          }
        }
      } catch (error) {
        console.error('Error during upload:', error.message);
      } finally {
        const numberRequests = await this.storageService.numberPendingRequests();
        console.log('performUpload: pendingUploads=', numberRequests);
        this.updateBadgePendingRequests(numberRequests);
        console.groupEnd();
        console.warn(`setting isUploadingFlag to false.`);
        UploaderService.isUploadingFlag = false; // Set flag to indicate upload is in progress
      }
    }
  }

  

  /**
   * Method responsible for checking if there are elements
   * (analyses) in the local database, excluding user credentials.
   *
   * @returns true if there are analyses in the local database, false otherwise.
   */
  async pendingAnalyses(): Promise<boolean> {
    try {
      const keys = await this.storageService.keys();
      return keys.some(key => key !== 'login_credentials');
    } catch (error) {
      console.error(
        'uploadPreviousAnalyses: An error occurred while checking for analyses to upload: ',
        error
      );
      return false;
    }
  }

  /**
   * Method to show a loader. It blocks indefinitely if timeout is 0,
   * or dismisses automatically after a specified timeout.
   * @param loaderMessage The message to display in the loader.
   * @param timeout Duration in milliseconds before the loader is automatically dismissed. If 0, loader will not auto-dismiss.
   * @returns A promise that resolves when the loader is dismissed.
   */
  async presentLoader(loaderMessage: string, timeout: number, showSpinner: boolean = true): Promise<void> {
    const loading = await this.loadingController.create({
      cssClass: 'custom-loading',
      message: loaderMessage,
      spinner: showSpinner ? 'bubbles' : null,
      duration: (timeout > 0) ? timeout : null,
    });
    console.log(`Presented Loader: ${loaderMessage}`);
    await loading.present();
  }
}
