import { Component, QueryList, ViewChild, ViewChildren, ElementRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { IonModal } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  @ViewChild('modal', { static: true }) modal!: IonModal;
  @ViewChildren('imgTree, imgSoil', { read: ElementRef }) ionImages!: QueryList<ElementRef>; // Access imgTree and imgSoil as ElementRef

  isModalOpen = false;
  private fruit: string = '';
  imgTree!: ElementRef;
  imgSoil!: ElementRef;

  fruits = [
    { type: 'apple-green', img: 'assets/images/apple-green.jpg', name: 'Manzana\nVerde' },
    { type: 'citrus-orange', img: 'assets/images/citrus-orange.jpg', name: 'Citrus\nNaranja' },
    { type: 'peach-yellow', img: 'assets/images/peach-yellow.jpg', name: 'Melocotón\nAmarillo' },
    { type: 'peach-red', img: 'assets/images/peach-red.jpg', name: 'Melocotón\nRojo' },
  ];

  constructor(private router: Router) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.isModalOpen = false;
      }
    });
  }  

  openFruitPage(fruitType: string, fruitSubType: string) {
    this.router.navigate(['/fruit-count'], { queryParams: { fruit_type: fruitType, fruit_sub_type: fruitSubType } });
  }

  openFruitOptions(fruit: string) {
    this.fruit = fruit;
    this.isModalOpen = true;
  }

  handleModalWillPresent() {
    // Retrieve imgTree and imgSoil once the modal is ready
    this.imgTree = this.ionImages.find((img) => img.nativeElement.id === 'imgTree')!;
    this.imgSoil = this.ionImages.find((img) => img.nativeElement.id === 'imgSoil')!;

    if (this.imgTree && this.imgSoil) {
      this.imgTree.nativeElement.src = `assets/images/${this.fruit}-tree.jpg`;
      this.imgSoil.nativeElement.src = `assets/images/${this.fruit}-soil.jpg`;
      console.log('Tree Image:', this.imgTree.nativeElement.src);
      console.log('Soil Image:', this.imgSoil.nativeElement.src);
    } else {
      console.error("Image references are undefined.");
    }
  }

  closeModal() {
    this.isModalOpen = false;
  }

  dismissModal() {
    if (this.modal) {
      this.modal.dismiss();
    }
  }

  selectOption(option: string) {
    console.log('Selected Option:', option);
    this.openFruitPage(this.fruit, option);
    this.dismissModal();
  }
}