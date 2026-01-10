import { TestBed } from '@angular/core/testing';

import { VehicleTypeAndpriceDetailsService } from './vehicle-type-andprice-details.service';

describe('VehicleTypeAndpriceDetailsService', () => {
  let service: VehicleTypeAndpriceDetailsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VehicleTypeAndpriceDetailsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
