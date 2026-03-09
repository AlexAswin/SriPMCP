import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../Common/button/button.component';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatRadioModule} from '@angular/material/radio';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSelectModule } from '@angular/material/select';
import { Observable, Subject, debounceTime, distinctUntilChanged, filter, startWith, take, takeUntil, withLatestFrom } from 'rxjs';
import { AdminService, VehicleType } from '../admin.service';


@Component({
  selector: 'app-monthly-customer-details',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ButtonComponent, CommonModule, ReactiveFormsModule,
            ReactiveFormsModule, MatGridListModule, MatRadioModule, MatSelectModule],
  templateUrl: './monthly-customer-details.component.html',
  styleUrl: './monthly-customer-details.component.scss'
})
export class MonthlyCustomerDetailsComponent implements OnInit, OnDestroy {

  monthlyStatuses = ['Active', 'InActive'];



  type: 'success' | 'error' | 'warning' = 'success';
  message: string = '';

  vehicleDetailsForm!: FormGroup;

  showAlert = false;
  // existingCustomer: boolean = false;
  // vehicleTypes: VehicleType[] = [];

  advance= new FormControl<string>('', [Validators.required, Validators.pattern('^[0-9]*$')]);
  customerType = new FormControl<string>('monthly', [Validators.required]);
  monthlyStatus= new FormControl<string>('', [Validators.required]);
  fromDateMonthly= new FormControl<string>('', [Validators.required]);
  endDateMonthly= new FormControl<string>('', [Validators.required]);
  note = new FormControl<string>('', [Validators.required]);

  isStatusInActive: boolean = false;

  isNewMonthlyCustomer: boolean = true;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;
  isDailyPaidCustomer: boolean = false;
  dailyToMonthlyCustomer: boolean = false;
  dailyCustomerUnpaid: boolean = false;

  vehicleTypes$!: Observable<VehicleType[]>;
  private destroy$ = new Subject<void>();



  currentCustomer: string ='';

ngOnInit() {
  this.vehicleTypes$ = this.adminService.getVehicleTypes().pipe(take(1));

  this.vehicleDetailsForm.get('vehicleType')?.valueChanges
  .pipe(
    withLatestFrom(this.vehicleTypes$),
    takeUntil(this.destroy$)
  )
  .subscribe(([selectedType, vehicleTypes]) => {
    const selectedVehicle = vehicleTypes.find(v => v.vehicleType === selectedType);
    if (selectedVehicle) {
      this.vehicleDetailsForm.get('amount')?.setValue(selectedVehicle.monthlyCost, { emitEvent: true });
    }
  });
    
  const vehicleCtrl = this.vehicleDetailsForm.get('vehicleNumber');

  vehicleCtrl?.valueChanges
    .pipe(
      debounceTime(500),          
      distinctUntilChanged(),
      // filter(value => value?.length >= 9 ),
      takeUntil(this.destroy$)
    )
    .subscribe(value => {
      if (value) {
        this.getCustomerDetails(value);
      }
    });
  this.monthlyStatus.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(status => {
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
      vehicleNumber: [
        { value: '', disabled: false }, 
        [Validators.required,  this.VehicleNumberValidator]
      ],
      vehicleType: [
        { value: '', disabled: false },
        [Validators.required]
      ],
      customerName: [
        { value: '', disabled: false },
        [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)] 
      ],
      customerPhoneNbr: [
        { value: '', disabled: false },
        [Validators.required, Validators.pattern(/^[0-9]{10}$/)] 
      ],
      customerType: ['Monthly'],
      address: [
        { value: '', disabled: false },
        [Validators.required]
      ],
      amount: [
        { value: '', disabled: false },
        [Validators.required]
      ]
    });
  }

  VehicleNumberValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
  
    const value = control.value.replace(/\s/g, '').toUpperCase();
    const pattern = /^[A-Z]{2}[0-9]{6,7}$/;
  
    return pattern.test(value) ? null : { invalidVehicleNumber: true };
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
      // .replace(/\s+/g, '')
      .trim();
  }

  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    const rawValue = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const control = this.vehicleDetailsForm.get('vehicleNumber');
  
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

    if (!/^[a-zA-Z0-9]$/.test(key)) {
      event.preventDefault();
      return;
    }
  
    control?.setErrors(null);

    if (rawValue.length < 2 && !/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ letterExpected: true });
      return;
    }
 
    if (rawValue.length >= 2 && rawValue.length < 4 && !/^[0-9]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ digitExpected: true });
      return;
    }

    if (rawValue.length === 4 && !/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ letterExpected: true });
      return;
    }

    if (rawValue.length >= 9) {
      const hasTwoLetterSeries = /^[A-Z]{2}[0-9]{2}[A-Z]{2}/.test(rawValue);
      if (!hasTwoLetterSeries && rawValue.length === 9 && /^[0-9]$/.test(key)) {
        if (/^[0-9]$/.test(rawValue[5])) {
           event.preventDefault();
        }
      }
  
      if (rawValue.length >= 10) {
        event.preventDefault();
      }
    }
  }
  
  onVehicleNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    raw = raw.substring(0, 10);
  
    let formatted = '';
    if (raw.length > 0) formatted += raw.substring(0, 2);
    if (raw.length > 2) formatted += ' ' + raw.substring(2, 4); 
    
    if (raw.length > 4) {
      const remainder = raw.substring(4);
      const digitMatch = remainder.match(/\d/); 
      const firstDigitIndex = digitMatch ? remainder.indexOf(digitMatch[0]) : -1;
  
      if (firstDigitIndex === -1) {
        formatted += ' ' + remainder.substring(0, 2);
      } else {
        const series = remainder.substring(0, firstDigitIndex);
        const digits = remainder.substring(firstDigitIndex, firstDigitIndex + 4);
        formatted += ' ' + series + ' ' + digits;
      }
    }
  
    input.value = formatted.trim();
    this.vehicleDetailsForm.get('vehicleNumber')?.setValue(input.value, { emitEvent: false });
  }

  restrictDigits(event: KeyboardEvent) {
    const key = event.key;
  
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
      return;
    }

    if (!/^[0-9]$/.test(key)) {
      event.preventDefault();
    }

    const input = event.target as HTMLInputElement;
    if (input.value.replace(/\D/g, '').length >= 10) {
      event.preventDefault();
    }

    this.advance.setErrors({ pattern: true });
  }
  

  getCustomerDetails = async(vehicleNbr: string) => {

    const vehicleNumber = vehicleNbr;

    if (!vehicleNumber ) {
      return;
    }
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNumber)
    const res = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr, 'vehicleNbr');
 
    this.currentCustomer = res?.vehicleNumber;

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
    } else {
      this.isNewMonthlyCustomer = true;
      this.isMonthlyActiveCustomer = false;
      this.isMonthlyInActiveCustomer = false;
      this.resetStandaloneControls();
      this.vehicleDetailsForm.patchValue({
        vehicleType: '',
        customerName: '',
        customerPhoneNbr: '',
        address: '',
        amount: ''
      });
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

isFormValid(): boolean {
  // 1. Mark everything as touched so error messages appear in the UI
  this.vehicleDetailsForm.markAllAsTouched();
  this.advance.markAsTouched();
  this.customerType.markAsTouched();
  this.monthlyStatus.markAsTouched();
  this.fromDateMonthly.markAsTouched();
  this.note.markAsTouched();
  
  // Conditionally check endDate if status is InActive
  if (this.monthlyStatus.value === 'InActive') {
    this.endDateMonthly.markAsTouched();
  }

  // 2. Aggregate validity
  const isMainFormValid = this.vehicleDetailsForm.valid;
  const areStandaloneValid = 
    this.advance.valid && 
    this.customerType.valid && 
    this.monthlyStatus.valid && 
    this.fromDateMonthly.valid && 
    this.note.valid &&
    (this.monthlyStatus.value === 'InActive' ? this.endDateMonthly.valid : true);

  return isMainFormValid && areStandaloneValid;
}
  
  
submitForm = async () => {
  // 1. Check aggregate validity
  if (!this.isFormValid()) {
    this.showAlert = true;
    this.type = 'error'; // Ensure your alert turns red
    this.message = 'Please fill all required fields correctly.';
    return;
  }

  try {
    const formValue = this.vehicleDetailsForm.value;
    
    // Helper to get common standalone values
    const standaloneValues = {
      advance: this.advance.value,
      monthlyStatus: this.monthlyStatus.value,
      fromDateMonthly: this.fromDateMonthly.value,
      note: this.note.value
    };

    if (this.isNewMonthlyCustomer) {
      let payload = this.normalizePayload({ ...formValue });
      const customerDetails = { ...payload, ...standaloneValues };

      await this.newCustomerEntryService.addNewCustomerEntry(customerDetails);
      this.message = 'Customer Added Successfully...';
      this.type = 'success';
    } 
    else if (this.isMonthlyInActiveCustomer) {
      const updatePayload = {
        monthlyStatus: 'Active',
        fromDateMonthly: this.fromDateMonthly.value,
        endDateMonthly: null,
        advance: this.advance.value
      };

      await this.newCustomerEntryService.updateCustomerByVehicleNumber(this.currentCustomer, updatePayload);
      this.message = 'Customer Updated Successfully...';
      this.type = 'success';
    } 
    else if (this.isMonthlyActiveCustomer) {
      const updatePayload = {
        monthlyStatus: 'InActive',
        endDateMonthly: this.endDateMonthly.value,
        note: this.note.value
      };

      const historyPayload = this.buildHistory(this.fromDateMonthly.value, this.endDateMonthly.value);
      await this.newCustomerEntryService.updateCustomerByVehicleNumber(this.currentCustomer, updatePayload, historyPayload);
      this.message = 'Customer Updated Successfully...';
      this.type = 'success';
    } 
    else if (this.dailyToMonthlyCustomer) {
      let payload = this.normalizePayload({ ...formValue });
      const customerDetails = { ...payload, ...standaloneValues, endDateMonthly: null };

      await this.newCustomerEntryService.updateCustomerByVehicleNumber(this.currentCustomer, customerDetails);
      this.message = 'Customer Converted to Monthly Successfully...';
      this.type = 'success';
    }

    // Reset Form after successful operation
    this.vehicleDetailsForm.reset({ customerType: 'Monthly' });
    this.resetStandaloneControls();
    this.showAlert = true;

  } catch (error) {
    this.showAlert = true;
    this.type = 'error';
    this.message = 'Something went wrong. Please try again.';
    console.error(error);
  }
};
  

  cancelEntry() {
    this.vehicleDetailsForm.reset();
    this.resetStandaloneControls();
  }

  closeForm() {
    this.vehicleDetailsForm.reset();
    this.router.navigate(['/dashBoard'])
  }


ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}

}

