import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../Common/button/button.component';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';


@Component({
  selector: 'app-daily-customer-details',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, ButtonComponent, ReactiveFormsModule, CommonModule, MatIconModule],
  templateUrl: './daily-customer-details.component.html',
  styleUrl: './daily-customer-details.component.scss'
})
export class DailyCustomerDetailsComponent {

  vehicleDetailsForm!: FormGroup;

  searchWithVehicleNbr = new FormControl<string | null>('');

  status = ['Paid', 'Unpaid'];


  constructor ( private newCustomerEntryService : NewCustomerEntryService,
                private fb: FormBuilder,
                private router: Router) {
      this.vehicleDetailsForm = this.fb.group({
        vehicleNumber: [{ value: '', disabled: true }, Validators.required],
        customerName: [{ value: '', disabled: true }, Validators.required],
        customerPhoneNbr: [{ value: '', disabled: true }],
        vehicleType: [{ value: '', disabled: true }, Validators.required],
        customerType: [{ value: '', disabled: true }, Validators.required],
        amount: [{ value: '', disabled: true }],
        fromDateDaily: [{ value: '', disabled: true }],
        endDateDaily: [{ value: '', disabled: false }],
        status: [{ value: '', disabled: false }],
        note: [{ value: '', disabled: true }],
        billNo: [{ value: '', disabled: true }],
        actualCost: [{value: '200', disable: false}],
        address: [{ value: '', disabled: true }]
      });
}

getCustomerDetails = async() => {

  const vehicleNumber = this.searchWithVehicleNbr.value?.trim();

  if (!vehicleNumber ) {
    console.log('No vehicle number entered');
    return;
  }
  const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNumber)


  const res = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr);

if (res) {
  this.vehicleDetailsForm.patchValue({
    vehicleNumber: res.vehicleNumber,
    vehicleType: res.vehicleType,
    customerName: res.customerName,
    customerPhoneNbr: res.phoneNumber,
    customerType: res.customerType,
    billNo: res.billNumber,
    status: res.status,
    amount: res.amount,
    fromDateDaily: res.fromDateDaily.toLocaleString('en-IN'),
    note: res.note,
    address: res.address
  });
} else {
  console.log('New vehicle');
}
}

private normalizeVehicleNumber(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}

submitForm() {

}

cancelEntry() {

}

closeForm() {
  this.vehicleDetailsForm.reset();
  this.router.navigate(['/dashBoard'])
}

}
