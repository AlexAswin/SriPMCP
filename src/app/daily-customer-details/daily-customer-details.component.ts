import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../Common/button/button.component';
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, Subject, catchError, combineLatest, debounceTime, distinctUntilChanged, filter, first, from, map, of, startWith, switchMap, take, takeUntil, withLatestFrom } from 'rxjs';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { AdminService, VehicleType } from '../admin.service';


@Component({
  selector: 'app-daily-customer-details',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
    ReactiveFormsModule,
    CommonModule,
    MatIconModule,
    MatOptionModule,
    MatSelectModule,
  ],
  templateUrl: './daily-customer-details.component.html',
  styleUrl: './daily-customer-details.component.scss',
})
export class DailyCustomerDetailsComponent implements OnInit, OnDestroy {
  vehicleDetailsForm!: FormGroup;

  type: 'success' | 'error' | 'warning' | 'info' = 'success';
  message: string = '';
  showAlert = false;

  disabled: boolean = false;

  dailystatus = ['paid', 'Unpaid'];
  currentCustomer: string = '';

  isNewDailyCustomer: boolean = false;
  isDailyUnpaidCustomer: boolean = false;
  isDailyPaidCustomer: boolean = false;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;

  billNbr = new FormControl<number | null>(null, [Validators.required]);
  dailyStatus = new FormControl<string>('Unpaid', [Validators.required]);
  fromDateDaily = new FormControl<string | null>(null, [Validators.required]);
  entryTime = new FormControl<string | null>('00:00', [Validators.required]);

  endDateDaily = new FormControl<string | null>(null, [Validators.required]);
  exitTime = new FormControl<string | null>(null);
  billAmount = new FormControl<string | number>('');
  currentCustomerBillNbr: number | null = null;

  actualCost = new FormControl<number>( 0, [Validators.required]);
  settledCost = new FormControl<number>(0, [
    Validators.required,
    Validators.pattern('^[0-9]*$'),
    this.maxCostValidator()
  ]);
  totalDays = new FormControl<number>(0, [Validators.required]);


  note = new FormControl<string>('');

  appxexitTime: string = '';
  showPaidDetails: boolean = false;
  alreadyPaid: boolean = false;
  private destroy$ = new Subject<void>();
  vehicleTypes$!: Observable<VehicleType[]>;

  hours = Array.from({ length: 12 }, (_, i) => i + 1);
  minutes = [0, 15, 30, 45];

  entryHour = new FormControl<number | null>({ value: null, disabled: false }, Validators.required);
  entryMinute = new FormControl<number | null>(null, Validators.required);
  entryPeriod = new FormControl<string>('AM');

  exitHour = new FormControl<number | null>(null, Validators.required);
  exitMinute = new FormControl<number | null>(null, Validators.required);
  exitPeriod = new FormControl<string>('AM');

  isBillNumberTaken = false;
  isCheckingBillNumber = false;

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
            ?.setValue(selectedVehicle.dailyCost, { emitEvent: false });
        }
      });

    const vehicleCtrl = this.vehicleDetailsForm.get('vehicleNumber');

    vehicleCtrl?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((value) => value?.length >= 9),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        if (value) {
          this.getCustomerDetails(value);
        }
      });

      if (!this.isNewDailyCustomer) {
        this.billNbr.valueChanges.pipe(
          debounceTime(500),
          distinctUntilChanged(),
          filter(value => value !== null && value !== 0),
          filter(() => this.billNbr.value !== this.currentCustomerBillNbr), // ✅ Skip if same customer
          switchMap(value => {
            this.isCheckingBillNumber = true;
            this.isBillNumberTaken = false;
            return from(this.newCustomerEntryService.isBillNumberTaken(value as number));
          }),
          takeUntil(this.destroy$)
        ).subscribe(isTaken => {
          this.isCheckingBillNumber = false;
          this.isBillNumberTaken = isTaken;
        });
      }

      

    this.isNewDailyCustomer = true;

    const vehicleNbr = this.route.snapshot.queryParamMap.get('vehicleNbr');

    if (vehicleNbr) {
      vehicleCtrl?.setValue(vehicleNbr, { emitEvent: true });
      const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNbr);
      this.getCustomerDetails(formatedVehicleNbr);
    }
  }

  constructor(
    private newCustomerEntryService: NewCustomerEntryService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {
    this.vehicleDetails();
  }

  vehicleDetails = () => {
    this.vehicleDetailsForm = this.fb.group({
      vehicleNumber: [{ value: '', disabled: false }, Validators.required],
      vehicleType: [{ value: '', disabled: false }, Validators.required],
      vehicleName: [{ value: '', disabled: false }, [Validators.required]],

      customerName: [{ value: '', disabled: false }, Validators.required],
      customerPhoneNbr: [{ value: '', disabled: false }, Validators.required],
      address: [{ value: '', disabled: false }, Validators.required],

      customerType: 'Daily',
      amount: [{ value: '', disabled: false }],
    });
  };

  onDailyStatusChange(status: string) {
    if (status === 'paid') {
      this.alreadyPaid = true;
      this.disabled = false;
  
      this.actualCost.setValidators([Validators.required]);
      this.endDateDaily.setValidators([Validators.required]);
    } else {
      this.alreadyPaid = false;
      this.disabled = false;
  
      this.actualCost.clearValidators();
      this.endDateDaily.clearValidators();
  
      this.fromDateDaily.reset();
      this.endDateDaily.reset();
      this.note.reset();
      this.entryHour.reset();
      this.entryMinute.reset();
      this.entryPeriod.reset('AM');
      this.actualCost.reset();
      this.exitHour.reset();
      this.exitMinute.reset();
      this.exitPeriod.reset();
      this.settledCost.reset();
      this.totalDays.reset();
    }
  
    this.actualCost.updateValueAndValidity();
    this.endDateDaily.updateValueAndValidity();
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

    if (rawValue.length < 2 && !/^[A-Za-z]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ letterExpected: true });
      return;
    }

    if (rawValue.length >= 2 && rawValue.length < 4 && !/^[0-9]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ digitExpected: true });
      return;
    }

    if (rawValue.length === 4 && !/^[A-Za-z]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ letterExpected: true });
      return;
    }

    if (rawValue.length === 5) {
      if (!/^[A-Za-z0-9]$/.test(key)) {
        event.preventDefault();
        return;
      }
    }

    if (rawValue.length >= 6 && !/^[0-9]$/.test(key)) {
      event.preventDefault();
      control?.setErrors({ digitExpected: true });
      return;
    }

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

  getVehicleNbrAndCheckForExistence = () => {
    const vehicleNbr = this.vehicleDetailsForm.get('vehicleNumber');
    if (!vehicleNbr) {
      return;
    }
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNbr.value);
    this.getCustomerDetails(formatedVehicleNbr);
  };

  getCustomerDetails = async (vehicleNbr: string) => {
    if (!vehicleNbr) return;

    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNbr);
    const res = await this.newCustomerEntryService.getVehicleByNumber(
      formatedVehicleNbr,
      'vehicleNbr'
    );

    this.showAlert = false;

    if (!res) {
      this.isNewDailyCustomer = true;
      return;
    }

    this.currentCustomer = res.vehicleNumber;

    if (res.dailyStatus === 'Unpaid') {
      this.isDailyUnpaidCustomer = true;
      this.isNewDailyCustomer = false;
      this.isDailyPaidCustomer = false;
      this.isMonthlyActiveCustomer = false;

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

      this.billNbr.setValue(res.billNumber, { emitEvent: false });
      this.currentCustomerBillNbr = res.billNumber;
      this.dailyStatus.setValue(res.dailyStatus);
      this.fromDateDaily.setValue(res.fromDateDaily);
      this.entryTime.setValue(res.entryTime);
      this.note.setValue(res.note);
      this.setEntryTime(res.entryTime);

      this.entryHour.disable();
      this.entryMinute.disable();
      this.entryPeriod.disable();
      this.cdr.detectChanges();

      this.disabled = true;

      this.calculateBillAmount(res.fromDateDaily, res.entryTime);
    } else if (res.dailyStatus === 'paid') {
      this.isDailyUnpaidCustomer = false;
      this.isNewDailyCustomer = false;
      this.isDailyPaidCustomer = true;
      this.alreadyPaid = true;

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

      this.billNbr.setValue(res.billNumber, { emitEvent: false });
      this.currentCustomerBillNbr = res.billNumber;
      this.dailyStatus.setValue(res.dailyStatus);
      this.fromDateDaily.setValue(res.fromDateDaily);
      this.setEntryTime(res.entryTime)
      this.billAmount.setValue(res.billAmount);
      this.endDateDaily.setValue(res.endDateDaily);
      this.setExitTime(res.exitTime);
      this.actualCost.setValue(res.actualCost);
      this.settledCost.setValue(res.settledCost);
      this.totalDays.setValue(res.totalDays);
      this.note.setValue(res.note);
      this.disabled = true;
    } else if (res.monthlyStatus === 'Active') {
      this.isMonthlyActiveCustomer = true;
      this.showAlert = true;
      this.type = 'error';
      this.message = 'Error: This is an Active Monthly Customer.';
    } else if (res.monthlyStatus === 'InActive') {
      this.isNewDailyCustomer = false;
      this.isDailyPaidCustomer = false;
      this.isDailyUnpaidCustomer = false;
      this.isMonthlyActiveCustomer = false;
      this.isMonthlyInActiveCustomer = true;

      this.vehicleDetailsForm.patchValue({
        vehicleNumber: res.vehicleNumber,
        vehicleType: res.vehicleType,
        vehicleName: res.vehicleName,
        customerName: res.customerName,
        customerPhoneNbr: res.customerPhoneNbr,
        address: res.address,
      });

      this.showAlert = true;
      this.type = 'warning';
      this.message =
        'Previous Monthly Customer detected. Ready for Daily entry.';
    } else {
      this.isNewDailyCustomer = true;
      this.resetFormForNewCustomer();
      this.currentCustomerBillNbr = null;
      this.message = 'New vehicle detected. Please enter details.';
      this.type = 'info';
      this.showAlert = true;
    }
  };

  private resetFormForNewCustomer() {
    this.vehicleDetailsForm.reset({
      customerType: 'Daily',
      vehicleNumber: this.vehicleDetailsForm.get('vehicleNumber')?.value,
    });

    this.billNbr.setValue(0);
    this.dailyStatus.setValue('Unpaid');
    this.endDateDaily.setValue(null);
    this.exitTime.setValue(null);
    this.billAmount.setValue('');
    this.actualCost.setValue(0);
    this.note.setValue('');

    this.isDailyUnpaidCustomer = false;
    this.isDailyPaidCustomer = false;
    this.isMonthlyActiveCustomer = false;
    this.isMonthlyInActiveCustomer = false;
    this.alreadyPaid = false;
    this.showPaidDetails = false;

    this.vehicleDetailsForm.markAsPristine();
    this.vehicleDetailsForm.markAsUntouched();
  }

  maxCostValidator() {
    return (control: AbstractControl) => {
      const settled = Number(control.value);
      const actual = Number(this.actualCost.value ?? 0);
      if (settled > actual) {
        return { exceedsActual: true };
      }
      return null;
    };
  }

  onEntryDateChange(event: any) {
    if (!this.fromDateDaily.value) return;
    if (this.entryHour.invalid || this.entryMinute.invalid) return; 
    this.calculateBillAmount(this.fromDateDaily.value, this.entryTime12hr);
  }

  onExitDateChange(event: any) {
    if (!this.endDateDaily.value) return;
    if (this.exitHour.invalid || this.exitMinute.invalid) return; 
    this.calculateBillAmount(
      this.fromDateDaily.value,
      this.entryTime12hr,
      this.endDateDaily.value,
      this.exitTime12hr
    );
  }

  get entryTime12hr(): string {
    const h = this.entryHour.value;
    const m = this.entryMinute.value;
    const p = this.entryPeriod.value;
    if (!h || m === null) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
  }

  get exitTime12hr(): string {
    const h = this.exitHour.value;
    const m = this.exitMinute.value;
    const p = this.exitPeriod.value;
    if (!h || m === null) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
  }

  setEntryTime(time: string) {
    if (!time) return;

    const [hourStr, minuteStr, period] = time.trim().split(/[:\s]/);

    this.entryHour.setValue(Number(hourStr));
    this.entryMinute.setValue(Number(minuteStr));
    this.entryPeriod.setValue(period.toUpperCase());
  }

  setExitTime(time: string) {
    if (!time) return;

    const [hourStr, minuteStr, period] = time.trim().split(/[:\s]/);

    this.exitHour.setValue(Number(hourStr));
    this.exitMinute.setValue(Number(minuteStr));
    this.exitPeriod.setValue(period.toUpperCase());
  }

  calculateBillAmount = (
    fromDate: string | null,
    entryTime: string | null,
    endDate?: string | null,
    exitTime?: string | null
  ) => {
    if (!fromDate || !entryTime) {
      return { days: 0, hours: 0, amount: '0.00', entryIST: '', exitIST: '' };
    }
  
    const parseDateTime = (dateStr: string, timeStr: string): Date => {
      const [h, m, period] = timeStr.trim().split(/[:\s]/);
      let hours = parseInt(h, 10);
      const minutes = parseInt(m, 10);
  
      if (period.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (period.toLowerCase() === 'am' && hours === 12) hours = 0;
  
      const [y, mo, d] = dateStr.split('-').map(Number);
      return new Date(y, mo - 1, d, hours, minutes, 0); 
    };
  
    const entryDate = parseDateTime(fromDate, entryTime);
  
    const exitDate = (endDate && exitTime)
      ? parseDateTime(endDate, exitTime)
      : new Date(); 
  
    const diffMs = exitDate.getTime() - entryDate.getTime();
  
    if (diffMs <= 0) {
      return { days: 0, hours: 0, amount: '0.00', entryIST: '', exitIST: '' };
    }
  
    const hoursDiff  = diffMs / (1000 * 60 * 60);
    const numberOfDays = Math.max(1, Math.ceil(hoursDiff / 24));
  
    const dailyRate = Number(this.vehicleDetailsForm.get('amount')?.value) || 0;
    const amount    = dailyRate * numberOfDays;
  
    const formatOptions: Intl.DateTimeFormatOptions = {
      year:   'numeric',
      month:  'short',
      day:    '2-digit',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: true,
    };
  
    const entryIST = entryDate.toLocaleString('en-IN', formatOptions);
    const exitIST  = exitDate.toLocaleString('en-IN', formatOptions);
  
    this.totalDays.setValue(numberOfDays);
    this.actualCost.setValue(amount);
  
    return {
      days:   numberOfDays,
      hours:  hoursDiff.toFixed(2),
      amount: amount.toFixed(2),
      entryIST,
      exitIST,
    };
  };

  private normalizeVehicleNumber(value: string): string {
    return value.toUpperCase().trim();
  }

  private normalizePayload(payload: any) {
    if (payload.vehicleNumber) {
      payload.vehicleNumber = this.normalizeVehicleNumber(
        payload.vehicleNumber
      );
    }
    return payload;
  }

  private resetStandaloneControls() {
    this.billNbr.reset();
    this.dailyStatus.reset();
    this.fromDateDaily.reset();
    this.endDateDaily.reset();
    this.note.reset();
    this.entryHour.reset();
    this.entryMinute.reset();
    this.entryPeriod.reset('AM');
    this.actualCost.reset();
    this.exitHour.reset();
    this.exitMinute.reset();
    this.exitPeriod.reset('AM');
    this.settledCost.reset();
    this.totalDays.reset();
  }

  private buildHistory(
    Entry: string | null,
    Exit: string | null,
    BillNumber: number | null,
    exitTime: string | null,
    entryTime: string | null,
    actualCost: number | null,
    settledCost: number | null
  ) {
    const history: any = {
      Entry,
      Exit,
      BillNumber,
      exitTime,
      entryTime,
      actualCost,
      settledCost
    };

    return history;
  }

  isFormValid(): boolean {
    const isMainFormValid = this.vehicleDetailsForm.valid;
  
    const isStaticValid =
      this.billNbr.valid &&
      this.dailyStatus.valid &&
      this.fromDateDaily.valid &&
      this.entryTime.valid &&
      !this.isBillNumberTaken; // ← add this
  
    let isConditionalValid = true;
  
    if (this.dailyStatus.value === 'paid') {
      const hasExitData = !!this.endDateDaily.value && !!this.actualCost.value;
      const isExitValid = this.endDateDaily.valid && this.actualCost.valid;
  
      isConditionalValid = hasExitData && isExitValid;
  
      if (!isConditionalValid) {
        this.endDateDaily.markAsTouched();
        this.actualCost.markAsTouched();
      }
    }
  
    const totalValid = isMainFormValid && isStaticValid && isConditionalValid;
  
    if (!totalValid) {
      this.vehicleDetailsForm.markAllAsTouched();
      this.billNbr.markAsTouched();
      this.dailyStatus.markAsTouched();
      this.fromDateDaily.markAsTouched();
      this.entryTime.markAsTouched();
    }
  
    return totalValid;
  }

  submitForm = async () => {
    const isFormGroupValid = this.vehicleDetailsForm.valid;
    const areStandalonesValid =
      this.dailyStatus.valid &&
      this.fromDateDaily.valid &&
      (this.dailyStatus.value === 'paid'
        ? this.endDateDaily.valid && this.actualCost.valid
        : true);
  
    if (!isFormGroupValid || !areStandalonesValid) {
      this.vehicleDetailsForm.markAllAsTouched();
      this.dailyStatus.markAsTouched();
      this.actualCost.markAsTouched();
      this.fromDateDaily.markAsTouched();
      this.billNbr.markAsTouched();
      this.entryHour.markAsTouched();
      this.endDateDaily.markAsTouched();
      this.exitHour.markAsTouched();
      this.settledCost.markAsTouched();
  
      this.showAlert = true;
      this.type = 'error';
      this.message = 'Please fill all required fields correctly.';
      return;
    }
  
    try {
      const formValue = this.vehicleDetailsForm.getRawValue();
      const normalizedData = this.normalizePayload({ ...formValue });
  
      const billingData = {
        billNumber:    this.billNbr.value,
        dailyStatus:   this.dailyStatus.value,
        fromDateDaily: this.fromDateDaily.value,
        entryTime:     this.entryTime12hr,
        endDateDaily:  null,
        exitTime:      null,
        settledCost:   null,
        note:          this.note.value,
      };
  
      // ── New customer ─────────────────────────────────────
      if (this.isNewDailyCustomer) {
        const payload = { ...normalizedData, ...billingData };
        await this.newCustomerEntryService.addNewCustomerEntry(payload);
        this.message = 'Daily Customer Added Successfully!';
  
      // ── Settle payment (unpaid → paid) ───────────────────
      } else if (this.isDailyUnpaidCustomer) {
        const updatePayload = {
          ...normalizedData,
          dailyStatus:  'paid',
          endDateDaily: this.endDateDaily.value,
          exitTime:     this.exitTime12hr,
          actualCost:   this.actualCost.value,
          settledCost:  this.settledCost.value,
          totalDays:    this.totalDays.value
        };
  
        const historyPayload = this.buildHistory(
          this.fromDateDaily.value ?? '',
          this.endDateDaily.value ?? '',
          this.billNbr.value ??  0,
          this.exitTime12hr ?? '',
          this.entryTime12hr ?? '',
          this.actualCost.value ?? 0,
          this.settledCost.value ??  0,
          
        );
  
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          updatePayload,
          historyPayload
        );
        this.message = 'Payment Settled & History Updated!';
  
      // ── Monthly → Daily conversion ───────────────────────
      } else if (this.isMonthlyInActiveCustomer) {
        const convertPayload = {
          ...normalizedData,
          ...billingData,
          dailyStatus: 'Unpaid',
        };
  
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          convertPayload
        );
        this.message = 'Customer converted to Daily status.';
  
      // ── Reactivate existing daily customer ───────────────
      } else if (this.isReactivatingCustomer) {
        const reactivatePayload = {
          ...normalizedData,
          ...billingData,
          dailyStatus:  'Unpaid', 
          endDateDaily: null,
          exitTime:     null,
          settledCost:  null,
        };
  
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          reactivatePayload
        );
        this.message = 'Customer Reactivated Successfully!';
      }
  
      this.type = 'success';
      this.showAlert = true;
      this.onSuccessCleanup();
  
    } catch (error) {
      this.type = 'error';
      this.showAlert = true;
      this.message = 'Database error. Please try again.';
      console.error('Submission Error:', error);
    }
  };

  get isReactivatingCustomer(): boolean {
    return (
      !!this.currentCustomer &&           
      !this.isNewDailyCustomer &&
      !this.isDailyUnpaidCustomer &&
      !this.isMonthlyInActiveCustomer &&
      this.dailyStatus.value === 'Unpaid' 
    );
  }

  private onSuccessCleanup() {
    this.vehicleDetailsForm.reset();
    this.resetStandaloneControls();
    this.vehicleDetailsForm.markAsPristine();
    this.vehicleDetailsForm.markAsUntouched();

    setTimeout(() => (this.showAlert = false), 3000);
  }

  cancelEntry() {}

  closeForm() {
    this.vehicleDetailsForm.reset();
    this.router.navigate(['/dashBoard']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
