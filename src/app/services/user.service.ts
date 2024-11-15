import { User } from '../models/user';
import { Session } from '../models/session';
import { environment } from 'src/environments/environment';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Network } from '@capacitor/network';
import { StorageService } from './storage.service';

/**
 * Injectable class that serves as the main controller
 * for the app's endpoints.
 *
 * @property {User} user - The user who has logged into the application.
 * @property {boolean} userLoggedIn - Indicates if the user has already logged into the app (mainly used for offline mode).
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  public user: User = new User();
  public userLoggedIn: boolean = false;
  public getUserName(): string { return this.user.session_data.userEmail; }

  constructor(private router: Router, 
              private storageService: StorageService) {
    this.readSessionData();
  }

  // Método separado para inicializar la sesión de forma asíncrona
  private async readSessionData(): Promise<void> {
    this.user.session_data = await this.getSessionData();

    if (this.user.session_data === null) {
      // Si sessionRead es null, significa que hubo un error en getSessionData
      console.log('Failed to initialize session data');
    }
  } 

  public async getSessionData(): Promise<Session | null> {
    try {
      console.log('Reading session data');
      const sessionData = await this.storageService.get('login_credentials');
      this.user.session_data = sessionData;
      this.userLoggedIn = true;
      return sessionData;
    } catch (error) {
      console.error('Error reading session data:', error.message);
      this.router.navigate(['/']); // Navegar a la página de inicio de sesión en caso de error
      return null;
    }
  }  
  
  /**
   * Attempts to log in a user.
   *
   * @param {string} email - The user's email.
   * @param {string} password - The user's password.
   * @returns A string indicating the result of the login attempt.
   */
  public async login(email: string, password: string): Promise<string | null> {
    const options = {
      url: `${environment.api_url}/auth/sign-in`,
      headers: { 'Content-Type': 'application/json' },
      data: { email, password, admin: false },
    };

    try {
      console.log('Sending login request:', options);
      const response: HttpResponse = await CapacitorHttp.post(options);

      const userData = response.data;
      console.log('Login response:', userData);

      if (userData.code === 200) {
        this.user.name = userData.data.name;
        this.user.last_name = userData.data.last_name;
        this.user.email = userData.data.email;
        this.user.company = userData.data.company;
        this.userLoggedIn = true;

        if (userData.data.session_data.challengeName === 'NEW_PASSWORD_REQUIRED') {
          return 'first_time_user';
        }

        this.user.session_data = {
          userId: userData.data.session_data.userId,
          token: userData.data.session_data.token,
          refreshToken: userData.data.session_data.refreshToken,
          status: userData.data.session_data.status,
          expireIn: userData.data.session_data.expireIn,
          userEmail: userData.data.email,
        };
        console.log('User ID:', this.user.session_data.userId);
        this.logExpirationTimeToken(parseInt(this.user.session_data.expireIn, 10));
        await this.storageService.set('login_credentials', this.user.session_data);

        console.log('Login ok');
        return 'already_registered_user';
      } else if (
        userData.code === 500 &&
        userData.error?.error_code === 'Account is not active'
      ) {
        return 'inactive_user';
      } else {
        console.error('Login failed with code:', userData.code);
        return null;
      }
    } catch (error) {
      console.error('Error in login method:', error.message);
      return null;
    }
  }

  /**
   * Logs off the user from the app.
   */
  public async logOff(): Promise<void> {
    console.log('Logoff');
    const options = {
      url: `${environment.api_url}/auth/logout`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.user.session_data.token,
      },
      data: { refresh_token: this.user.session_data.refreshToken },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      console.log('Response:', response);
      if (response.status >= 200 && response.status <= 401) {
        console.log('Session ended successfully');
        await this.storageService.remove('login_credentials');
        console.log('Session data removed, returning to login page.');
        this.userLoggedIn = false;
        this.router.navigate(['/']);
      } else {
        console.warn('The session could not be ended');
      }
    } catch (error) {
      console.error('Error in logOff method:', error.message);
      // Verificar si el error es un `TypeError` con mensaje "Failed to fetch"
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('Error in conectivity, do nothing.');
      } else {
        this.userLoggedIn = false;
        this.router.navigate(['/']);
      }
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
        Authorization: this.user.session_data.token,
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
        console.warn('Result data could not be saved:', response);
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
        Authorization: this.user.session_data.token,
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



  /**
   * Refreshes the token of the currently logged-in user.
   *
   * @returns True if the token was refreshed successfully, false otherwise.
   */
  public async refreshToken(): Promise<boolean> {
    console.group("Refresh token.")

    try {
      this.readSessionData();
    
      if (this.user.session_data === null || this.user.session_data === undefined) {
        console.log('Cannot refresh token. No session data found. Must login again.');
        this.router.navigate(['/']);
        return false;
      }

      console.log('Read userId:', this.user.session_data.userId);

      const options = {
        url: `${environment.api_url}/auth/refresh-token`,
        headers: {
          'Content-Type': 'application/json',
          user_id: this.user.session_data.userId,
        },
        data: { refresh_token: this.user.session_data.refreshToken },
      };

      console.log('Sending refresh token request:');

      try {
        const response: HttpResponse = await CapacitorHttp.post(options);
        console.log('Token refresh sent');

        if (response.status >= 200 && response.status < 300) {
          const resultData = response.data.data;
          this.user.session_data = {
            token: resultData.token,
            refreshToken: resultData.refresh_token,
            userId: resultData.user_id,
            status: resultData.status,
            expireIn: resultData.expire_in,
            userEmail: this.user.session_data.userEmail,
          };
          console.log('Token refreshed successfully');
          this.logExpirationTimeToken(parseInt(this.user.session_data.expireIn, 10));
          await this.storageService.set('login_credentials', this.user.session_data);
          console.log('Session data saved.');
          return true;
        } else {
          console.warn(`Token could not be refreshed. Status: ${response.status}`);
          return false;
        }
      } catch (error) {
        const status = await Network.getStatus();
        if ( status.connected ) {
            console.error('Error in refreshToken method, redirecting to login page:', error.message);
            // Optionally, you can redirect to login if token refresh fails due to authentication issues
            this.router.navigate(['/']);
        }
        else {
          console.warn('Not connected to the Internet. Continuing offline.');
        }
        return false;
      }
    } finally {
      console.groupEnd();
    }
  }

  private logExpirationTimeToken(expireIn: number) {
    // Calculate expiration time in minutes
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const timeUntilExpire = expireIn - currentTime;

    if (timeUntilExpire > 0) {
      const expireInMinutes = timeUntilExpire / 60;
      console.log(`Token will expire in ${expireInMinutes.toFixed(2)} minutes.`);
    } else {
      console.warn('Token has already expired.');
    }
  }    
}
