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
  monthlyStatus = new FormControl<string>('Active', [Validators.required]);
  fromDateMonthly = new FormControl<string>('', [Validators.required]);
  endDateMonthly = new FormControl<string>('', [Validators.required]);
  note = new FormControl<string>('', [Validators.required]);

  isStatusInActive: boolean = false;
  searchWithVehicleNbr = new FormControl<string | null>('');


  isNewMonthlyCustomer: boolean = true;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;
  isDailyPaidCustomer: boolean = false;
  dailyToMonthlyCustomer: boolean = false;
  dailyCustomerUnpaid: boolean = false;

  vehicleTypes$!: Observable<VehicleType[]>;
  private destroy$ = new Subject<void>();

  currentCustomer: string = '';

  minDate!: string;
  maxDate!: string;

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

    this.getMinDate();
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
      vehicleNumber: [{ value: '', disabled: false }, [Validators.required, Validators.pattern(/^[A-Z]{2}\s[0-9]{2}\s[A-Z]{1,2}\s[0-9]{4}$/)]],
      vehicleType: [{ value: '', disabled: false }, [Validators.required]],
      vehicleName: [{value: '', disabled: false}, [Validators.required]],
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
      this.reformatVehicleNumber(value).toUpperCase().trim()
    );
  }

  reformatVehicleNumber(value: any): string {
    if (typeof value !== 'string') return '';
    return value.toUpperCase().replace(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/, '$1 $2 $3 $4');
  }

  getMinDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    this.minDate = this.formatToISO(new Date(year, month, 1));
    this.maxDate = this.formatToISO(new Date(year, month + 1, 0));

    this.fromDateMonthly.valueChanges.subscribe(value => {
      if (value && this.isNewMonthlyCustomer) {
        if (value < this.minDate || value > this.maxDate) {
          this.fromDateMonthly.setValue('');
        }
      }
    });
  }

  formatToISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key = event.key;
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;
  
    const control = this.vehicleDetailsForm.get('vehicleNumber');

    const currentErrors = control?.errors;
    if (currentErrors) {
      delete currentErrors['letterExpected'];
      delete currentErrors['digitExpected'];
      control?.setErrors(Object.keys(currentErrors).length ? currentErrors : null);
    }
  
    const cursor = input.selectionStart ?? 0;
    const isDigit = /^[0-9]$/.test(key);
    const isLetter = /^[a-zA-Z]$/.test(key);
    
    const rawTotal = input.value.replace(/\s/g, '');
    const rawBefore = input.value.substring(0, cursor).replace(/\s/g, '');
    const rawIndex = rawBefore.length;
  
    if (!isDigit && !isLetter) return event.preventDefault();

    if (rawIndex >= 9 && isLetter) {
      return event.preventDefault();
    }
  
    if (rawIndex < 2 && !isLetter) {
      control?.setErrors({ ...control.errors, letterExpected: true });
      return event.preventDefault();
    } 
    
    if (rawIndex >= 2 && rawIndex < 4 && !isDigit) {
      control?.setErrors({ ...control.errors, digitExpected: true });
      return event.preventDefault();
    }
  
    if (rawIndex >= 4 && rawIndex < 6) {
      const remainder = rawTotal.substring(4);
      const digitCount = (remainder.match(/\d/g) || []).length;
  
      if (isDigit && digitCount >= 4) {
        control?.setErrors({ ...control.errors, letterExpected: true });
        return event.preventDefault();
      }

      if (rawIndex === 4 && !isLetter) {
        control?.setErrors({ ...control.errors, letterExpected: true });
        return event.preventDefault();
      }
    }
  

    if (rawIndex >= 6  && isLetter) {
      control?.setErrors({ ...control.errors, digitExpected: true });
      return event.preventDefault();
    }

    
  }

  onVehicleNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const oldCursor = input.selectionStart || 0;
    const oldVal = input.value;
  

    let raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
    let state = raw.substring(0, 2);
    let dist = raw.substring(2, 4);
    let rest = raw.substring(4);

    const seriesMatch = rest.match(/^[A-Z]+/);
    const series = seriesMatch ? seriesMatch[0].substring(0, 2) : '';

    const digitsMatch = rest.match(/\d+$/);
    const digits = digitsMatch ? digitsMatch[0].substring(0, 4) : '';
  
    let formatted = state;
    if (dist) formatted += ' ' + dist;
    if (series) formatted += ' ' + series;
    if (digits) formatted += ' ' + digits;
  
    input.value = formatted.trim();
    this.vehicleDetailsForm.get('vehicleNumber')?.setValue(input.value, { emitEvent: false });

    const diff = input.value.length - oldVal.length;
    input.setSelectionRange(oldCursor + diff, oldCursor + diff);
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

  getCustomerDetails = async (vehicleNbr?: string) => {
    if (!vehicleNbr){
      this.cancelEntry();
      return;
    }
  
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNbr);
    const res = await this.newCustomerEntryService.getVehicleByNumber(
      formatedVehicleNbr,
      'vehicleNbr'
    );
  
    this.currentCustomer = res?.vehicleNumber;  

    if (res && res.monthlyStatus) {
      this.cancelEntry();

      this.handleMonthlyCustomer(res);
    } 
    
    else if (res && res.dailyStatus) {
      this.handleDailyCustomer(res);
    } 
    
    else {
      this.handleNewCustomer();
    }
  
    this.finalizeFormState();
  };
  
  private handleMonthlyCustomer(res: any) {
    const isActive = res.monthlyStatus === 'Active';
    this.isNewMonthlyCustomer = false;
    this.isMonthlyActiveCustomer = isActive;
    this.isMonthlyInActiveCustomer = !isActive;
    this.isStatusInActive = !isActive;
  
    if (isActive) {
      this.endDateMonthly.reset();
    } else {
      this.endDateMonthly.setValue(res.endDateMonthly);
    }
  
    this.vehicleDetailsForm.patchValue({
      vehicleNumber: res.vehicleNumber,
      vehicleType: res.vehicleType,
      vehicleName: res.vehicleName,
      customerName: res.customerName,
      customerPhoneNbr: res.customerPhoneNbr,
      customerType: res.customerType,
      address: res.address,
      amount: res.amount,
    });
  
    this.advance.setValue(res.advance);
    this.monthlyStatus.setValue(res.monthlyStatus);
    this.fromDateMonthly.setValue(res.fromDateMonthly);
    this.note.setValue(res.note);
  }
  
  private handleDailyCustomer(res: any) {
    this.isNewMonthlyCustomer = false;
    this.isMonthlyActiveCustomer = false;
    this.isMonthlyInActiveCustomer = false;
    this.showAlert = true;
  
    if (res.dailyStatus === 'paid') {
      this.dailyToMonthlyCustomer = true;
      this.type = 'warning';
      this.message = 'This customer is a paid Daily Customer...';
      this.vehicleDetailsForm.patchValue({
        vehicleNumber: res.vehicleNumber,
        vehicleType: res.vehicleType,
        vehicleName: res.vehicleName,
        customerName: res.customerName,
        customerPhoneNbr: res.customerPhoneNbr,
        address: res.address,
      });
    } else {
      this.dailyCustomerUnpaid = true;
      this.type = 'error';
      this.message = 'Sorry... This customer is an Unpaid Daily Customer...';
    }
  }
  
  private handleNewCustomer() {
    this.isNewMonthlyCustomer = true;
    this.isMonthlyActiveCustomer = false;
    this.isMonthlyInActiveCustomer = false;

  
    const isUserTyping = this.vehicleDetailsForm.get('customerName')?.dirty || 
                         this.vehicleDetailsForm.get('customerPhoneNbr')?.dirty||
                         this.vehicleDetailsForm.get('vehicleType')?.dirty;
  
    if (!isUserTyping) {
      this.resetStandaloneControls();
      this.monthlyStatus.setValue('Active');
      this.vehicleDetailsForm.patchValue({
        vehicleType: '',
        vehicleName: '',
        customerName: '',
        customerPhoneNbr: '',
        address: '',
        amount: '',
      }, { emitEvent: false }); 
    }
  }
  
  private finalizeFormState() {
    this.vehicleDetailsForm.markAsUntouched();
    this.markStandalonesAsUntouched();
    this.vehicleDetailsForm.updateValueAndValidity();
  }

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
      vehicleNumber: this.currentCustomer,
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

      if(this.advance.value && (this.advance.value! > (this.vehicleDetailsForm?.get('amount')?.value))) {
        return false
      }

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
    }, 4000);
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

