import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneralReportsComponent } from './general-reports.component';

describe('GeneralReportsComponent', () => {
  let component: GeneralReportsComponent;
  let fixture: ComponentFixture<GeneralReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneralReportsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GeneralReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
