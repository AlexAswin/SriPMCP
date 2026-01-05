import { TestBed } from '@angular/core/testing';

import { NewCustomerEntryService } from './new-customer-entry.service';

describe('NewCustomerEntryService', () => {
  let service: NewCustomerEntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NewCustomerEntryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
