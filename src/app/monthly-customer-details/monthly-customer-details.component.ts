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
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    ButtonComponent,
    CommonModule,
    ReactiveFormsModule,
    ReactiveFormsModule,
    MatGridListModule,
    MatRadioModule,
    MatSelectModule,
  ],
  templateUrl: './monthly-customer-details.component.html',
  styleUrl: './monthly-customer-details.component.scss',
})
export class MonthlyCustomerDetailsComponent implements OnInit, OnDestroy {
  monthlyStatuses = ['Active', 'InActive'];

  type: 'success' | 'error' | 'warning' = 'success';
  message: string = '';

  vehicleDetailsForm!: FormGroup;

  showAlert = false;

  advance = new FormControl<string>('', [
    Validators.required,
    Validators.pattern('^[0-9]*$'),
  ]);
  customerType = new FormControl<string>('monthly', [Validators.required]);
  monthlyStatus = new FormControl<string>('', [Validators.required]);
  fromDateMonthly = new FormControl<string>('', [Validators.required]);
  endDateMonthly = new FormControl<string>('', [Validators.required]);
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

  currentCustomer: string = '';

  ngOnInit() {
    this.vehicleTypes$ = this.adminService.getVehicleTypes().pipe(take(1));

    this.vehicleDetailsForm
      .get('vehicleType')
      ?.valueChanges.pipe(
        withLatestFrom(this.vehicleTypes$),
        takeUntil(this.destroy$)
      )
      .subscribe(([selectedType, vehicleTypes]) => {
        const selectedVehicle = vehicleTypes.find(
          (v) => v.vehicleType === selectedType
        );
        if (selectedVehicle) {
          this.vehicleDetailsForm
            .get('amount')
            ?.setValue(selectedVehicle.monthlyCost, { emitEvent: true });
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
      .subscribe((value) => {
        if (value) {
          this.getCustomerDetails(value);
        }
      });
    this.monthlyStatus.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.onMonthlyStatusChange(status);
      });

    this.isNewMonthlyCustomer = true;

    const vehicleNbr = this.route.snapshot.queryParamMap.get('vehicleNbr');
    if (vehicleNbr) {
      this.getCustomerDetails(vehicleNbr);
    }
  }

  constructor(
    private newCustomerEntryService: NewCustomerEntryService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private adminService: AdminService
  ) {
    this.vehicleDetails();
  }

  close() {
    this.showAlert = false;
  }

  vehicleDetails = () => {
    this.vehicleDetailsForm = this.fb.group({
      vehicleNumber: [{ value: '', disabled: false }, [Validators.required]],
      vehicleType: [{ value: '', disabled: false }, [Validators.required]],
      customerName: [
        { value: '', disabled: false },
        [Validators.required, Validators.pattern(/^[A-Za-z ]+$/)],
      ],
      customerPhoneNbr: [
        { value: '', disabled: false },
        [Validators.required, Validators.pattern(/^[0-9]{10}$/)],
      ],
      customerType: ['Monthly'],
      address: [{ value: '', disabled: false }, [Validators.required]],
      amount: [{ value: '', disabled: false }, [Validators.required]],
    });
  };

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
    return (
      value
        .toUpperCase()
        // .replace(/\s+/g, '')
        .trim()
    );
  }

  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key = event.key;
  
    const rawValue = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const control = this.vehicleDetailsForm.get('vehicleNumber');
  
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(key))
      return;
  
    if (!/^[a-zA-Z0-9]$/.test(key)) {
      event.preventDefault();
      return;
    }
  
    control?.setErrors(null);
  
    // First 2 letters
    if (rawValue.length < 2 && !/^[A-Za-z]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ letterExpected: true });
      return;
    }
  
    // Next 2 digits
    if (rawValue.length >= 2 && rawValue.length < 4 && !/^[0-9]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ digitExpected: true });
      return;
    }
  
    // First series letter
    if (rawValue.length === 4 && !/^[A-Za-z]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ letterExpected: true });
      return;
    }
  
    // Optional second letter OR start digits
    if (rawValue.length === 5) {
      if (!/^[A-Za-z0-9]$/.test(key)) {
        event.preventDefault();
        return;
      }
    }
  
    // After digits start → only digits allowed
    if (rawValue.length >= 6 && !/^[0-9]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ digitExpected: true });
      return;
    }
  
    // Max length
    if (rawValue.length >= 10) {
      event.preventDefault();
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
      const firstDigitIndex = digitMatch
        ? remainder.indexOf(digitMatch[0])
        : -1;
  
      if (firstDigitIndex === -1) {
        formatted += ' ' + remainder.substring(0, 2);
      } else {
        const series = remainder.substring(0, firstDigitIndex);
  
        const digits = remainder
          .substring(firstDigitIndex)
          .replace(/[^0-9]/g, '')
          .substring(0, 4);
  
        formatted += ' ' + series + ' ' + digits;
      }
    }
  
    input.value = formatted.trim();
  
    this.vehicleDetailsForm
      .get('vehicleNumber')
      ?.setValue(input.value, { emitEvent: false });
  }

  restrictDigits(event: KeyboardEvent) {
    const key = event.key;

    if (
      [
        'Backspace',
        'Delete',
        'Tab',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
      ].includes(key)
    ) {
      return;
    }

    if (!/^[0-9]$/.test(key)) {
      event.preventDefault();
    }

    const input = event.target as HTMLInputElement;
    if (input.value.replace(/\D/g, '').length >= 10) {
      event.preventDefault();
    }
  }

  getCustomerDetails = async (vehicleNbr: string) => {
    const vehicleNumber = vehicleNbr;

    if (!vehicleNumber) {
      return;
    }
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNumber);
    const res = await this.newCustomerEntryService.getVehicleByNumber(
      formatedVehicleNbr,
      'vehicleNbr'
    );

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
    } else if (res && res.dailyStatus === 'paid') {
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
        amount: '',
      });
    }

    this.vehicleDetailsForm.markAsUntouched();
    this.markStandalonesAsUntouched();
    this.vehicleDetailsForm.updateValueAndValidity();
  };

  private markStandalonesAsUntouched() {
    [
      this.advance,
      this.monthlyStatus,
      this.fromDateMonthly,
      this.endDateMonthly,
      this.note,
    ].forEach((control) => {
      control.markAsUntouched();
      control.markAsPristine();
      control.updateValueAndValidity();
    });
  }

  private resetStandaloneControls() {
    this.advance.reset();
    this.monthlyStatus.reset();
    this.fromDateMonthly.reset();
    this.endDateMonthly.reset();
    this.note.reset();
  }

  private buildHistory(fromDate: string, endDate: string): any {
    if (!fromDate || !endDate) return null;
  
    return {
      vehicleNumber: this.currentCustomer, // The ID link
      startDate: fromDate,
      endDate: endDate,
      amountPaid: this.vehicleDetailsForm.get('amount')?.value,
      advancePaid: this.advance.value,
      note: this.note.value,
      completedAt: new Date().toISOString()
    };
  }

  private normalizePayload(payload: any) {
    if (payload.vehicleNumber) {
      payload.vehicleNumber = this.normalizeVehicleNumber(
        payload.vehicleNumber
      );
    }
    return payload;
  }

  isFormValid(): boolean {

    const isMainValid = this.vehicleDetailsForm.valid;

    const isEndDateRequired = this.monthlyStatus.value === 'InActive';

    const areStandalonesValid =
      this.advance.valid &&
      this.monthlyStatus.valid &&
      this.fromDateMonthly.valid &&
      this.note.valid &&
      (isEndDateRequired ? this.endDateMonthly.valid : true);

    if (!isMainValid || !areStandalonesValid) {

      this.vehicleDetailsForm.markAllAsTouched();
      this.advance.markAsTouched();
      this.monthlyStatus.markAsTouched();
      this.fromDateMonthly.markAsTouched();
      this.note.markAsTouched();
      if (isEndDateRequired) this.endDateMonthly.markAsTouched();

      this.logValidationErrors();
      return false;
    }

    return true;
  }

  private logValidationErrors() {
    Object.keys(this.vehicleDetailsForm.controls).forEach((key) => {
      const controlErrors = this.vehicleDetailsForm.get(key)?.errors;
      if (controlErrors) console.error('FormGroup Error:', key, controlErrors);
    });
    if (this.note.errors) console.error('Note Error:', this.note.errors);
  }

  submitForm = async () => {
    if (!this.isFormValid()) {
      this.showAlert = true;
      this.type = 'error';
      this.message = 'Please fill all required fields correctly.';
      return;
    }
  
    try {
      const formValue = this.vehicleDetailsForm.getRawValue();
      const normalizedData = this.normalizePayload({ ...formValue });
  
      const fullPayload = {
        ...normalizedData,
        advance: this.advance.value,
        monthlyStatus: this.monthlyStatus.value,
        fromDateMonthly: this.fromDateMonthly.value,
        note: this.note.value,
        endDateMonthly: this.monthlyStatus.value === 'Active' ? null : this.endDateMonthly.value,
      };
  
      if (this.isNewMonthlyCustomer) {
        await this.newCustomerEntryService.addNewCustomerEntry(fullPayload);
        this.message = 'New Customer Added Successfully!';
      } 
      else if (this.dailyToMonthlyCustomer) {
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(this.currentCustomer, fullPayload);
        this.message = 'Daily Customer converted to Monthly!';
      } 
      else {
        let updatePayload: any;
        let historyPayload: any = null;
  
        if (this.isMonthlyInActiveCustomer && this.monthlyStatus.value === 'Active') {
          updatePayload = {
            ...normalizedData,
            monthlyStatus: 'Active',
            fromDateMonthly: this.fromDateMonthly.value,
            endDateMonthly: null,
            advance: this.advance.value,
            note: this.note.value,
          };
          this.message = 'Customer Reactivated Successfully!';
        }
        else if (this.isMonthlyActiveCustomer && this.monthlyStatus.value === 'InActive') {
          updatePayload = {
            ...normalizedData,
            monthlyStatus: 'InActive',
            endDateMonthly: this.endDateMonthly.value,
            note: this.note.value,
          };

          historyPayload = this.buildHistory(
            this.fromDateMonthly.value ?? '',
            this.endDateMonthly.value ?? ''
          );
          this.message = 'Customer session saved to history and deactivated.';
        } 

        else {
          updatePayload = {
            ...normalizedData,
            advance: this.advance.value,
            fromDateMonthly: this.fromDateMonthly.value,
            note: this.note.value,
            monthlyStatus: this.monthlyStatus.value,
          };
          this.message = 'Customer Details Updated Successfully!';
        }
  
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          updatePayload,
          historyPayload
        );
      }
  
      this.type = 'success';
      this.showAlert = true;
      this.onSuccessCleanup();
  
    } catch (error) {
      this.type = 'error';
      this.showAlert = true;
      this.message = 'An error occurred while saving. Please try again.';
      console.error('Submission Error:', error);
    }
  };

  private onSuccessCleanup() {
    this.vehicleDetailsForm.reset({ customerType: 'Monthly' });
    this.resetStandaloneControls();

    setTimeout(() => {
      this.showAlert = false;
    }, 5000);
  }

  cancelEntry() {
    this.vehicleDetailsForm.reset();
    this.resetStandaloneControls();
  }

  closeForm() {
    this.vehicleDetailsForm.reset();
    this.router.navigate(['/dashBoard']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

