import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { StorageService } from 'src/app/services/storage.service';
import { UserService } from 'src/app/services/user.service';
import { Network } from '@capacitor/network';

/**
 * The LoginPage component handles the logic for the login screen.
 *
 * @property {string} user_email - User's login email.
 * @property {string} user_password - User's login password.
 * @property {boolean} showPassword - Indicates if the password is visible or hidden.
 * @property {boolean} remind_me - Determines if the session should remain active after closing the app.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  public user_email: string = '';
  public user_password: string = '';
  public showPassword: boolean = false;
  public remind_me: boolean = true;

  constructor(
    private userService: UserService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private storageService: StorageService
  ) {}

  /**
   * Lifecycle hook that runs after the page has fully entered and is now the active page.
   * Attempts to automatically log in if credentials are stored and network is available.
   */
  async ionViewDidEnter() {
    try {
      const status = await Network.getStatus();
      if (status.connected) {
        const storedCredentials = await this.storageService.get('login_credentials');
        if (storedCredentials) {
          const credentials = JSON.parse(storedCredentials);
          this.user_email = credentials.email;
          this.user_password = credentials.password;
        }
      } else {
        await this.deactivateOnlineOptions();
      }
    } catch (error) {
      console.error('Error al recuperar credenciales:', error);
    }
  }

  /**
   * Toggles the visibility of the password field.
   */
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  /**
   * Validates the input fields before attempting to log in.
   * Stores credentials if applicable and initiates the login process.
   */
  public async checkValues() {
    let error_message: string = '';
    let error_title: string = 'Error';
    const status = await Network.getStatus();

    if (!status.connected) {
      error_title = 'Sin conexión a Internet';
      error_message =
        'No se detectó conexión a Internet. Puedes seguir usando la app; los datos se subirán automáticamente a la nube más tarde.';
    } else if (!this.user_email) {
      error_message = 'No has ingresado un correo.';
    } else if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(this.user_email)
    ) {
      error_message = 'El correo ingresado no es válido.';
    } else if (!this.user_password) {
      error_message = 'No has ingresado contraseña.';
    } else if (/\s/g.test(this.user_password)) {
      error_message = 'La contraseña ingresada no puede contener espacios en blanco.';
    }

    if (error_message) {
      const alert = await this.alertController.create({
        cssClass: 'custom-alert',
        header: error_title,
        message: error_message,
        buttons: [{ cssClass: 'alert-button-confirm', text: 'Ok' }],
      });
      await alert.present();
    } else {
      if (this.remind_me) {
        this.storeCredentials();
      }
      await this.login();
    }
  }

  /**
   * Initiates the login process by calling the UserService.
   * Handles different login scenarios and navigates accordingly.
   */
  async login() {
    const loading = await this.loadingController.create({
      cssClass: 'custom-loading',
      message: 'Iniciando sesion...',
    });
    await loading.present();

    try {
      const response = await this.userService.login(this.user_email, this.user_password);
      switch (response) {
        case 'first_time_user':
          await this.router.navigate(['/new-password']);
          this.clearFields();
          break;

        case 'already_registered_user':
          console.log('Logged in user:', this.userService.user);
          await this.router.navigate(['/home']);
          this.clearFields();
          break;

        case 'inactive_user':
          const alertInactive = await this.alertController.create({
            cssClass: 'custom-alert',
            header: 'Usuário inactivo',
            message:
              'El status de su usuário es inactivo. No tienes acceso a la aplicación.',
            buttons: [{ cssClass: 'alert-button-confirm', text: 'Ok' }],
          });
          await alertInactive.present();
          break;

        default:
          const alertDefault = await this.alertController.create({
            cssClass: 'custom-alert',
            header: 'No se pudo iniciar sesión',
            message: 'Por favor, revisa tus credenciales e intentalo nuevamente.',
            buttons: [{ cssClass: 'alert-button-confirm', text: 'Ok' }],
          });
          await alertDefault.present();
          break;
      }
    } catch (error) {
      console.error('Login error:', error);
      const alertError = await this.alertController.create({
        cssClass: 'custom-alert',
        header: 'Error',
        message: 'Error inesperado. Por favor, inténtalo nuevamente más tarde.',
        buttons: [{ cssClass: 'alert-button-confirm', text: 'Ok' }],
      });
      await alertError.present();
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Clears the email and password fields.
   */
  clearFields() {
    this.user_email = '';
    this.user_password = '';
  }

  /**
   * Stores user credentials locally under the key "login_credentials".
   */
  storeCredentials() {
    const credentials = JSON.stringify({
      email: this.user_email,
      password: this.user_password,
    });
    this.storageService.set('login_credentials', credentials);
  }

  /**
   * Displays an alert when attempting to log in without an internet connection.
   */
  async deactivateOnlineOptions() {
    const alert = await this.alertController.create({
      cssClass: 'custom-alert',
      header: 'Sin conexión a Internet',
      message:
        'No se detectó conexión a Internet. Puedes seguir usando la app; los datos se subirán automáticamente a la nube más tarde.',
      buttons: [{ cssClass: 'alert-button-confirm', text: 'Ok' }],
    });
    await alert.present();
  }
}
