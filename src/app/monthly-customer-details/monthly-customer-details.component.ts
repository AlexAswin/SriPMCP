import { Component, Input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../Common/button/button.component';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MonthlyCustomerDetailsService } from '../monthly-customer-details.service';
import { NewCustomerEntryFormComponent } from '../new-customer-entry-form/new-customer-entry-form.component';
import { MatGridListModule } from '@angular/material/grid-list';


@Component({
  selector: 'app-monthly-customer-details',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ButtonComponent, CommonModule, ReactiveFormsModule, NewCustomerEntryFormComponent,
            ReactiveFormsModule, MatGridListModule,],
  templateUrl: './monthly-customer-details.component.html',
  styleUrl: './monthly-customer-details.component.scss'
})
export class MonthlyCustomerDetailsComponent {

  @Input() type = 'success';
  @Input() message: string = 'New Customer... Get Customer Details';

  searchWithVehicleNbr = new FormControl<string | null>('');

  vehicleDetailsForm!: FormGroup;

  show = false;
  existingCustomer: boolean = false;

  constructor ( private monthlyCustomerDetailsService : MonthlyCustomerDetailsService,
                private fb: FormBuilder) {
                  this.vehicleDetailsForm = this.fb.group({
                    vehicleNumber: ['', Validators.required],
                    customerName: ['', Validators.required],
                    vehicleType: ['', Validators.required],
                    customerType: ['', Validators.required],
                    amount: [{ value: '', disabled: false }],
                    advance: [''],
                    fromDateMonthly: [null],
                    monthlyStatus: ['Active', Validators.required],
                    note: [''],
                  });
  }

  close() {
    this.show = false;
  }

  private normalizeVehicleNumber(value: string): string {
    return value
      .toUpperCase()
      .replace(/\s+/g, '')
      .trim();
  }

  checkExistingUser = async() => {

    const vehicleNumber = this.searchWithVehicleNbr.value?.trim();

    if (!vehicleNumber ) {
      console.log('No vehicle number entered');
      return;
    }
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNumber)


    const exists = await this.monthlyCustomerDetailsService.getVehicleByNumber(formatedVehicleNbr);

  if (exists) {
    console.log('Vehicle already exists :', exists);
    this.show = true;
  } else {
    console.log('New vehicle');
  }
  this.message = exists? 'Existing Customer... Please rewiew the customer details': 'New Customer... Please add Customer Details';
  }

  submitForm() {

  }

}
