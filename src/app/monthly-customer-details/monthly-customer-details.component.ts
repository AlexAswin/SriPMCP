import { Component, Input, OnInit } from '@angular/core';
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
import { Router } from '@angular/router';
import { VehicleTypeAndpriceDetailsService } from '../vehicle-type-andprice-details.service';
import { MatSelectModule } from '@angular/material/select';


@Component({
  selector: 'app-monthly-customer-details',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ButtonComponent, CommonModule, ReactiveFormsModule, NewCustomerEntryFormComponent,
            ReactiveFormsModule, MatGridListModule, ExistingCustomerDetailsComponent, MatRadioModule, MatSelectModule],
  templateUrl: './monthly-customer-details.component.html',
  styleUrl: './monthly-customer-details.component.scss'
})
export class MonthlyCustomerDetailsComponent implements OnInit {

  advanceStatus = ['Yes', 'No'];
  monthlyStatus = ['Active', 'InActive'];



  @Input() type = 'success';
  @Input() message: string = '';

  searchWithVehicleNbr = new FormControl<string | null>('');

  vehicleDetailsForm!: FormGroup;

  showAlert = false;
  existingCustomer: boolean = false;
  vehicleTypes: string[] = [];
  customerType: string = 'monthly';
  isNewMonthlyCustomer: boolean = true;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;



  
ngOnInit() {
  this.vehicleTypes = this.vehicleTypeAndpriceDetailsService.getVehicleTypes();

  this.vehicleDetailsForm.valueChanges.subscribe(({ vehicleType, customerType }) => {
    if (vehicleType && customerType) {
      const price = this.vehicleTypeAndpriceDetailsService.getPrice(vehicleType, customerType);
      if (price !== null) {
        this.vehicleDetailsForm.get('amount')
          ?.setValue(price, { emitEvent: false });
      }
    }
  });


}

  constructor ( private newCustomerEntryService : NewCustomerEntryService,
                private fb: FormBuilder,
                private router: Router,
                private vehicleTypeAndpriceDetailsService: VehicleTypeAndpriceDetailsService) {

                  this.vehicleDetails();
  }

  close() {
    this.showAlert = false;
  }

  vehicleDetails = () => {
    this.vehicleDetailsForm = this.fb.group({
      vehicleNumber: [{ value: '', disabled: false }, Validators.required],
      vehicleType: [{ value: '', disabled: false }, Validators.required],

      customerName: [{ value: '', disabled: false }, Validators.required],
      customerPhoneNbr: [{ value: '', disabled: false }, Validators.required],
      customerType: [{ value: 'monthly', disabled: false }, Validators.required],
      address: [{ value: '', disabled: false }],


      amount: [{ value: '', disabled: false }],
      advance: [{ value: '', disabled: false }],
      monthlyStatus: [{ value: 'Active', disabled: false }, Validators.required],
      fromDateMonthly: [{ value: null, disabled: false }, Validators.required],
      note: [{ value: '', disabled: false }],
      // endDateMonthly: [{ value: null, disabled: false }],

    });
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
      return;
    }
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNumber)
    const res = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr);

    if (res && res.monthlyStatus === 'Active') {
      this.vehicleDetailsForm.patchValue({
        vehicleNumber: res.vehicleNumber,
        vehicleType: res.vehicleType,

        customerName: res.customerName,
        customerPhoneNbr: res.customerPhoneNbr,
        customerType: res.customerType,
        address: res.address,

        amount: res.amount,
        advance: res.advance,
        monthlyStatus: res.monthlyStatus,
        fromDateMonthly: res.fromDateMonthly.toLocaleString('en-IN'),
        note: res.note,
      });
    } else if (res && res.monthlyStatus === 'InActive') {
      this.isMonthlyInActiveCustomer = true;
      console.log(res);
    } else {
      console.log('Customer Not Found')
    }
  }    

  submitForm = async() => {
    if (this.vehicleDetailsForm.invalid) {
      this.vehicleDetailsForm.markAllAsTouched();
      return;
    }

    const payload: any = { ...this.vehicleDetailsForm.value };
    if (payload.vehicleNumber) {
      payload.vehicleNumber = this.normalizeVehicleNumber(payload.vehicleNumber);
    }

    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
        delete payload[key];
      }
    });

    if (this.isNewMonthlyCustomer) {  
      try {
        const res = await this.newCustomerEntryService.addNewCustomerEntry(payload);
        this.vehicleDetailsForm.reset();
        this.showAlert = true;
        this.message = 'Customer Added SuccessFully...'
        console.log('Customer added:', res);
      } catch (error) {
        this.showAlert = true;
        this.message = 'Error Adding Customer... Please Try Again...'
        console.error('Error adding customer:', error);
      }
    }

  }

  cancelEntry() {

  }

  closeForm() {
    this.vehicleDetailsForm.reset();
    this.router.navigate(['/dashBoard'])
  }

}
function elseIf(arg0: any) {
  throw new Error('Function not implemented.');
}

