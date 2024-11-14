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
  private isUploading: boolean = false; // Flag to check if an upload is in progress
  private intervalId: any; // periodic invocation of uploadPreviousAnalyses


  constructor(
    private storageService: StorageService,
    private userService: UserService, 
    private loadingController: LoadingController
  ) {
    // Set up periodic invocation every X seconds
    const intervalInSeconds = 10;
    this.intervalId = setInterval(() => {
      console.log("uploadPreviousAnalyses: Invoked by timer.")
      this.uploadPreviousAnalyses(true);
    }, intervalInSeconds * 2000);    
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

  async uploadPreviousAnalyses(showLoader: boolean = false) {
    // Return immediately if an upload is already in progress
    if (this.isUploading) {
      console.log(`uploadPreviousAnalyses: skip periodic execution due to running.`);
      return Promise.resolve(); // Optionally, you could throw an error or handle it differently
    }

    this.isUploading = true; // Set flag to indicate upload is in progress

    try {
      await this.processUpload(showLoader); // Execute the upload process
    } finally {
      this.isUploading = false; // Reset flag after completion
    }
  }

  private async processUpload(showLoader: boolean) {
    try {
      const { connected } = await Network.getStatus();
      const pendingAnalyses = await this.pendingAnalyses();
      const numberRequests = await this.storageService.numberPendingRequests();
      const userLoggedIn = this.userService.userLoggedIn;

      console.log(`uploadPreviousAnalyses: pendingAnalyses=${pendingAnalyses}(${numberRequests}), userLoggedIn=${userLoggedIn}, connected=${connected}`);

      this.updateBadgePendingRequests(numberRequests);

      if (connected && pendingAnalyses) {
        if (userLoggedIn) {
          console.log('uploadPreviousAnalyses: User is connected. Trying to upload previous analyses to cloud...');
          await this.userService.refreshToken();

          if (showLoader) {
            this.presentLoader(`${numberRequests} analises pendientes están siendo enviados.`, 4000);
          }
        
          // Ejecutar performUpload en segundo plano sin esperar a que termine
          this.performUpload().then(() => {
            // Aquí puedes manejar cualquier lógica adicional después de la carga, si es necesario
            console.log('Upload completed in background.');
            if (showLoader)
              this.presentLoader(`${numberRequests} analises pendientes enviados a la nube correctamente.`, 4000, false);
          });
        }
        else {
          console.warn('uploadPreviousAnalyses: User is not logged in, but there is Internet, redirecting.');
          await this.userService.logOff();
          return;
        }
      }
      else if (!connected && pendingAnalyses) {
        console.warn('uploadPreviousAnalyses: There is no Internet to try to to send pending analises.');
        return;
      }
    } catch (error) {
      console.error('uploadPreviousAnalyses: Error while trying to upload previous analyses to cloud: ', error.message);
    }
  }

  /**
   * Performs the upload of analyses data and images.
   */
  private async performUpload() {
    try {
      const keys = await this.storageService.keys();
      const pendingUploads = [];
      const keysToDelete = [];

      // Retrieve all elements in DB except user credentials
      for (const key of keys) {
        if (key !== 'login_credentials') {
          console.log('uploadPreviousAnalyses: Preparing to upload: ', key);
          const item = await this.storageService.get(key);
          pendingUploads.push(item);
          keysToDelete.push(key);
        }
      }

      let errorsOccurred = false;
      let numberRequests = pendingUploads.length;

      // Iterate over the list of analyses to upload
      for (const element of pendingUploads) {
        console.log('uploadPreviousAnalyses: pendingUploads=', numberRequests);
        this.updateBadgePendingRequests(numberRequests);

          // Upload analysis data
        const dataSaved = await this.userService.saveResultData(element);
        if (!dataSaved) {
          // Stop immediately if there was an error
          errorsOccurred = true;
          break;
        }

        // Upload result image to S3
        const resultImageUploaded = await this.userService.uploadImage(element, true);
        if (!resultImageUploaded) {
          errorsOccurred = true;
          break;
        }

        // Upload original image to S3
        const originalImageUploaded = await this.userService.uploadImage(element, false);
        if (!originalImageUploaded) {
          errorsOccurred = true;
          break;
        }

        numberRequests--;
      }

      // If there were no errors, delete the uploaded elements from the DB
      if (!errorsOccurred) {
        for (const key of keysToDelete) {
          await this.storageService.remove(key);
        }
      } else {
        console.warn(
          'uploadPreviousAnalyses: An error occurred while uploading the results, and the operation was aborted'
        );
        // Delete the elements to upload to avoid inconsistencies
        for (const key of keysToDelete) {
          await this.storageService.remove(key);
        }
      }
    } catch (error) {
      console.error('Error during upload: ', error);
    }
    finally {
      const numberRequests = await this.storageService.numberPendingRequests();
      console.log('uploadPreviousAnalyses: pendingUploads=', numberRequests);
      this.updateBadgePendingRequests(numberRequests);
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
    await loading.present();
  }
}
