import { FruitCountService } from '../services/fruit-count.service';
import { Component, OnInit, AfterViewInit, } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, ToastController, NavController } from '@ionic/angular';

//////////////////////////////////////////////////////////////////////////////////////////////

@Component({
  selector: 'app-fruit-count',
  templateUrl: './fruit-count.page.html',
  styleUrls: ['./fruit-count.page.scss'],
})

export class FruitCountPage implements OnInit, AfterViewInit {
  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    public fruitCountService: FruitCountService | null = null
    ) {
    // Constructor implementation
    this.fruitCountService = new FruitCountService(
      this.loadingController, 
      this.toastController);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Lifecycle hook that is called after data-bound properties are initialized.
   */
  ngAfterViewInit() {
    console.log('ngAfterViewInit called');
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Lifecycle hook that is called after the component is initialized.
   */
  async ngOnInit() {
    console.log('ngOnInit called.');
    
    // Subscribe to route query parameters
    this.route.queryParams.subscribe(params => {
      this.fruitCountService.initialize(
        params['fruit_type'], 
        params['fruit_sub_type'], 
        this.getFruitLocalName(params['fruit_type']),
        'https://gwk02bf51i.execute-api.eu-west-1.amazonaws.com/prod/'
      );
    });
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  private getFruitLocalName(fruitType) {
    // Change here to include a new Fruit
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
   * Navigates back to the previous page.
   */
  public goBack() {
    this.navCtrl.back();
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  // Función que dispara el clic en el input de archivo
  triggerFileInput(inputId: string): void {
    const fileInput = document.getElementById(inputId) as HTMLInputElement;
    if (fileInput) {
      fileInput.click(); // Dispara el clic en el input
    }
  }

}