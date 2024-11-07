/* The AppComponent class in this TypeScript code initializes the app and toggles a dark theme based on
the user's preference. */
import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(private platform: Platform) {
    this.initializeApp();
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

  toggleDarkTheme(shouldAdd: boolean) {
    document.body.classList.toggle('dark', shouldAdd);
  }
}
