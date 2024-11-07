import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FruitCountPage } from './fruit-count.page';

describe('FruitCountPage', () => {
  let component: FruitCountPage;
  let fixture: ComponentFixture<FruitCountPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FruitCountPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
