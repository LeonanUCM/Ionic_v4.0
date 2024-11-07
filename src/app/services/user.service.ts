import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { environment } from 'src/environments/environment';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import StringCompressor from '../utilities/stringCompressor';

@Injectable({
  providedIn: 'root',
})

/**
 * Clase inyectable que funciona como el controlador
 * de endpoints principal de la APP.
 *
 * @property {User} user - Usuario que inicio sesión en la aplicación.
 * @property {boolean} user_log_in - Indica si el usuario ya inicio sesión en la app. (Se usa principalmente para el modo sin conexión)
 */
export class UserService {
  public user: User;
  public user_log_in: boolean = false;

  constructor() {
    this.user = new User();
  }

  /**
   * Método encargado de intentar realizar el login de un usuario.
   *
   * @param {string} user_email -
   * @param {string} user_password -
   * @returns string con el resultado de intento de login.
   */
  public async login(user_email: string, user_password: string) {
    const options = {
      url: environment.api_url + '/auth/sign-in',
      headers: { 'Content-Type': 'application/json' },
      data: { email: user_email, password: user_password, admin: false },
    };

    const response: HttpResponse = await CapacitorHttp.post(options);
    console.log('Login request: ', options);

    const userData = JSON.parse(JSON.stringify(response));

    console.log('Login JSON: ', JSON.parse(JSON.stringify(response)));

    try {
      // Iniciar sesion por primera vez
      if (
        userData.data.code === 200 &&
        userData.data.data.session_data.challengeName ===
          'NEW_PASSWORD_REQUIRED'
      ) {
        this.user.name = userData.data.data.name;
        this.user.last_name = userData.data.data.last_name;
        this.user.email = userData.data.data.email;
        this.user.company = userData.data.data.company;
        this.user_log_in = true;
        return 'first_time_user';
      }

      // Si el usuario es INACTIVE
      else if (
        userData.data.code === 500 &&
        userData.data.error.error_code === 'Account is not active'
      ) {
        return 'inactive_user';
      }

      // Si el usuario es válido
      else if (userData.data.code === 200) {
        this.user.name = userData.data.data.name;
        this.user.last_name = userData.data.data.last_name;
        this.user.email = userData.data.data.email;
        this.user.company = userData.data.data.company;

        this.user.session_data.userId = userData.data.data.session_data.userId;
        console.log('User ID: ', this.user.session_data.userId);
        this.user.session_data.token = userData.data.data.session_data.token;
        this.user.session_data.refreshToken =
          userData.data.data.session_data.refreshToken;
        this.user.session_data.status = userData.data.data.session_data.status;
        this.user.session_data.expireIn =
          userData.data.data.session_data.expireIn;
        this.user_log_in = true;
        return 'already_registered_user';
      }
    } catch (error) {
      console.log('Error en metodo login: ', error);
    }

    return null;
  }

  /**
   * Método encargado de cerrar la sesión de un usuario de la app.
   */
  public async logOff() {
    const options = {
      url: environment.api_url + '/auth/logout',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.user.session_data.token,
      },
      data: { refresh_token: this.user.session_data.refreshToken },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        console.log('Sesión cerrada exitosamente');
      } else {
        console.log('La sesión no pudo ser cerrada');
      }
      this.user_log_in = false;
    } catch (error) {
      console.log('Error en metodo logOff');
    }
  }

  /**
   * Método que se encarga de cambiar la contraseña del
   * usuario que está actualmente conectado en la app.
   *
   * Este método se usa para cambiar la contraseña del usuario
   * que entra por primera vez a la app con una contraseña temporal.
   *
   * @param {string} newPassword - Nueva contraseña para el usuario.
   * @returns true o false si la contraseña pudo ser cambiada.
   */
  public async setPassword(newPassword: string) {
    const options = {
      url: environment.api_url + '/auth/set-user-password',
      headers: { 'Content-Type': 'application/json' },
      data: { email: this.user.email, password: newPassword },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        console.log('Contraseña cambiada exitosamente');
        return true;
      } else {
        console.log('La contraseña no pudo ser cambiada');
        return false;
      }
    } catch (error) {
      console.log('Error en metodo setPassword');
    }

    return false;
  }

  /**
   * Método encargado de enviar el correo con la clave
   * de validación previo a cambiar la contraseña de un
   * usuario.
   *
   * @param {string} userEmail - C
   * @returns true o false si pudo enviar el correo de recuperación.
   */
  public async recoverPassword(userEmail: string) {
    const options = {
      url: environment.api_url + '/auth/recover-password',
      headers: { 'Content-Type': 'application/json' },
      data: { email: userEmail },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        console.log('Se envió el correo de recuperación exitosamente');
        this.user.email = userEmail;
        return true;
      } else {
        console.log('No se pudo enviar el correo de recuperación');
        return false;
      }
    } catch (error) {
      console.log('Error en metodo recoverPassword');
    }

    return false;
  }

  /**
   * Método encargado de cambiar la contraseña del usuario
   * al que se le envió el correo de recuperación.
   *
   * @param {string} newPassword - Nueva contraseña para el usuario.
   * @param {string} confirmationCode - Confirmación de nueva contraseña para el usuario.
   * @returns
   */
  public async resetPassword(newPassword: string, confirmationCode: string) {
    const options = {
      url: environment.api_url + '/auth/reset-password',
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: this.user.email,
        new_password: newPassword,
        confirmation_code: confirmationCode,
      },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        console.log('Se cambio la contraseña exitosamente');
        return true;
      } else {
        console.log('No se pudo cambiar la contraseña');
        return false;
      }
    } catch (error) {
      console.log('Error en metodo resetPassword');
    }

    return false;
  }

  /**
   * Método encargado de subir al backend la data de un análisis.
   *
   * @param {any} resultData - JSON que contiene toda la data de un análisis.
   * @returns true o false si pudo guardar la data de análisis.
   */
  public async saveResultData(resultData: any) {
    const options = {
      url: environment.api_url + '/photo/data',
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
        },
      ],
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        console.log('Se guardo la data de resultado exitosamente');
        return true;
      } else {
        console.log('No se pudo guardar la data de resultado ', response);
        return false;
      }
    } catch (error) {
      console.log('Error en metodo saveResultData');
    }

    return false;
  }

  /**
   * Método encargado de subir a S3 la imagen resultante
   * u original de un análisis.
   *
   * @param {any} resultData - JSON que contiene toda la data de un análisis. (importa es el UUID, la imagen original y resultante)
   * @param {any} isResultImage - Indica si la imagen que se va a subir es la original (false) o la de resultado (true).
   * @returns true o false si pudo subir la imagen.
   */
  public async uploadImage(resultData: any, isResultImage: boolean) {
    let options;

    if (isResultImage) {
      // Subir imagen resultado
      console.log('Subiendo imagen resultado');

      options = {
        url: environment.api_url + '/photo',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.user.session_data.token,
        },
        data: {
          name: resultData.result_UUID + '-result',
          file: resultData.result_image,
          result: true,
        },
      };
    } else {
      // Subir imagen original
      console.log('Subiendo imagen original');

      options = {
        url: environment.api_url + '/photo',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.user.session_data.token,
        },
        data: {
          name: resultData.result_UUID + '-original',
          file: resultData.original_image,
          result: false,
        },
      };
    }

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        console.log('Se guardaron las imagenes exitosamente');
        return true;
      } else {
        console.log('No se pudo guardar las imagenes');
        return false;
      }
    } catch (error) {
      console.log('Error en metodo uploadImage: ', error);
    }

    return false;
  }

  /**
   * Método encargado de enviar un correo reporte con algún
   * tipo de error que se haya presentado en la app para el usuario.
   *
   * @param {string} error_type - Tipo de error presentado.
   * @param {string} error_description - Descripción del error presentado.
   * @returns true o false si pudo enviar el correo de reporte de error.
   */
  public async uploadErrorReport(
    error_type?: string,
    error_description?: string
  ) {
    let requestData: any;

    // Verificar que si se ingreso descripción
    if (error_description === undefined || error_description === '') {
      requestData = { problem: error_type };
    } else {
      requestData = { problem: error_type, description: error_description };
    }

    const options = {
      url: environment.api_url + '/system/report-problem',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.user.session_data.token,
      },
      data: requestData,
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        console.log('Correo de reporte enviado exitosamente');
        return true;
      } else {
        console.log('No se pudo enviar el correo de reporte');
        return false;
      }
    } catch (error) {
      console.log('Error en metodo uploadErrorReport');
    }

    return false;
  }

  /**
   * Método encargado de refrescar el token del usuario conectado
   * actualmente en la app.
   *
   * @returns true o false si pudo refrescar el token.
   */
  public async refreshToken() {
    const options = {
      url: environment.api_url + '/auth/refresh-token',
      headers: {
        'Content-Type': 'application/json',
        user_id: this.user.session_data.userId,
      },
      data: { refresh_token: this.user.session_data.refreshToken },
    };

    try {
      const response: HttpResponse = await CapacitorHttp.post(options);
      if (response.status >= 200 && response.status <= 300) {
        const result = JSON.parse(JSON.stringify(response));
        this.user.session_data.token = result.data.data.token;
        this.user.session_data.refreshToken = result.data.data.refresh_token;
        this.user.session_data.userId = result.data.data.user_id;
        this.user.session_data.expireIn = result.data.data.expire_in;

        console.log('Se ha refrescado el token exitosamente');
        return true;
      } else {
        console.log('No se pudo refrescar el token');
        return false;
      }
    } catch (error) {
      console.log('Error en metodo refreshToken: ', error);
    }

    return false;
  }
}
