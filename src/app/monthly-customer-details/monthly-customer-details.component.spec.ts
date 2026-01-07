import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthlyCustomerDetailsComponent } from './monthly-customer-details.component';

describe('MonthlyCustomerDetailsComponent', () => {
  let component: MonthlyCustomerDetailsComponent;
  let fixture: ComponentFixture<MonthlyCustomerDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyCustomerDetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MonthlyCustomerDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
