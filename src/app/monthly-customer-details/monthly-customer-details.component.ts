import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../Common/button/button.component';
import { CommonModule } from '@angular/common';
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatRadioModule} from '@angular/material/radio';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSelectModule } from '@angular/material/select';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, filter, first, map, of, startWith, switchMap, take, takeUntil, withLatestFrom } from 'rxjs';
import { AdminService, VehicleType } from '../admin.service';
import { TransactionService } from '../transaction.service';


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
     const formattedVehicleNbr = this.reformatVehicleNumber(vehicleNbr);
      this.getCustomerDetails(formattedVehicleNbr);
    }

    this.getMinDate();
  }

  constructor(
    private newCustomerEntryService: NewCustomerEntryService,
    private transactionService: TransactionService,
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
      vehicleNumber: [
        { value: '', disabled: false },
        [
          Validators.required,
          Validators.pattern(/^[A-Z]{2}\s[0-9]{2}\s[A-Z]{1,2}\s[0-9]{4}$/),
        ],
      ],
      vehicleType: [{ value: '', disabled: false }, [Validators.required]],
      vehicleName: [{ value: '', disabled: false }, [Validators.required]],
      lotNumber: [{ value: '', disabled: false }, [Validators.required], [this.lotNumberOccupied()]],
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
    } else if (status === 'InActive') {
      this.isStatusInActive = true;
    }
  }

  private normalizeVehicleNumber(value: string): string {
    return this.reformatVehicleNumber(value).toUpperCase().trim();
  }

  reformatVehicleNumber(value: any): string {
    if (typeof value !== 'string') return '';
    return value
      .toUpperCase()
      .replace(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/, '$1 $2 $3 $4');
  }
  getMinDate = () => {
    const nowIST = this.getISTDate(); 
    const year = nowIST.getFullYear();
    const month = nowIST.getMonth(); 
  
    const startOfMonth = new Date(year, month, 1, 12, 0, 0); 
    const endOfMonth = new Date(year, month + 1, 0, 12, 0, 0);
  
    this.minDate = this.formatToISO(startOfMonth);
    this.maxDate = this.formatToISO(endOfMonth);
  
    // Validation Subscription
    this.fromDateMonthly.valueChanges.subscribe(value => {
      if (value && this.isNewMonthlyCustomer) {
        // String comparison works for ISO format (YYYY-MM-DD)
        if (value < this.minDate || value > this.maxDate) {
          this.fromDateMonthly.setValue('', { emitEvent: false });
        }
      }
    });
  };
  
  getISTDate(): Date {
    const now = new Date();
    // IST is UTC + 5:30
    const offset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + offset);
    return istTime;
  }
  
  formatToISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  isEndDateInvalid(): boolean {
    const start = this.fromDateMonthly.value;
    const end = this.endDateMonthly.value;
  
    // Since you are using YYYY-MM-DD strings, you can compare them directly
    if (start && end) {
      return end < start;
    }
    return false;
  }

  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key   = event.key;
  
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;
  
    const isDigit  = /^[0-9]$/.test(key);
    const isLetter = /^[a-zA-Z]$/.test(key);
  
    if (!isDigit && !isLetter) return event.preventDefault();
  
    const control  = this.vehicleDetailsForm.get('vehicleNumber');
    const cursor   = input.selectionStart ?? 0;
  
    const rawIndex = input.value.substring(0, cursor).replace(/\s/g, '').length;
    const rawTotal = input.value.replace(/\s/g, '');
  
    this.clearInlineErrors(control, ['letterExpected', 'digitExpected']);
  
    if (rawIndex < 2 && !isLetter) {
      control?.setErrors({ ...control.errors, letterExpected: true });
      return event.preventDefault();
    }
  
    if (rawIndex >= 2 && rawIndex < 4 && !isDigit) {
      control?.setErrors({ ...control.errors, digitExpected: true });
      return event.preventDefault();
    }
  
    const rawValue = rawTotal.toUpperCase();

    if (rawIndex === 4 && !isLetter) {
      control?.setErrors({ ...control.errors, letterExpected: true });
      return event.preventDefault();
    }
    
    if (rawIndex === 5 && !isLetter && !isDigit) {
      return event.preventDefault();
    }
    
    if (rawIndex > 5) {
      const hasTwoLetterSeries = /^[A-Z]{2}\d{2}[A-Z]{2}/.test(rawValue);
    
      const digitStart = hasTwoLetterSeries ? 6 : 5;
    
      if (rawIndex >= digitStart && !isDigit) {
        control?.setErrors({ ...control.errors, digitExpected: true });
        return event.preventDefault();
      }
    }
  }
  
  private clearInlineErrors(control: AbstractControl | null, keys: string[]): void {
    if (!control?.errors) return;
    const updated = { ...control.errors };
    keys.forEach(k => delete updated[k]);
    control.setErrors(Object.keys(updated).length ? updated : null);
  }
  
  onVehicleNumberInput(event: Event) {
    const input     = event.target as HTMLInputElement;
    const oldCursor = input.selectionStart ?? 0;
    const oldVal    = input.value;
  
    const raw    = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const state  = raw.substring(0, 2);
    const dist   = raw.substring(2, 4);
    const rest   = raw.substring(4);
    let series = '';
    let digits = '';

    if (/^[A-Z]{1}\d/.test(rest)) {
      series = rest.substring(0, 1);
      digits = (rest.substring(1).match(/^\d{1,4}/) ?? [''])[0];
    } else {
      series = (rest.match(/^[A-Z]{1,2}/) ?? [''])[0];
      digits = (rest.replace(/^[A-Z]+/, '').match(/^\d{1,4}/) ?? [''])[0];
    }
  
    const parts     = [state, dist, series, digits].filter(Boolean);
    const formatted = parts.join(' ');
  
    const rawCursorPos = this.getRawIndex(oldVal, oldCursor);
    const newCursor    = this.getFormattedIndex(formatted, rawCursorPos);
  
    input.value = formatted;
  
    this.vehicleDetailsForm
      .get('vehicleNumber')
      ?.setValue(formatted, { emitEvent: false });
  
    input.setSelectionRange(newCursor, newCursor);
    setTimeout(() => input.setSelectionRange(newCursor, newCursor), 0);
  }
  
  private getRawIndex(value: string, cursorPos: number): number {
    return value.substring(0, cursorPos).replace(/\s/g, '').length;
  }
  
  private getFormattedIndex(formatted: string, rawIndex: number): number {
    let rawCount = 0;
  
    for (let i = 0; i < formatted.length; i++) {
      if (rawCount === rawIndex) return i;
      if (formatted[i] !== ' ') rawCount++;
    }
  
    return formatted.length;
  }

  lotNumberOccupied(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) return of(null);

      // const status = control.parent?.get('monthlyStatus')?.value;
      // if (status === 'InActive') return of(null);
  
      return of(control.value).pipe(
        debounceTime(300),
        switchMap(lotNumber =>
          this.newCustomerEntryService.getActiveLotNumbers().pipe(
            map(activeLots => {
              const isOccupied = activeLots.some(
                lot => String(lot.lotNumber) === String(lotNumber)
              );
              return isOccupied ? { lotOccupied: true } : null;
            }),
            catchError(() => of(null))
          )
        ),
        first()
      );
    };
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
    if (!vehicleNbr) {
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
    } else if (res && res.dailyStatus) {
      this.handleDailyCustomer(res);
    } else {
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
      lotNumber: res.lotNumber
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
        lotNumber: res.lotNumber
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

    const isUserTyping =
      this.vehicleDetailsForm.get('customerName')?.dirty ||
      this.vehicleDetailsForm.get('customerPhoneNbr')?.dirty ||
      this.vehicleDetailsForm.get('vehicleType')?.dirty;

    if (!isUserTyping) {
      this.resetStandaloneControls();
      this.monthlyStatus.setValue('Active');
      this.vehicleDetailsForm.patchValue(
        {
          vehicleType: '',
          vehicleName: '',
          customerName: '',
          customerPhoneNbr: '',
          address: '',
          amount: '',
          lotNumber: ''
        },
        { emitEvent: false }
      );
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
    const isMainValid = this.isNewMonthlyCustomer
      ? this.vehicleDetailsForm.valid                   
      : this.vehicleDetailsForm.valid ||                  
        this.isLotNumberOnlyInvalid();
  
    const isEndDateRequired = this.monthlyStatus.value === 'InActive';
  
    const areStandalonesValid =
      this.advance.valid &&
      this.monthlyStatus.valid &&
      this.fromDateMonthly.valid &&
      this.note.valid &&
      (isEndDateRequired ? this.endDateMonthly.valid : true);
  
    if (
      this.advance.value &&
      this.advance.value! > this.vehicleDetailsForm?.get('amount')?.value
    ) {
      return false;
    }
  
    if (this.monthlyStatus.value === 'InActive') {
      return true;
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

  isLotNumberOnlyInvalid(): boolean {
    const controls = this.vehicleDetailsForm.controls;
    const invalidControls = Object.keys(controls).filter(
      key => controls[key].invalid
    );
    return invalidControls.length === 0 ||
      (invalidControls.length === 1 && invalidControls[0] === 'lotNumber');
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
      this.type      = 'error';
      this.message   = 'Please fill all required fields correctly.';
      return;
    }
  
    try {
      const formValue      = this.vehicleDetailsForm.getRawValue();
      const normalizedData = this.normalizePayload({ ...formValue });
  
      const fullPayload = {
        ...normalizedData,
        advance:         this.advance.value,
        monthlyStatus:   this.monthlyStatus.value,
        fromDateMonthly: this.fromDateMonthly.value,
        note:            this.note.value,
        endDateMonthly:  this.monthlyStatus.value === 'Active' ? null : this.endDateMonthly.value,
      };
  
      // ── New customer ───────────────────────────────────────
      if (this.isNewMonthlyCustomer) {
        await this.newCustomerEntryService.addNewCustomerEntry(fullPayload);
        this.message = 'New Customer Added Successfully!';
  
      // ── Daily → Monthly conversion ─────────────────────────
      } else if (this.dailyToMonthlyCustomer) {
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          fullPayload
        );
        this.message = 'Daily Customer converted to Monthly!';
  
      // ── Existing customer updates ──────────────────────────
      } else {
        await this.handleExistingCustomerUpdate(normalizedData);
      }
  
      this.type      = 'success';
      this.showAlert = true;
      this.onSuccessCleanup();
  
    } catch (error) {
      this.type      = 'error';
      this.showAlert = true;
      this.message   = 'An error occurred while saving. Please try again.';
      console.error('Submission Error:', error);
    }
  };
  
  private async handleExistingCustomerUpdate(normalizedData: any): Promise<void> {
    let updatePayload: any;
    let historyPayload: any = null;
  
    // ── Reactivate inactive monthly customer ───────────────
    if (this.isMonthlyInActiveCustomer && this.monthlyStatus.value === 'Active') {
      updatePayload = {
        ...normalizedData,
        monthlyStatus:   'Active',
        fromDateMonthly: this.fromDateMonthly.value,
        endDateMonthly:  null,
        advance:         this.advance.value,
        note:            this.note.value,
      };
  
      await this.newCustomerEntryService.initializeMonthlyLedger(
        normalizedData.vehicleNumber,
        this.endDateMonthly.value,
        this.fromDateMonthly.value,
        normalizedData.amount
      );
  
      this.message = 'Customer Reactivated Successfully!';
  
    // ── Deactivate active monthly customer ─────────────────
    } else if (this.isMonthlyActiveCustomer && this.monthlyStatus.value === 'InActive') {
      updatePayload = {
        ...normalizedData,
        monthlyStatus:  'InActive',
        lotNumber:      null,
        endDateMonthly: this.endDateMonthly.value,
        note:           this.note.value,
      };
  
      historyPayload = this.buildHistory(
        this.fromDateMonthly.value ?? '',
        this.endDateMonthly.value ?? ''
      );
  
      this.transactionService.makeIdelTransactionForInactiveCustomer(
        normalizedData.vehicleNumber,
        this.endDateMonthly.value
      );
  
      this.message = 'Customer session saved to history and deactivated.';
  
    // ── General update ─────────────────────────────────────
    } else {
      updatePayload = {
        ...normalizedData,
        advance:         this.advance.value,
        fromDateMonthly: this.fromDateMonthly.value,
        note:            this.note.value,
        monthlyStatus:   this.monthlyStatus.value,
      };
  
      this.message = 'Customer Details Updated Successfully!';
    }
  
    await this.newCustomerEntryService.updateCustomerByVehicleNumber(
      this.currentCustomer,
      updatePayload,
      historyPayload
    );
  }

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

