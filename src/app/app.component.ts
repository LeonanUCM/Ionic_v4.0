import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { UserService } from './services/user.service';
import { StorageService } from './services/storage.service';
import { NavController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})

/**
 * Lógica de la barra de navegación lateral.
 *
 * @property {string} currentPage - Representa la página actual en la que se encuentra el usuario.
 * @property {string} appVersion - Versión actual de la aplicación.
 */
export class AppComponent {

  public currentPage: string = "Análisis de imágen";
  public appVersion: string = environment.version;

  public appPages = [
    { title: 'Análisis de imágen', url: '/home', icon: 'image' },
    { title: 'Sobre nosotros', url: '/about', icon: 'information-circle' },
    { title: 'Reportar problemas', url: '/report-problem', icon: 'warning' }
  ];

  constructor(
    private navCtrl: NavController,
    private userService: UserService,
    private storageService: StorageService,
    private platform: Platform
  ) { 
      this.initializeApp(); 
    }

  async ngOnInit() {
    const isLoggedIn = await this.userService.userLoggedIn;
    if (isLoggedIn) {
      this.navCtrl.navigateRoot('/home'); // Redirige a 'home' si el usuario está autenticado
    } else {
      this.navCtrl.navigateRoot('/login'); // Redirige a 'login' si no está autenticado
    }
  }
  
  initializeApp() {
    this.platform.ready().then(() => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      this.toggleDarkTheme(prefersDark.matches);
      
      // Listener para detectar cambios en el tema
      prefersDark.addEventListener('change', (mediaQuery) => {
      this.toggleDarkTheme(mediaQuery.matches);
      });
    });
  }

  /**
   * Método encargado de cambiar la página en el menú lateral.
   *
   * @param option
   */
  changePage(option: string) {
    this.currentPage === option ? this.currentPage : this.currentPage = option;
  }

  /**
   * Método encargado de cerrar la sesíon del usuario conectado.
   */
  cerrarSesion() {
    this.currentPage = "Análisis de imágen";
    this.userService.logOff();
    this.storageService.remove(0, 'login_credentials');
  }
  toggleDarkTheme(shouldAdd: boolean) {
    document.body.classList.toggle('dark', shouldAdd);
  }
}
 