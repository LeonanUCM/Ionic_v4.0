import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { Network } from '@capacitor/network';
import { LoadingController } from '@ionic/angular';

/**
 * Injectable class to handle the automatic upload of
 * analyses stored in the local database to the backend.
 */
@Injectable({
  providedIn: 'root',
})
export class UploaderService {
  constructor(
    private storageService: StorageService,
    private userService: UserService, 
    private loadingController: LoadingController
  ) {}

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
   * @param {string} loaderMessage - The message to be displayed in the loader (if applicable).
   * @param {boolean} showLoader - Indicates whether to show a loader during the upload.
   */
  async uploadPreviousAnalyses(loaderMessage: string, showLoader: boolean = false) {
    try {
      // Refresh token
      await this.userService.refreshToken();

      const { connected } = await Network.getStatus();
      const pendingAnalyses = await this.pendingAnalyses();

      console.log('pendingAnalyses=', pendingAnalyses);
      console.log('userLoggedIn=', this.userService.userLoggedIn);
      console.log('connected=', connected);

      if (connected && this.userService.userLoggedIn && pendingAnalyses) {
        console.log('Trying to upload preivous analisys to cloud...');

        let loading;
        if ( showLoader) {
          loading = await this.loadingController.create({
            cssClass: 'custom-loading',
            message: loaderMessage,
          });
          await loading.present();
        }

        // Start upload without blocking the UI
        this.performUpload().finally(() => {
          if (showLoader && loading) {
            loading.dismiss();
          }
        });
      }
    } catch (error) {
      console.error('Error while trying to upload preivous analisys to cloud: ', error);
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
          console.log('Preparing to upload: ', key);
          const item = await this.storageService.get(key);
          pendingUploads.push(item);
          keysToDelete.push(key);
        }
      }

      let errorsOccurred = false;

      // Iterate over the list of analyses to upload
      for (const element of pendingUploads) {
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
      }

      // If there were no errors, delete the uploaded elements from the DB
      if (!errorsOccurred) {
        for (const key of keysToDelete) {
          await this.storageService.remove(key);
        }
      } else {
        console.log(
          'An error occurred while uploading the results, and the operation was aborted'
        );
        // Delete the elements to upload to avoid inconsistencies
        for (const key of keysToDelete) {
          await this.storageService.remove(key);
        }
      }
    } catch (error) {
      console.error('Error during upload: ', error);
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
        'An error occurred while checking for analyses to upload: ',
        error
      );
      return false;
    }
  }
}
