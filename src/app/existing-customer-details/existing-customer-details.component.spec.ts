import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExistingCustomerDetailsComponent } from './existing-customer-details.component';

describe('ExistingCustomerDetailsComponent', () => {
  let component: ExistingCustomerDetailsComponent;
  let fixture: ComponentFixture<ExistingCustomerDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExistingCustomerDetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ExistingCustomerDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
