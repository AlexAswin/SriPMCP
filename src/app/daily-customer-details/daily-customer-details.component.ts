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

interface VehicleResponse {
  vehicleNumber:    string;
  vehicleType:      string;
  vehicleName:      string;
  customerName:     string;
  customerPhoneNbr: number;
  customerType:     string;
  address:          string;
  amount:           number;
  billNumber:       number;
  billAmount:       number;
  entryTime:        string;
  exitTime:         string;
  fromDateDaily:    string;
  endDateDaily:     string;
  actualCost:       number;
  settledCost:      number;
  totalDays:        number;
  note:             string;
  dailyStatus:      'Unpaid' | 'paid' | null;
  monthlyStatus:    'Active' | 'InActive' | null;
}


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

  private lockedRawIndex: number | null = null; 

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
    const key   = event.key.toUpperCase();
  
    if (['TAB', 'ARROWLEFT', 'ARROWRIGHT', 'ENTER'].includes(key)) return;
  
    const cursor   = input.selectionStart ?? 0;
    const rawIndex = input.value.substring(0, cursor).replace(/\s/g, '').length;
    const control  = this.vehicleDetailsForm.get('vehicleNumber');
  
    if (key === 'BACKSPACE') {
      if (rawIndex > 0) {
        this.lockedRawIndex = rawIndex - 1; 
      }
      return; 
    }
  
    if (key === 'DELETE') {
      this.lockedRawIndex = rawIndex;
      return;
    }
  
    const isDigit  = /^[0-9]$/.test(key);
    const isLetter = /^[A-Z]$/.test(key);
  
    if (!isDigit && !isLetter) return event.preventDefault();
  
    if (this.lockedRawIndex !== null && rawIndex !== this.lockedRawIndex) {
      return event.preventDefault(); 
    }
  
    const rawTotal = input.value.replace(/\s/g, '');
    if (rawTotal.length >= 10) return event.preventDefault();
  
    this.clearInlineErrors(control, ['letterExpected', 'digitExpected']);
  
    if (rawIndex < 2 && !isLetter) {
      control?.setErrors({ ...control.errors, letterExpected: true });
      return event.preventDefault();
    }
  
    if (rawIndex >= 2 && rawIndex < 4 && !isDigit) {
      control?.setErrors({ ...control.errors, digitExpected: true });
      return event.preventDefault();
    }
  
if (rawIndex >= 4 && rawIndex < 6 && !isLetter) {
  const raw        = input.value.replace(/\s/g, '').toUpperCase();
  const charAtPos4 = raw[4];
  const afterPos5  = raw.substring(5); 

  if (
    rawIndex === 5 &&
    charAtPos4 && /^[A-Z]$/.test(charAtPos4) &&
    isDigit &&
    afterPos5.length === 0 
  ) {
  } else {
    control?.setErrors({ ...control.errors, letterExpected: true });
    return event.preventDefault();
  }
}
  
    if (rawIndex >= 6 && rawIndex < 10 && !isDigit) {
      control?.setErrors({ ...control.errors, digitExpected: true });
      return event.preventDefault();
    }
  
    if (this.lockedRawIndex !== null && rawIndex === this.lockedRawIndex) {
      this.lockedRawIndex = null;
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

  getCustomerDetails = async (vehicleNbr: string): Promise<void> => {
    if (!vehicleNbr) return;
  
    const formattedVehicleNbr = this.normalizeVehicleNumber(vehicleNbr);
    const res = await this.newCustomerEntryService.getVehicleByNumber(formattedVehicleNbr, 'vehicleNbr');
  
    this.showAlert = false;
  
    if (!res) {
      this.isNewDailyCustomer = true;
      return;
    }
  
    this.currentCustomer = res.vehicleNumber;
    this.handleCustomerStatus(res);
  };
  
  private handleCustomerStatus(res: VehicleResponse): void {
    const handlers: Partial<Record<string, () => void>> = {
      'daily:Unpaid':   () => this.handleUnpaidDailyCustomer(res),
      'daily:paid':     () => this.handlePaidDailyCustomer(res),
      'monthly:Active': () => this.handleActiveMonthlyCustomer(),
      'monthly:InActive': () => this.handleInactiveMonthlyCustomer(res),
    };
  
    const key = res.dailyStatus
      ? `daily:${res.dailyStatus}`
      : res.monthlyStatus
      ? `monthly:${res.monthlyStatus}`
      : null;
  
    const handler = key ? handlers[key] : null;
  
    if (handler) {
      handler();
    } else {
      this.handleNewCustomer();
    }
  }
  
  private patchVehicleForm(res: Partial<VehicleResponse>): void {
    this.vehicleDetailsForm.patchValue({
      vehicleNumber:     res.vehicleNumber,
      vehicleType:       res.vehicleType,
      vehicleName:       res.vehicleName,
      customerName:      res.customerName,
      customerPhoneNbr:  res.customerPhoneNbr,
      customerType:      res.customerType,
      address:           res.address,
      amount:            res.amount,
    });
  }
  
  private resetCustomerFlags(): void {
    this.isNewDailyCustomer      = false;
    this.isDailyUnpaidCustomer   = false;
    this.isDailyPaidCustomer     = false;
    this.isMonthlyActiveCustomer = false;
    this.isMonthlyInActiveCustomer = false;
  }
  
  private setAlert(type: 'error' | 'warning' | 'info', message: string): void {
    this.showAlert = true;
    this.type      = type;
    this.message   = message;
  }
  
  private handleUnpaidDailyCustomer(res: VehicleResponse): void {
    this.resetCustomerFlags();
    this.isDailyUnpaidCustomer = true;
  
    this.patchVehicleForm(res);
    this.billNbr.setValue(res.billNumber, { emitEvent: false });
    this.currentCustomerBillNbr = res.billNumber;
    this.dailyStatus.setValue(res.dailyStatus);
    this.fromDateDaily.setValue(res.fromDateDaily);
    this.entryTime.setValue(res.entryTime);
    this.note.setValue(res.note);
  
    this.setEntryTime(res.entryTime);
    this.disableEntryTimeControls();
  
    this.disabled = true;
    this.cdr.detectChanges();
    this.calculateBillAmount(res.fromDateDaily, res.entryTime);
  }
  
  private handlePaidDailyCustomer(res: VehicleResponse): void {
    this.resetCustomerFlags();
    this.isDailyPaidCustomer = true;
    this.alreadyPaid         = true;
  
    this.patchVehicleForm(res);
    this.billNbr.setValue(res.billNumber, { emitEvent: false });
    this.currentCustomerBillNbr = res.billNumber;
    this.dailyStatus.setValue(res.dailyStatus);
    this.fromDateDaily.setValue(res.fromDateDaily);
    this.billAmount.setValue(res.billAmount);
    this.endDateDaily.setValue(res.endDateDaily);
    this.actualCost.setValue(res.actualCost);
    this.settledCost.setValue(res.settledCost);
    this.totalDays.setValue(res.totalDays);
    this.note.setValue(res.note);
  
    this.setEntryTime(res.entryTime);
    this.setExitTime(res.exitTime);
  
    this.disabled = true;
  }
  
  private handleActiveMonthlyCustomer(): void {
    this.resetCustomerFlags();
    this.isMonthlyActiveCustomer = true;
    this.setAlert('error', 'Error: This is an Active Monthly Customer.');
  }
  
  private handleInactiveMonthlyCustomer(res: VehicleResponse): void {
    this.resetCustomerFlags();
    this.isMonthlyInActiveCustomer = true;
  
    this.vehicleDetailsForm.patchValue({
      vehicleNumber:    res.vehicleNumber,
      vehicleType:      res.vehicleType,
      vehicleName:      res.vehicleName,
      customerName:     res.customerName,
      customerPhoneNbr: res.customerPhoneNbr,
      address:          res.address,
    });
  
    this.setAlert('warning', 'Previous Monthly Customer detected. Ready for Daily entry.');
  }
  
  private handleNewCustomer(): void {
    this.resetCustomerFlags();
    this.isNewDailyCustomer     = true;
    this.currentCustomerBillNbr = null;
    this.resetFormForNewCustomer();
    this.setAlert('info', 'New vehicle detected. Please enter details.');
  }
  
  private disableEntryTimeControls(): void {
    this.entryHour.disable();
    this.entryMinute.disable();
    this.entryPeriod.disable();
  }

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
