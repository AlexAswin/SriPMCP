import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewCustomerEntryFormComponent } from './new-customer-entry-form.component';

describe('NewCustomerEntryFormComponent', () => {
  let component: NewCustomerEntryFormComponent;
  let fixture: ComponentFixture<NewCustomerEntryFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewCustomerEntryFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NewCustomerEntryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
