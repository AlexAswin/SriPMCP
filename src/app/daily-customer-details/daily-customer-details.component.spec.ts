import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyCustomerDetailsComponent } from './daily-customer-details.component';

describe('DailyCustomerDetailsComponent', () => {
  let component: DailyCustomerDetailsComponent;
  let fixture: ComponentFixture<DailyCustomerDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyCustomerDetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DailyCustomerDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
