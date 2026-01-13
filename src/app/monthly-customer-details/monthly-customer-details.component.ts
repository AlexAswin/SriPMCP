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

  monthlyStatuses = ['Active', 'InActive'];



  @Input() type = 'success';
  @Input() message: string = '';

  searchWithVehicleNbr = new FormControl<string | null>('');

  vehicleDetailsForm!: FormGroup;

  showAlert = false;
  // existingCustomer: boolean = false;
  vehicleTypes: string[] = [];

  advance= new FormControl<string>('');
  monthlyStatus= new FormControl<string>('');
  fromDateMonthly= new FormControl<string>('');
  endDateMonthly= new FormControl<string>('');
  note = new FormControl<string>('');

  isStatusInActive: boolean = false;

  isNewMonthlyCustomer: boolean = true;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;
  isDailyPaidCustomer: boolean = false;

  currentCustomer: string ='';
  dailyToMonthlyCustomer: boolean = false;



  
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

  this.monthlyStatus.valueChanges.subscribe(status => {
    this.onMonthlyStatusChange(status);
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
      customerType: [{value:'monthly'}],
      address: [{ value: '', disabled: false }],
      amount: [{ value: '', disabled: true }],

    });
  }

  onMonthlyStatusChange(status: string | null) {  
    if (status === 'Active') {
      this.isStatusInActive = false;
      this.isMonthlyActiveCustomer = true;
      this.dailyToMonthlyCustomer = true;
      this.isMonthlyInActiveCustomer = false
    } else if (status === 'InActive') {
      this.isStatusInActive = true;
      this.isMonthlyActiveCustomer = false;
      this.isMonthlyInActiveCustomer = true
    }
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
    this.currentCustomer = res.vehicleNumber;

    if (res && res.monthlyStatus === 'Active') {
      this.isStatusInActive = false;
      this.isMonthlyActiveCustomer = true;
      this.isNewMonthlyCustomer = false
      this.endDateMonthly.reset();

      this.vehicleDetailsForm.patchValue({
        vehicleNumber: res.vehicleNumber,
        vehicleType: res.vehicleType,

        customerName: res.customerName,
        customerPhoneNbr: res.customerPhoneNbr,
        customerType: res.customerType,
        address: res.address,
        amount: res.amount,  
      });
      this.advance.setValue(res.advance);
      this.monthlyStatus.setValue(res.monthlyStatus);
      this.fromDateMonthly.setValue(res.fromDateMonthly),
      this.note.setValue(res.note);

    } else if (res && res.monthlyStatus === 'InActive') {
      this.isStatusInActive = true;
      this.isMonthlyInActiveCustomer = true;
      this.isNewMonthlyCustomer = false;
      this.vehicleDetailsForm.patchValue({
        vehicleNumber: res.vehicleNumber,
        vehicleType: res.vehicleType,

        customerName: res.customerName,
        customerPhoneNbr: res.customerPhoneNbr,
        customerType: res.customerType,
        address: res.address,

        amount: res.amount,  
      });
      this.advance.setValue(res.advance);
      this.monthlyStatus.setValue(res.monthlyStatus);
      this.fromDateMonthly.setValue(res.fromDateMonthly);
      this.endDateMonthly.setValue(res.endDateMonthly);
      this.note.setValue(res.note);

      console.log(res);
    } else if (res && res.status === 'paid'){
      this.dailyToMonthlyCustomer = true
      this.isMonthlyActiveCustomer = false;
      this.isMonthlyInActiveCustomer = false;
      this.isNewMonthlyCustomer = false;
      console.log('Customer daily to monthly')
      this.vehicleDetailsForm.patchValue({
        vehicleNumber: res.vehicleNumber,
        vehicleType: res.vehicleType,

        customerName: res.customerName,
        customerPhoneNbr: res.customerPhoneNbr,
        address: res.address,
        status: res.status,
      });
    }
  }    

  submitForm = async() => {
    if (this.vehicleDetailsForm.invalid) {
      this.vehicleDetailsForm.markAllAsTouched();
      return;
    }

    if (this.isNewMonthlyCustomer && !this.dailyToMonthlyCustomer) {  
      const payload: any = { ...this.vehicleDetailsForm.value };

    if (payload.vehicleNumber) {
      payload.vehicleNumber = this.normalizeVehicleNumber(payload.vehicleNumber);
    }

    const customerDetails = {
      ...payload,
      advance: this.advance.value,
      monthlyStatus: this.monthlyStatus.value,
      fromDateMonthly: this.fromDateMonthly.value,
      note: this.note.value
    };
      try {
        const res = await this.newCustomerEntryService.addNewCustomerEntry(customerDetails);
        this.vehicleDetailsForm.reset();
        this.showAlert = true;
        this.message = 'Customer Added SuccessFully...'
        console.log('Customer added:', res);
      } catch (error) {
        this.showAlert = true;
        this.message = 'Error Adding Customer... Please Try Again...'
        console.error('Error adding customer:', error);
      }
    } else if (this.isMonthlyInActiveCustomer) {
      try {
        const updatePayload: any = {
          monthlyStatus: this.monthlyStatus.value
        };
  
        if (this.monthlyStatus.value === 'InActive') {
          updatePayload.endDateMonthly = this.endDateMonthly.value
        }

        const historyPayload: any = {
          fromStatus: 'Active',
          toStatus: 'InActive',
          startDate: this.fromDateMonthly.value,
          endDate: this.endDateMonthly.value,
        };

        const res = await this.newCustomerEntryService.updateCustomerByVehicleNumber(this.currentCustomer, updatePayload, historyPayload );
        console.log(res)

        this.endDateMonthly.reset();
        this.showAlert = true;
        this.message = 'Customer Updated Successfully...';
      } catch (error) {
        this.showAlert = true;
        this.message = 'Error Updating Customer...';
        console.error(error);
      }
    } else if (this.isMonthlyActiveCustomer && !this.dailyToMonthlyCustomer) {
      try {
        const updatePayload: any = {
          monthlyStatus: this.monthlyStatus.value
        };
  
        if (this.monthlyStatus.value === 'Active') {
          updatePayload.fromDateMonthly = this.fromDateMonthly.value,
          updatePayload.endDateMonthly = null
        }

        const historyPayload: any = {
          fromStatus: 'InActive',
          toStatus: 'Active',
          startDate: this.fromDateMonthly.value,
          endDate: null,
        };

        const res = await this.newCustomerEntryService.updateCustomerByVehicleNumber(this.currentCustomer, updatePayload, historyPayload );
        console.log(res)

        this.endDateMonthly.reset();
        this.showAlert = true;
        this.message = 'Customer Updated Successfully...';
      } catch (error) {
        this.showAlert = true;
        this.message = 'Error Updating Customer...';
        console.error(error);
      }

    } else if (this.dailyToMonthlyCustomer) {

      const updatePayload: any = { ...this.vehicleDetailsForm.value };

      if (updatePayload.vehicleNumber) {
        updatePayload.vehicleNumber = this.normalizeVehicleNumber(updatePayload.vehicleNumber);
      }

      const customerDetails = {
        ...updatePayload,
        advance: this.advance.value,
        monthlyStatus: this.monthlyStatus.value,
        fromDateMonthly: this.fromDateMonthly.value,
        endDateMonthly: null,
        note: this.note.value,
      };
      const historyPayload: any = {
        fromStatus: 'Daily paid',
        toStatus: 'Monthly Active',
        startDate: this.fromDateMonthly.value,
        endDate: null,
      };
      
      try {
        const res = await this.newCustomerEntryService.updateCustomerByVehicleNumber(this.currentCustomer, customerDetails, historyPayload );
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
      this.advance.setValue('');
      this.monthlyStatus.setValue('');
      this.fromDateMonthly.setValue('');
      this.endDateMonthly.setValue('');
      this.note.setValue('');
  }

  cancelEntry() {

  }

  closeForm() {
    this.vehicleDetailsForm.reset();
    this.router.navigate(['/dashBoard'])
  }

}

