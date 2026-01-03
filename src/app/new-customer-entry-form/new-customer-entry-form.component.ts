import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatDatepickerModule} from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import {FormsModule} from '@angular/forms';
import {MatRadioModule} from '@angular/material/radio';
import { ButtonComponent } from '../Common/button/button.component';

@Component({
  selector: 'app-new-customer-entry-form',
  standalone: true,
  imports: [ReactiveFormsModule,  MatInputModule, MatButtonModule, CommonModule, MatSelectModule, MatGridListModule, MatDatepickerModule, 
            MatIconModule, FormsModule, MatRadioModule, ButtonComponent],
  templateUrl: './new-customer-entry-form.component.html',
  styleUrl: './new-customer-entry-form.component.scss',
  
})
export class NewCustomerEntryFormComponent {
  vehicleForm: FormGroup;
  vehicleTypes = ['Car', '2-Wheeler', '4-Wheeler', 'Lorry']
  customerTypes = ['Daily', 'Monthly'];
  status = ['Paid', 'Unpaid']
  pricing: any = {
    Daily: {
      Car: 1000,
      '2-Wheeler': 2000,
      '4-Wheeler': 3000,
      Lorry: 4000
    }
  };

  isDailyCustomer: boolean = false;
  isMonthlyCustomer: boolean = false;
  selectedVehicleType: string ='';

  constructor(private fb: FormBuilder) {
    this.vehicleForm = this.fb.group({
      vehicleNumber: ['', Validators.required],
      customerName: ['', Validators.required],
      vehicleType: ['', Validators.required],
      customerType: ['', Validators.required],
      amount: [{ value: '', disabled: false }],
      billNumber: ['', Validators.required],
      status: ['Unpaid', Validators.required],
      address: [''],
      note: [''],

    });
    this.vehicleForm.valueChanges.subscribe(values => {
      this.calculateAmount(values.customerType, values.vehicleType);
    });
  }

  onCustomerTypeChange(value: string) {

    if (value === 'Daily') {
      this.isDailyCustomer = true;
      this.isMonthlyCustomer = false;

    } else {
      this.isMonthlyCustomer = true;
      this.isDailyCustomer = false;

    }
  }

  calculateAmount(customerType: string, vehicleType: string) {
    const amount = this.pricing[customerType]?.[vehicleType] || '';
    this.vehicleForm.get('amount')?.setValue(amount, { emitEvent: false });
  }

  submitForm() {
    if (this.vehicleForm.valid) {
      console.log(this.vehicleForm.value);
    }
  }
}
