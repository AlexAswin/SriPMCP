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
import { ExistingCustomerDetailsComponent } from '../existing-customer-details/existing-customer-details.component';
import { FormsModule} from '@angular/forms';
import { MatRadioModule} from '@angular/material/radio';
import { NewCustomerEntryService } from '../new-customer-entry.service';


@Component({
  selector: 'app-monthly-customer-details',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ButtonComponent, CommonModule, ReactiveFormsModule, NewCustomerEntryFormComponent,
            ReactiveFormsModule, MatGridListModule, ExistingCustomerDetailsComponent, MatRadioModule],
  templateUrl: './monthly-customer-details.component.html',
  styleUrl: './monthly-customer-details.component.scss'
})
export class MonthlyCustomerDetailsComponent {

  advanceStatus = ['Yes', 'No'];
  monthlyStatus = ['Active', 'InActive'];



  @Input() type = 'success';
  @Input() message: string = 'New Customer... Get Customer Details';

  searchWithVehicleNbr = new FormControl<string | null>('');

  vehicleDetailsForm!: FormGroup;

  show = false;
  existingCustomer: boolean = false;

  constructor ( private newCustomerEntryService : NewCustomerEntryService,
                private fb: FormBuilder) {
                  this.vehicleDetailsForm = this.fb.group({
                    vehicleNumber: [{ value: '', disabled: true }, Validators.required],
                    customerName: [{ value: '', disabled: true }, Validators.required],
                    customerPhoneNbr: [{ value: '', disabled: true }],
                    vehicleType: [{ value: '', disabled: true }, Validators.required],
                    customerType: [{ value: '', disabled: true }, Validators.required],
                    amount: [{ value: '', disabled: true }],
                    fromDateMonthly: [{ value: null, disabled: true }],
                    endDateMonthly: [{ value: null, disabled: false }],
                    monthlyStatus: [{ value: 'Active', disabled: false }, Validators.required],
                    note: [{ value: '', disabled: true }],
                    advance: [{ value: '', disabled: true }],
                    address: [{ value: '', disabled: true }]
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
      amount: res.amount,
      fromDateMonthly: res.fromDateMonthly.toLocaleString('en-IN'),
      note: res.note,
      monthlyStatus: res.monthlyStatus,
      advance: res.advance,
      address: res.address
    });
  } else {
    console.log('New vehicle');
  }
  }

  submitForm() {

  }

  cancelEntry() {

  }

}
