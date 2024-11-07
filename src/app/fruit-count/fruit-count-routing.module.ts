import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FruitCountPage } from './fruit-count.page';

const routes: Routes = [
  {
    path: '',
    component: FruitCountPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FruitCountPageRoutingModule {}
