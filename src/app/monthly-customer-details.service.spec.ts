import { TestBed } from '@angular/core/testing';

import { MonthlyCustomerDetailsService } from './monthly-customer-details.service';

describe('MonthlyCustomerDetailsService', () => {
  let service: MonthlyCustomerDetailsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MonthlyCustomerDetailsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
