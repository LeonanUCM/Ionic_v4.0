import { User } from '../models/user';
import { environment } from 'src/environments/environment';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Network } from '@capacitor/network';
import { StorageService } from './storage.service';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

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
    this.initializeSessionData();
    this.requestAllPermissions();
  }


  public async initializeSessionData(): Promise<void> {
    try {
      console.log('Reading session data from StorageService');
      const sessionData = await this.storageService.get(0, 'login_credentials');
  
      if (sessionData) {
        this.user.session_data = sessionData;
        this.userLoggedIn = true;
        console.log('Session data initialized successfully');
      } else {
        console.log('Session data is null. Redirecting to login.');
        this.router.navigate(['/']); // Navegar a la página de inicio de sesión
      }
    } catch (error) {
      console.error('Error reading session data:', error.message);
      this.router.navigate(['/']); // Navegar a la página de inicio de sesión en caso de error
    }
  }
    
  
  /**
   * Attempts to log in a user.
   *
   * @param {string} email - The user's email.
   * @param {string} password - The user's password.
   * @returns A string indicating the result of the login attempt.
   */
  public async logIn(email: string, password: string): Promise<string | null> {
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
          id: 0,
          userId: userData.data.session_data.userId,
          token: userData.data.session_data.token,
          refreshToken: userData.data.session_data.refreshToken,
          status: userData.data.session_data.status,
          expireIn: userData.data.session_data.expireIn,
          userEmail: userData.data.email,
        };
        console.log('User ID:', this.user.session_data.userId);
        console.log(`Token will expire in ${this.getExpirationTimeTokenMinutes().toFixed(2)} minutes.`);
        await this.storageService.save(this.user.session_data, 'login_credentials');

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
        await this.storageService.remove(0, 'login_credentials');
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
   * Refreshes the token of the currently logged-in user.
   *
   * @returns True if the token was refreshed successfully, false otherwise.
   */
  public async refreshToken(): Promise<boolean> {
    console.groupCollapsed("Refresh token.")

    try {
      this.initializeSessionData();
    
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
            id: 0,
            token: resultData.token,
            refreshToken: resultData.refresh_token,
            userId: resultData.user_id,
            status: resultData.status,
            expireIn: resultData.expire_in,
            userEmail: this.user.session_data.userEmail,
          };
          console.log('Token refreshed successfully');
          console.log(`Token will expire in ${this.getExpirationTimeTokenMinutes().toFixed(2)} minutes.`);
          await this.storageService.save(this.user.session_data, 'login_credentials');
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

  public getToken(): string {
    return this.user.session_data.token;
  }


  private getExpirationTimeTokenMinutes() {
    // Calculate expiration time in minutes
    const expireIn = parseInt(this.user.session_data.expireIn, 10);
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const timeUntilExpire = expireIn - currentTime;

    return (timeUntilExpire > 0) ? timeUntilExpire / 60 : 0;
  }  

  /**
   * Solicita todos los permisos necesarios según la plataforma.
   */
  public async requestAllPermissions(): Promise<void> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      console.warn('Solicitando permisos en la web.');
      await this.requestWebPermissions();
    } else {
      console.log('Solicitando permisos en Android/iOS.');
      await this.requestNativePermissions();
    }
  }

  /**
   * Maneja los permisos en la plataforma web.
   */
  private async requestWebPermissions(): Promise<void> {
    // Permiso de ubicación en la web
    if (navigator.geolocation) {
      try {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        console.log('Permiso de geolocalización concedido en la web.');
      } catch (error) {
        console.error('Permiso de geolocalización denegado en la web:', error);
      }
    } else {
      console.error('La geolocalización no es soportada en este navegador.');
    }

    // Permiso de cámara en la web (solo se solicita cuando se usa)
    console.warn('Permiso de cámara en la web: Se solicita en tiempo de uso.');

    // Permiso de almacenamiento en la web (no aplica en la mayoría de los casos)
    console.warn('Permiso de almacenamiento en la web: No aplica.');
  }

  /**
   * Maneja los permisos en plataformas nativas (Android/iOS).
   */
  private async requestNativePermissions(): Promise<void> {
    // Permiso de ubicación
    try {
      const locationPermission = await Geolocation.requestPermissions();
      if (locationPermission.location === 'granted') {
        console.log('Permiso de ubicación en primer plano concedido.');
      } else {
        console.warn('Permiso de ubicación en primer plano denegado.');
      }
    } catch (error) {
      console.error('Error al solicitar permisos de ubicación:', error);
    }

    // Permiso de cámara
    try {
      const cameraPermission = await Camera.requestPermissions();
      if (cameraPermission.camera === 'granted') {
        console.log('Permiso de cámara concedido.');
      } else {
        console.warn('Permiso de cámara denegado.');
      }
    } catch (error) {
      console.error('Error al solicitar permisos de cámara:', error);
    }

    // Permiso de almacenamiento
    try {
      const storagePermission = await Filesystem.requestPermissions();
      if (storagePermission.publicStorage === 'granted') {
        console.log('Permiso de almacenamiento concedido.');
      } else {
        console.warn('Permiso de almacenamiento denegado.');
      }
    } catch (error) {
      console.error('Error al solicitar permisos de almacenamiento:', error);
    }

    // Permiso de Internet (no requiere solicitud explícita)
    console.log('Permiso de Internet: Implícito en Android/iOS.');

    // Permiso de características (hardware de cámara y GPS)
    console.log('Nota: Las características como cámara y GPS son configuradas en el AndroidManifest.');
  }
}
