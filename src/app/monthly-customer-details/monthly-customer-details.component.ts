import { Component, OnDestroy, OnInit } from '@angular/core';
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

  advance= new FormControl<string>('', [Validators.required]);
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
      filter(value => value?.length >= 9 ),
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
        [Validators.required, Validators.pattern(/^[A-Z]{2} [0-9]{2} [A-Z]{2} [0-9]{4}$/)]
      ],
      vehicleType: [
        { value: '', disabled: false },
        [Validators.required]
      ],
      customerName: [
        { value: '', disabled: false },
        [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)] // Only letters & spaces
      ],
      customerPhoneNbr: [
        { value: '', disabled: false },
        [Validators.required, Validators.pattern(/^[0-9]{10}$/)] // Exactly 10 digits
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

  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key = event.key;
  
    // Allow control keys
    if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(key)) return;
  
    const rawValue = input.value.replace(/ /g, '');
    const position = rawValue.length;
  
    const letterPositions = [0, 1, 4, 5];
    const digitPositions = [2, 3, 6, 7, 8, 9];
  
    const control = this.vehicleDetailsForm.get('vehicleNumber');
  
    // Reset previous custom errors
    control?.setErrors(null);
  
    if (letterPositions.includes(position) && !/^[A-Z]$/i.test(key)) {
      event.preventDefault();
      control?.setErrors({ letterExpected: true });
    }
  
    if (digitPositions.includes(position) && !/^[0-9]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ digitExpected: true });
    }
  
    // Max 10 chars
    if (rawValue.length >= 10) {
      event.preventDefault();
    }
  }

  onVehicleNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase();
  
    // Remove non-alphanumeric
    value = value.replace(/[^A-Z0-9]/g, '');
  
    // Limit to 10 characters
    value = value.substring(0, 10);
  
    let formatted = '';
  
    if (value.length > 0) {
      formatted += value.substring(0, 2);
    }
  
    if (value.length >= 3) {
      formatted += ' ' + value.substring(2, 4);
    }
  
    if (value.length >= 5) {
      formatted += ' ' + value.substring(4, 6);
    }
  
    if (value.length >= 7) {
      formatted += ' ' + value.substring(6, 10);
    }
  
    input.value = formatted;
  
    this.vehicleDetailsForm.get('vehicleNumber')?.setValue(
      formatted,
      { emitEvent: false }
    );
  }

  restrictDigits(event: KeyboardEvent) {
    const key = event.key;
  
    // Allow control keys
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
      return;
    }
  
    // Only allow digits
    if (!/^[0-9]$/.test(key)) {
      event.preventDefault();
    }
  
    // Optional: max length check
    const input = event.target as HTMLInputElement;
    if (input.value.replace(/\D/g, '').length >= 10) {
      event.preventDefault();
    }
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

    this.advance.markAsTouched();
    this.customerType.markAsTouched();
    this.monthlyStatus.markAsTouched();
    this.fromDateMonthly.markAsTouched();
    this.endDateMonthly.markAsTouched();
    this.note.markAsTouched();
    
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

        this.vehicleDetailsForm.reset({
          customerType: 'Monthly'
        });
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
          endDateMonthly: this.endDateMonthly.value,
          note: this.note.value
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
        this.vehicleDetailsForm.reset({
          customerType: 'Monthly'
        });
  
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
  
        this.vehicleDetailsForm.reset({
          customerType: 'Monthly'
        });
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


ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}

}

