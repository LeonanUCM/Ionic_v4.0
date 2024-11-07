import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FruitCountPageRoutingModule } from './fruit-count-routing.module';

import { FruitCountPage } from './fruit-count.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FruitCountPageRoutingModule
  ],
  declarations: [FruitCountPage]
})
export class FruitCountPageModule {}
