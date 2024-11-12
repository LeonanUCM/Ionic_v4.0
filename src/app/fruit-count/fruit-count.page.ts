import { FruitCountService } from '../services/fruit-count.service';
import { StorageService } from '../services/storage.service';
import { UploaderService } from '../services/uploader.service';
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, ToastController, NavController, AlertController } from '@ionic/angular';

//////////////////////////////////////////////////////////////////////////////////////////////

@Component({
  selector: 'app-fruit-count',
  templateUrl: './fruit-count.page.html',
  styleUrls: ['./fruit-count.page.scss'],
})

export class FruitCountPage implements OnInit, AfterViewInit {
  public showAnimationPendingRequests: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private storageService: StorageService,
    public uploaderService: UploaderService,
    public alertController: AlertController,
    public fruitCountService: FruitCountService | null = null
  ) {
    // Initialize fruitCountService with loading and toast controllers
    this.fruitCountService = new FruitCountService(
      this.loadingController, 
      this.toastController,
      this.storageService,
      this.uploaderService,
      this.alertController
    );
  }



  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Lifecycle hook executed after Angular has fully initialized the view.
   */
  ngAfterViewInit() {
    console.log('ngAfterViewInit called');
    console.log('Trying to send pending analisys...');
    this.uploaderService.uploadPreviousAnalyses('Uploading new analisys', false);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Lifecycle hook called once the component is created and ready.
   * Sets up route query parameter subscriptions and initializes the fruit count service.
   */
  ngOnInit() {
    console.log('ngOnInit called.');

    // Subscribe to route query parameters for service initialization
    this.route.queryParams.subscribe(params => {
      this.fruitCountService.initialize(
        params['fruit_type'], 
        params['fruit_sub_type'], 
        this.getFruitLocalName(params['fruit_type'])
      );
    });

    // Suscribirse a los cambios de badgeValue$ para actualizar el valor y activar la animación
    this.uploaderService.badgePendingRequests$.subscribe((value) => {
      this.triggerAnimationPendingRequests(); // Activar animación
    });    
  }

  // Método para activar la animación
  triggerAnimationPendingRequests() {
    console.log('triggerAnimationPendingRequests called');
    this.showAnimationPendingRequests = false;
    setTimeout(() => {
      this.showAnimationPendingRequests = true;
    }, 0);
  }  

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Returns the localized name for a given fruit type.
   * If the fruit type does not exist, navigates back and returns an empty string.
   * @param fruitType - The identifier for the fruit type
   * @returns Localized name for the fruit type
   */
  private getFruitLocalName(fruitType: string): string {
    const fruitNames = {
      'apple-green': 'Manzana Verde',
      'citrus-orange': 'Citrus Naranja',
      'peach-yellow': 'Melocotón Amarillo',
      'peach-red': 'Melocotón Rojo'
    };
    return fruitNames[fruitType] || (this.navCtrl.back(), '');
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Navigates back to the previous page in the navigation stack.
   */
  public goBack() {
    this.navCtrl.back();
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Triggers the file input click for image or camera selection based on the provided input ID.
   * @param inputId - The ID of the file input element to trigger
   */
  public triggerFileInput(inputId: string): void {
    const fileInput = document.getElementById(inputId) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }
}
