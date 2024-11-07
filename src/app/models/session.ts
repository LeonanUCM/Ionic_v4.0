/**
 * Representa la sesión actual del usuario que haya ingresado a la app.
 * 
 * @property {string} token - Token de verificación.
 * @property {string} refreshToken - Token de refrescamiento.
 * @property {string} status - Status del usuario.
 * @property {string} userId - Id interna del usuario.
 * @property {string} expireIn - Momento de tiempo en el que expira la sesión.
 */
export class Session {
    token: string;
    refreshToken: string;
    status: string;
    userId: string;
    expireIn: string;
}