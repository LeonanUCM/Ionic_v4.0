import { Session } from "./session";

/**
 * Representa al usuario que haya ingresado a la app.
 * 
 * @property {string} email - Correo electrónico del usuario.
 * @property {string} name - Nombres del usuario.
 * @property {string} last_name - Apellidos del usuario.
 * @property {string} company - Empresa a la que pertenece el usuario.
 * @property {Session} session_data - Datos de sesión actual del usuario.
 */
export class User {
    email: string;
    name: string;
    last_name: string;
    company: string;
    session_data: Session;

    constructor() {
        this.session_data = new Session();
    }
}