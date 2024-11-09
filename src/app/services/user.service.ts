import { User } from '../models/user';
import { environment } from 'src/environments/environment';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Injectable } from '@angular/core';

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

  constructor() {}

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
        };
        console.log('User ID:', this.user.session_data.userId);
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
      console.error('Error in login method:', error);
      return null;
    }
  }

  /**
   * Logs off the user from the app.
   */
  public async logOff(): Promise<void> {
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
      if (response.status >= 200 && response.status < 300) {
        console.log('Session ended successfully');
      } else {
        console.warn('The session could not be ended');
      }
      this.userLoggedIn = false;
    } catch (error) {
      console.error('Error in logOff method:', error);
    }
  }

  /**
   * Changes the password for the currently logged-in user.
   * Used when the user logs in for the first time with a temporary password.
   *
   * @param {string} newPassword - The new password for the user.
   * @returns True if the password was changed successfully, false otherwise.
   */
  public async setPassword(newPassword: string): Promise<boolean> {
    const options = {
      url: `${environment.api_url}/auth/set-user-password`,
      headers: { 'Content-Type': 'application/json' },
      data: { email: this.user.email, password: newPassword },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log('Password changed successfully');
        return true;
      } else {
        console.warn('Password could not be changed');
        return false;
      }
    } catch (error) {
      console.error('Error in setPassword method:', error);
      return false;
    }
  }

  /**
   * Sends a recovery email with a validation code before changing a user's password.
   *
   * @param {string} userEmail - The user's email.
   * @returns True if the recovery email was sent successfully, false otherwise.
   */
  public async recoverPassword(userEmail: string): Promise<boolean> {
    const options = {
      url: `${environment.api_url}/auth/recover-password`,
      headers: { 'Content-Type': 'application/json' },
      data: { email: userEmail },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log('Recovery email sent successfully');
        this.user.email = userEmail;
        return true;
      } else {
        console.warn('Recovery email could not be sent');
        return false;
      }
    } catch (error) {
      console.error('Error in recoverPassword method:', error);
      return false;
    }
  }

  /**
   * Changes the password for the user who received the recovery email.
   *
   * @param {string} newPassword - The new password for the user.
   * @param {string} confirmationCode - The confirmation code from the recovery email.
   * @returns True if the password was reset successfully, false otherwise.
   */
  public async resetPassword(newPassword: string, confirmationCode: string): Promise<boolean> {
    const options = {
      url: `${environment.api_url}/auth/reset-password`,
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: this.user.email,
        new_password: newPassword,
        confirmation_code: confirmationCode,
      },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log('Password reset successfully');
        return true;
      } else {
        console.warn('Password could not be reset');
        return false;
      }
    } catch (error) {
      console.error('Error in resetPassword method:', error);
      return false;
    }
  }

  /**
   * Uploads analysis data to the backend.
   *
   * @param {any} resultData - JSON containing all the data of an analysis.
   * @returns True if the analysis data was saved successfully, false otherwise.
   */
  public async saveResultData(resultData: any): Promise<boolean> {
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
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log('Result data saved successfully');
        return true;
      } else {
        console.warn('Result data could not be saved:', response);
        return false;
      }
    } catch (error) {
      console.error('Error in saveResultData method:', error);
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
    console.log(`Uploading ${imageType} image`);

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
      console.log('Sending image upload request:', options.data.name);
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log(`${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image uploaded successfully`);
        return true;
      } else {
        console.warn(`${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image could not be uploaded`);
        return false;
      }
    } catch (error) {
      console.error('Error in uploadImage method:', error);
      return false;
    }
  }

  /**
   * Sends an error report email with any issue encountered by the user in the app.
   *
   * @param {string} errorType - The type of error encountered.
   * @param {string} errorDescription - A description of the error encountered.
   * @returns True if the error report email was sent successfully, false otherwise.
   */
  public async uploadErrorReport(errorType: string, errorDescription?: string): Promise<boolean> {
    const requestData: any = {
      problem: errorType,
      ...(errorDescription && { description: errorDescription }),
    };

    const options = {
      url: `${environment.api_url}/system/report-problem`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.user.session_data.token,
      },
      data: requestData,
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status < 300) {
        console.log('Error report email sent successfully');
        return true;
      } else {
        console.warn('Error report email could not be sent');
        return false;
      }
    } catch (error) {
      console.error('Error in uploadErrorReport method:', error);
      return false;
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Refreshes the token of the currently logged-in user.
   *
   * @returns True if the token was refreshed successfully, false otherwise.
   */
  public async refreshToken(): Promise<boolean> {
    const options = {
      url: `${environment.api_url}/auth/refresh-token`,
      headers: {
        'Content-Type': 'application/json',
        user_id: this.user.session_data.userId,
      },
      data: { refresh_token: this.user.session_data.refreshToken },
    };
  
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response: HttpResponse = await CapacitorHttp.post(options);
        if (response.status >= 200 && response.status <= 400) {
          const resultData = response.data.data;
          this.user.session_data = {
            token: resultData.token,
            refreshToken: resultData.refresh_token,
            userId: resultData.user_id,
            status: resultData.status,
            expireIn: resultData.expire_in,
          };
          console.log('Token refreshed successfully');
          return true;
        } else {
          console.warn('Token could not be refreshed');
          return false;
        }
      } catch (error) {
        console.error(`Error in refreshToken method (Attempt ${attempt}):`, error);
        if (attempt < 2) {
          console.log('Retrying refreshToken in 2 seconds...');
          await this.delay(2000); // Wait 2 seconds before retrying
        } else {
          console.error('Failed to refresh token after 2 attempts');
          return false;
        }
      }
    }
  
    return false;
  }
  
}
