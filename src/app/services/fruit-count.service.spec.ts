import { TestBed } from '@angular/core/testing';

import { FruitCountService } from './fruit-count.service';

describe('FruitCountService', () => {
  let service: FruitCountService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FruitCountService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
