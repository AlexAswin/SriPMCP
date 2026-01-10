import { Component } from '@angular/core';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavBarComponent } from '../Common/nav-bar/nav-bar.component';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';


@Component({
  selector: 'app-existing-customer-details',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NavBarComponent, MatIconModule ],
  templateUrl: './existing-customer-details.component.html',
  styleUrl: './existing-customer-details.component.scss'
})
export class ExistingCustomerDetailsComponent {

  vehicleForm! : FormGroup

  isMonthly: boolean = false;
  isDaily: boolean = true

  

  ngOnInit(): void {
    this.createForm();
    this.vehicleForm.get('customerType')?.valueChanges.subscribe(type => {
      if (type === 'Daily') {
        this.vehicleForm.patchValue({
          monthlyStatus: null,
          advance: null
        });
      } else if (type === 'Monthly') {
        this.vehicleForm.patchValue({
          billNumber: null,
          status: null
        });
      }
    });
    this.loadVehicleData();
  }
  constructor ( private newCustomerEntryService : NewCustomerEntryService,
                private fb : FormBuilder,
                private router: Router) {

  }

  createForm() {
    this.vehicleForm = this.fb.group({
      vehicleNumber: ['', Validators.required],
      vehicleType: ['', Validators.required],
      customerName: ['', Validators.required],
      customerPhoneNbr: ['', Validators.required],
      customerType: ['', Validators.required],
      monthlyStatus: [''],
      advance: [''],
      amount: [''],
      fromDate: [''],
      note: [''],
      billNumber: [''],
      status: ['']
    });
  }

  loadVehicleData() {
    this.newCustomerEntryService.vehicle$.subscribe((res: any) => {
      if (!res) return;
  
      this.vehicleForm.reset();
  
      if (res.customerType === 'Daily') {
        this.vehicleForm.patchValue({
          vehicleNumber: res.vehicleNumber,
          vehicleType: res.vehicleType,
          customerName: res.customerName,
          customerType: res.customerType,
          customerPhoneNbr: res.phoneNumber,
          amount: res.amount,
          fromDate: res.fromDateDaily.toLocaleString('en-IN'),
          note: res.note,
          billNumber: res.billNumber,
          status: res.status
        });
      } else {
        this.vehicleForm.patchValue({
          vehicleNumber: res.vehicleNumber,
          vehicleType: res.vehicleType,
          customerName: res.customerName,
          customerType: res.customerType,
          customerPhoneNbr: res.phoneNumber,
          amount: res.amount,
          fromDate: res.fromDateMonthly.toLocaleString('en-IN'),
          note: res.note,
          monthlyStatus: res.monthlyStatus,
          advance: res.advance
        });
      }
    });
  }
  

  submit() {

  }

  closeForm() {
    this.vehicleForm.reset();
    this.router.navigate(['/dashBoard'])
  }

}
