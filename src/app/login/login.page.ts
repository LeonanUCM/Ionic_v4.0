import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { StorageService } from 'src/app/services/storage.service';
import { UserService } from 'src/app/services/user.service';
import { Network } from '@capacitor/network';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})

/**
 * Lógica de la pantalla de Login.
 *
 * @property {string} user_email - Email de inicio de sesión.
 * @property {string} user_password - Contraseña de inicio de sesión.
 * @property {boolean} showPassword - Indica si la contraseña está oculta o visible.
 * @property {any} remind_me - Indica si se mantendra la sesión iniciada al cerrar la app.
 */
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
   * Método que se ejecuta después de cargar la página,
   * intenta iniciar sesión automáticamente.
   */
  async ionViewDidEnter() {
    const status = await Network.getStatus();
    const result = this.storageService.get('login_credentials');

    if (status.connected) {
      result
        .then((value) => {
          if (value) {
            const credentials = JSON.parse(value);
            this.user_email = credentials.email;
            this.user_password = credentials.password;
            this.login();
          }
        })
        .catch((error) => {
          console.error('Error al recuperar credenciales: ' + error);
        });
    } else {
      this.deactivateOnlineOptions();
    }
  }

  /**
   * Método que cambia la visibilidad de contraseña
   * entre visible y no visible.
   */
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  /**
   * Método que se encarga de hacer las revisiones pertinentes
   * antes de iniciar sesión. Si no hay inconvenientes, guarda las
   * credenciales en la BD local (si aplica) y luego invoca el método login.
   */
  public async checkValues() {
    let error_message: string = '';
    let error_title: string = 'Errores detectados';
    const status = await Network.getStatus();

    // Verificar que tenga internet
    if (!status.connected) {
      error_title = 'No hay conexión';
      error_message =
        'Parece que no tienes conexion a internet, puedes ingresar usando el modo desconectado.';
    }

    // Verificar que se haya ingresado un correo
    else if (this.user_email === undefined || this.user_email === '') {
      error_message = 'No has ingresado un correo.';
    }

    // Verificar que el correo sea válido
    else if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(this.user_email)
    ) {
      error_message = 'El correo ingresado no es válido.';
    }

    // Verificar que se haya ingresado una contraseña
    else if (this.user_password === undefined || this.user_password === '') {
      error_message = 'No has ingresado contraseña.';
    }

    // Verificar que la contraseña no contenga espacios en blanco
    else if (/\s/g.test(this.user_password)) {
      error_message = 'La contraseña ingresada contiene espacios en blanco.';
    }

    // Mostrar algun error si aplica
    if (error_message.length > 1) {
      const alert = await this.alertController.create({
        cssClass: 'custom-alert',
        header: error_title,
        message: error_message,
        buttons: [
          {
            cssClass: 'alert-button-confirm',
            text: 'Ok',
          },
        ],
      });

      await alert.present();
    } else {
      // Guardar credenciales
      if (this.remind_me) this.storageCredentials();

      // Intentar iniciar sesion
      this.login();
    }
  }

  /**
   * Método encargado de invocar el método de login de UserService.
   * Se determina que tipo de ingreso es, y en caso de no haber inconvenientes
   * carga la pantalla home.
   */
  async login() {
    const loading = await this.loadingController.create({
      cssClass: 'custom-loading',
      message: 'Iniciando sesion',
    });
    loading.present();
    const response = await this.userService.login(
      this.user_email,
      this.user_password
    );
    loading.dismiss();

    if (response) {
      switch (response) {
        case 'first_time_user':
          this.router.navigate(['/new-password']);
          this.cleanFields();
          break;

        case 'already_registered_user':
          console.log('Usuario que inicio sesion: ', this.userService.user);
          this.router.navigate(['/home']);
          this.cleanFields();
          break;

        case 'inactive_user':
          const alert = await this.alertController.create({
            cssClass: 'custom-alert',
            header: 'No puedes iniciar sesión',
            message:
              'Tú estatus actual es inactivo. No tienes acceso a la aplicación.',
            buttons: [
              {
                cssClass: 'alert-button-confirm',
                text: 'Ok',
              },
            ],
          });

          await alert.present();
          break;

        default:
          break;
      }
    } else {
      const alert = await this.alertController.create({
        cssClass: 'custom-alert',
        header: 'No se pudo iniciar sesión',
        message: 'Por favor, revisa tus credenciales e intentalo nuevamente',
        buttons: [
          {
            cssClass: 'alert-button-confirm',
            text: 'Ok',
          },
        ],
      });

      await alert.present();
    }
  }

  /**
   * Método encargado de limpiar los campos de credenciales
   * de inicio de sesión.
   */
  cleanFields() {
    this.user_email = "";
    this.user_password = "";
  }

  /**
   * Método encargado de almacenar en la BD local
   * las credenciales de inicio de sesión del usuario
   * con la llave "login_credentials".
   */
  storageCredentials() {
    this.storageService.set(
      'login_credentials',
      JSON.stringify({ email: this.user_email, password: this.user_password })
    );
  }

  /**
   * Método que muestra alerta en caso de intentar
   * iniciar sesión y no tener conexion a internet.
   */
  async deactivateOnlineOptions() {
    const alert = await this.alertController.create({
      cssClass: 'custom-alert',
      header: 'No tienes conexión',
      message:
        'Puedes utilizar la aplicación en modo desconectado, tus resultados se cargarán automaticamente cuando vuelvas a iniciar sesión con internet.',
      buttons: [
        {
          cssClass: 'alert-button-confirm',
          text: 'Ok',
        },
      ],
    });
    await alert.present();
  }
}
