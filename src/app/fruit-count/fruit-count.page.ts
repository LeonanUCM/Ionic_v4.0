import { FruitCountService } from '../services/fruit-count.service';
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';

//////////////////////////////////////////////////////////////////////////////////////////////

@Component({
  selector: 'app-fruit-count',
  templateUrl: './fruit-count.page.html',
  styleUrls: ['./fruit-count.page.scss'],
})

export class FruitCountPage implements OnInit, AfterViewInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public fruitCountService: FruitCountService | null = null
  ) {
    console.log('FruitCountPage constructor called');
  }



  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Lifecycle hook executed after Angular has fully initialized the view.
   */
  ngAfterViewInit() {
    console.log('ngAfterViewInit called');
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
    return fruitNames[fruitType] || (this.router.navigate(['/home/']), '');
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Navigates back to the previous page in the navigation stack.
   */
  public goBack() {
    this.router.navigate(['/home/']);
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
