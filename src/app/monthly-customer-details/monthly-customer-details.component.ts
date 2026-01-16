import { Component, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../Common/button/button.component';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatRadioModule} from '@angular/material/radio';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { AdminService, VehicleType } from '../admin.service';


@Component({
  selector: 'app-monthly-customer-details',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ButtonComponent, CommonModule, ReactiveFormsModule,
            ReactiveFormsModule, MatGridListModule, MatRadioModule, MatSelectModule],
  templateUrl: './monthly-customer-details.component.html',
  styleUrl: './monthly-customer-details.component.scss'
})
export class MonthlyCustomerDetailsComponent implements OnInit {

  monthlyStatuses = ['Active', 'InActive'];



  type: 'success' | 'error' | 'warning' = 'success';
  message: string = '';

  vehicleDetailsForm!: FormGroup;

  showAlert = false;
  // existingCustomer: boolean = false;
  vehicleTypes: VehicleType[] = [];

  advance= new FormControl<string>('');
  customerType = new FormControl<string>('monthly');
  monthlyStatus= new FormControl<string>('');
  fromDateMonthly= new FormControl<string>('');
  endDateMonthly= new FormControl<string>('');
  note = new FormControl<string>('');

  isStatusInActive: boolean = false;

  isNewMonthlyCustomer: boolean = true;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;
  isDailyPaidCustomer: boolean = false;
  dailyToMonthlyCustomer: boolean = false;
  dailyCustomerUnpaid: boolean = false;


  currentCustomer: string ='';

ngOnInit() {
  this.getVehicle();

  this.vehicleDetailsForm.get('vehicleType')?.valueChanges
    .pipe(
      startWith(this.vehicleDetailsForm.get('vehicleType')!.value) // pre-fill if editing
    )
    .subscribe((selectedType: string) => {
      if (!selectedType) return;

      const selectedVehicle = this.vehicleTypes.find(v => v.vehicleType === selectedType);
      if (!selectedVehicle) return;

      // Always use monthlyCost
      this.vehicleDetailsForm.get('amount')?.setValue(selectedVehicle.monthlyCost, { emitEvent: false });
    });
    
  const vehicleCtrl = this.vehicleDetailsForm.get('vehicleNumber');

  vehicleCtrl?.valueChanges
    .pipe(
      debounceTime(500),          
      distinctUntilChanged()
    )
    .subscribe(value => {
      if (value) {
        this.getCustomerDetails(value);
      }
    });
  this.monthlyStatus.valueChanges.subscribe(status => {
    this.onMonthlyStatusChange(status);
  });

  this.isNewMonthlyCustomer = true;

  const vehicleNbr = this.route.snapshot.queryParamMap.get('vehicleNbr');
  if (vehicleNbr) {
    this.getCustomerDetails(vehicleNbr);
  }
}

  constructor ( private newCustomerEntryService : NewCustomerEntryService,
                private fb: FormBuilder,
                private router: Router,
                private route: ActivatedRoute,
                private adminService: AdminService) {

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
      customerType: 'Monthly',
      address: [{ value: '', disabled: false }],
      amount: [{ value: '', disabled: true }],

    });
  }

  getVehicle() {
    this.adminService.getVehicleTypes().subscribe(data => {
      this.vehicleTypes = data;
      console.log(this.vehicleTypes);
    });
  }

  onMonthlyStatusChange(status: string | null) {  
    if (status === 'Active') {
      this.isStatusInActive = false;
      // this.isMonthlyActiveCustomer = true;
      // this.dailyToMonthlyCustomer = true;
      // this.isMonthlyInActiveCustomer = false
    } else if (status === 'InActive') {
      this.isStatusInActive = true;
      // this.isMonthlyActiveCustomer = false;
      // this.isMonthlyInActiveCustomer = true
    }
  }

  private normalizeVehicleNumber(value: string): string {
    return value
      .toUpperCase()
      .replace(/\s+/g, '')
      .trim();
  }

  getCustomerDetails = async(vehicleNbr: string) => {

    const vehicleNumber = vehicleNbr;

    if (!vehicleNumber ) {
      return;
    }
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNumber)
    const res = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr);
 
    this.currentCustomer = res.vehicleNumber;

    if (res && res.monthlyStatus === 'Active') {
      this.isNewMonthlyCustomer = false;
      this.isMonthlyInActiveCustomer = false;
      this.isMonthlyActiveCustomer = true;

      this.isStatusInActive = false;
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
      this.isNewMonthlyCustomer = false;
      this.isMonthlyInActiveCustomer = true;
      this.isMonthlyActiveCustomer = false;


      this.isStatusInActive = true;
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
    } else if (res && res.dailyStatus === 'paid'){
      this.isNewMonthlyCustomer = false;
      this.isMonthlyActiveCustomer = false;
      this.isMonthlyInActiveCustomer = false;
      this.dailyToMonthlyCustomer = true;
      this.showAlert = true;
      this.type = 'warning';
      this.message = 'This customer is an paid Daily Customer...';

      this.vehicleDetailsForm.patchValue({
        vehicleNumber: res.vehicleNumber,
        vehicleType: res.vehicleType,

        customerName: res.customerName,
        customerPhoneNbr: res.customerPhoneNbr,
        address: res.address,
      });
    } else if (res && res.dailyStatus === 'Unpaid') {
      this.dailyCustomerUnpaid = true;
      this.showAlert = true;
      this.type = 'error';
      this.message = 'Sorry... This customer is an Unpaid Daily Customer...';

    }
  }    

  private resetStandaloneControls() {
    this.advance.reset();
    this.monthlyStatus.reset();
    this.fromDateMonthly.reset();
    this.endDateMonthly.reset();
    this.note.reset();
  }

  private buildHistory(Entry: string | null, Exit: string | null, options?: { startDate?: any; endDate?: any;}) {

    const history: any = {
      Entry,
      Exit,
    };
  
    return history;
  }

  private normalizePayload(payload: any) {
    if (payload.vehicleNumber) {
      payload.vehicleNumber = this.normalizeVehicleNumber(payload.vehicleNumber);
    }
    return payload;
  }
  
  
  submitForm = async () => {
    if (this.vehicleDetailsForm.invalid) {
      this.vehicleDetailsForm.markAllAsTouched();
      return;
    }
  
    try {
  
      if (this.isNewMonthlyCustomer) {
  
        let payload = this.normalizePayload({ ...this.vehicleDetailsForm.value });
  
        const customerDetails = {
          ...payload,
          advance: this.advance.value,
          monthlyStatus: this.monthlyStatus.value,
          fromDateMonthly: this.fromDateMonthly.value,
          note: this.note.value
        };
  
        await this.newCustomerEntryService.addNewCustomerEntry(customerDetails);

        this.vehicleDetailsForm.reset();
        this.message = 'Customer Added Successfully...';
      }
      else if (this.isMonthlyInActiveCustomer) {
  
        const updatePayload: any = {
          monthlyStatus: 'Active',
          fromDateMonthly: this.fromDateMonthly.value,
          endDateMonthly: null,
          advance: this.advance.value
        };
  
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          updatePayload
        );
  
        this.message = 'Customer Updated Successfully...';
      }
  
      else if (this.isMonthlyActiveCustomer) {
  
        const updatePayload: any = {
          monthlyStatus: 'InActive',
          endDateMonthly: this.endDateMonthly.value
        };
  
        const historyPayload = this.buildHistory(
          this.fromDateMonthly.value,
          this.endDateMonthly.value,
        );
  
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          updatePayload,
          historyPayload
        );
  
        this.message = 'Customer Updated Successfully...';
      }
      else if (this.dailyToMonthlyCustomer) {
  
        let payload = this.normalizePayload({ ...this.vehicleDetailsForm.value });
  
        const customerDetails = {
          ...payload,
          advance: this.advance.value,
          monthlyStatus: this.monthlyStatus.value,
          fromDateMonthly: this.fromDateMonthly.value,
          endDateMonthly: null,
          note: this.note.value
        };
    
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          customerDetails,
        );
  
        this.vehicleDetailsForm.reset();
        this.message = 'Customer Converted to Monthly Successfully...';
      }
  
      this.showAlert = true;
  
    } catch (error) {
      this.showAlert = true;
      this.message = 'Something went wrong. Please try again.';
      console.error(error);
    } finally {
      this.resetStandaloneControls();
    }
  };
  

  cancelEntry() {

  }

  closeForm() {
    this.vehicleDetailsForm.reset();
    this.router.navigate(['/dashBoard'])
  }

}

