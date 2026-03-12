import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../Common/button/button.component';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, Subject, combineLatest, debounceTime, distinctUntilChanged, filter, startWith, switchMap, take, takeUntil, withLatestFrom } from 'rxjs';
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

  dailystatus = ['paid', 'Unpaid'];
  currentCustomer: string = '';

  isNewDailyCustomer: boolean = false;
  isDailyUnpaidCustomer: boolean = false;
  isDailyPaidCustomer: boolean = false;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;

  billNbr = new FormControl<string>('', [Validators.required]);
  dailyStatus = new FormControl<string>('', [Validators.required]);
  fromDateDaily = new FormControl<string | null>(null, [Validators.required]);
  entryTime = new FormControl<string | null>(null, [Validators.required]);
  
  endDateDaily = new FormControl<string | null>(null);
  exitTime = new FormControl<string | null>(null);
  billAmount = new FormControl<string | number>('');
  
  actualCost = new FormControl<string>('', [
    Validators.pattern('^[0-9]*$')
  ]);
  
  note = new FormControl<string>('');

  appxexitTime: string = '';
  showPaidDetails: boolean = false;
  alreadyPaid: boolean = false;
  private destroy$ = new Subject<void>();
  vehicleTypes$!: Observable<VehicleType[]>;

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
      this.vehicleDetailsForm.get('amount')?.setValue(selectedVehicle.dailyCost, { emitEvent: false });
    }
  });

    const vehicleCtrl = this.vehicleDetailsForm.get('vehicleNumber');

    vehicleCtrl?.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged(), filter(value => value?.length >= 9 ), takeUntil(this.destroy$))
      .subscribe((value) => {
        if (value) {
          this.getCustomerDetails(value);
        }
      });

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
    private adminService: AdminService
  ) {
    this.vehicleDetails();
  }

  vehicleDetails = () => {
    this.vehicleDetailsForm = this.fb.group({
      vehicleNumber: [{ value: '', disabled: false }, Validators.required],
      vehicleType: [{ value: '', disabled: false }, Validators.required],

      customerName: [{ value: '', disabled: false }, Validators.required],
      customerPhoneNbr: [{ value: '', disabled: false }, Validators.required],
      address: [{ value: '', disabled: false }],

      customerType: 'Daily',
      amount: [{ value: '', disabled: false }],
    });
  };

  onDailylyStatusChange(status: string) {
    if (status === 'paid') {
      this.actualCost.setValidators([Validators.required, Validators.pattern('^[0-9]*$')]);
      this.endDateDaily.setValidators([Validators.required]);
    } else {
      this.actualCost.clearValidators();
      this.endDateDaily.clearValidators();
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

  }
  getCustomerDetails = async (vehicleNbr: string) => {
    if (!vehicleNbr) return;

    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNbr);
    const res = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr, 'vehicleNbr');

    // Reset alert state at the start of a new search
    this.showAlert = false;

    // Safety Check: If no result found, it's a new daily customer
    if (!res) {
        this.isNewDailyCustomer = true;
        this.resetFormForNewCustomer(); // You should have a method to clear the form
        return;
    }

    this.currentCustomer = res.vehicleNumber;

    // CASE 1: Daily Unpaid (Needs Exit Entry)
    if (res.dailyStatus === 'Unpaid') {
        this.isDailyUnpaidCustomer = true;
        this.isNewDailyCustomer = false;
        this.isDailyPaidCustomer = false;
        this.isMonthlyActiveCustomer = false;

        this.vehicleDetailsForm.patchValue({
            vehicleNumber: res.vehicleNumber,
            vehicleType: res.vehicleType,
            customerName: res.customerName,
            customerPhoneNbr: res.customerPhoneNbr,
            customerType: res.customerType,
            address: res.address,
            amount: res.amount,
        });

        this.billNbr.setValue(res.billNumber);
        this.dailyStatus.setValue(res.dailyStatus);
        this.fromDateDaily.setValue(res.fromDateDaily);
        this.entryTime.setValue(res.entryTime);
        this.note.setValue(res.note);
        
        this.calculateBillAmount(res.fromDateDaily, res.entryTime);
    } 
    
    // CASE 2: Daily Paid (Already finished)
    else if (res.dailyStatus === 'paid') {
        this.isDailyUnpaidCustomer = false;
        this.isNewDailyCustomer = false;
        this.isDailyPaidCustomer = true;
        this.alreadyPaid = true;

        this.vehicleDetailsForm.patchValue({
            vehicleNumber: res.vehicleNumber,
            vehicleType: res.vehicleType,
            customerName: res.customerName,
            customerPhoneNbr: res.customerPhoneNbr,
            customerType: res.customerType,
            address: res.address,
            amount: res.amount,
        });

        this.billNbr.setValue(res.billNumber);
        this.dailyStatus.setValue(res.dailyStatus);
        this.fromDateDaily.setValue(res.fromDateDaily);
        this.entryTime.setValue(res.entryTime);
        this.billAmount.setValue(res.billAmount);
        this.endDateDaily.setValue(res.endDateDaily);
        this.exitTime.setValue(res.exitTime);
        this.actualCost.setValue(res.settledAmount);
        this.note.setValue(res.note);
    } 
    
    // CASE 3: Monthly Active (Error - Cannot be Daily)
    else if (res.monthlyStatus === 'Active') {
        this.isMonthlyActiveCustomer = true;
        this.showAlert = true;
        this.type = 'error';
        this.message = 'Error: This is an Active Monthly Customer.';
    } 
    
    // CASE 4: Monthly InActive (Convert to Daily)
    else if (res.monthlyStatus === 'InActive') {
        this.isNewDailyCustomer = false;
        this.isDailyPaidCustomer = false;
        this.isDailyUnpaidCustomer = false;
        this.isMonthlyActiveCustomer = false;
        this.isMonthlyInActiveCustomer = true;

        this.vehicleDetailsForm.patchValue({
            vehicleNumber: res.vehicleNumber,
            vehicleType: res.vehicleType,
            customerName: res.customerName,
            customerPhoneNbr: res.customerPhoneNbr,
            address: res.address,
        });
        
        this.showAlert = true;
        this.type = 'warning';
        this.message = 'Previous Monthly Customer detected. Ready for Daily entry.';
    } 
    
    // Default fallback
    else {
        this.isNewDailyCustomer = true;
        this.resetFormForNewCustomer(); // <--- Add this here
        this.message = 'New vehicle detected. Please enter details.';
        this.type = 'info';
      this.showAlert = true;
    }
};

private resetFormForNewCustomer() {
  // Reset the main form to default values
  this.vehicleDetailsForm.reset({
    customerType: 'Daily',
    vehicleNumber: this.vehicleDetailsForm.get('vehicleNumber')?.value // Keep the searched number
  });

  // Reset all standalone controls to their initial states
  this.billNbr.setValue('');
  this.dailyStatus.setValue('Unpaid'); // Default for new customers
  this.fromDateDaily.setValue(new Date().toISOString().split('T')[0]); // Default to today
  this.endDateDaily.setValue(null);
  this.entryTime.setValue(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  this.exitTime.setValue(null);
  this.billAmount.setValue('');
  this.actualCost.setValue('');
  this.note.setValue('');

  // Reset state flags
  this.isDailyUnpaidCustomer = false;
  this.isDailyPaidCustomer = false;
  this.isMonthlyActiveCustomer = false;
  this.isMonthlyInActiveCustomer = false;
  this.alreadyPaid = false;
  this.showPaidDetails = false;

  // Clear validation styling
  this.vehicleDetailsForm.markAsPristine();
  this.vehicleDetailsForm.markAsUntouched();
}

  onEntryDateChange(event: any) {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.entryTime.setValue(`${hours}:${minutes}`);

    const istDateTime = this.getTimeInIST(this.fromDateDaily, this.entryTime);
    this.entryTime.setValue(istDateTime);
  }

  onExitDateChange(event: any) {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.exitTime.setValue(`${hours}:${minutes}`);
    const istDateTime = this.getTimeInIST(this.endDateDaily, this.exitTime);
    this.exitTime.setValue(istDateTime);
    this.calculateBillAmount(
      this.fromDateDaily.value,
      this.entryTime.value,
      this.endDateDaily.value,
      this.exitTime.value
    );
  }

  getTimeInIST(
    dateControl: FormControl<string | null>,
    timeControl: FormControl<string | null>
  ): string | null {
    if (!dateControl.value || !timeControl.value) return null;

    const [hours, minutes] = timeControl.value.split(':').map(Number);

    const date = new Date(dateControl.value);
    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  calculateBillAmount = (
    fromDate: string | null,
    entryTime: string | null,
    endDate?: string | null,
    exitTime?: string | null
  ) => {
    if (!fromDate || !entryTime) {
      return { hours: 0, amount: '0.00', entryIST: '', exitIST: '' };
    }

    // ---------- 1️⃣ Parse ENTRY time (12hr → 24hr) ----------
    const entryParts = entryTime.trim().split(/[:\s]/); // ["01","00","am"]
    let entryHours = parseInt(entryParts[0], 10);
    const entryMinutes = parseInt(entryParts[1], 10);
    const entryAmPm = entryParts[2].toLowerCase();

    if (entryAmPm === 'pm' && entryHours < 12) entryHours += 12;
    if (entryAmPm === 'am' && entryHours === 12) entryHours = 0;

    // ---------- 2️⃣ Create ENTRY Date (IST → UTC) ----------
    const [y, m, d] = fromDate.split('-').map(Number);
    const entryDate = new Date(
      Date.UTC(y, m - 1, d, entryHours - 5, entryMinutes - 30)
    );

    // ---------- 3️⃣ Create EXIT Date ----------
    let exitDate: Date;

    if (endDate && exitTime) {
      const exitParts = exitTime.trim().split(/[:\s]/);
      let exitHours = parseInt(exitParts[0], 10);
      const exitMinutes = parseInt(exitParts[1], 10);
      const exitAmPm = exitParts[2].toLowerCase();

      if (exitAmPm === 'pm' && exitHours < 12) exitHours += 12;
      if (exitAmPm === 'am' && exitHours === 12) exitHours = 0;

      const [ey, em, ed] = endDate.split('-').map(Number);
      exitDate = new Date(
        Date.UTC(ey, em - 1, ed, exitHours - 5, exitMinutes - 30)
      );
    } else {
      // Current time → IST
      const now = new Date();
      exitDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    }

    // ---------- 4️⃣ Calculate HOURS difference ----------
    const diffMs = exitDate.getTime() - entryDate.getTime();
    const hoursDiff = diffMs / (1000 * 60 * 60);

    // ---------- 5️⃣ Billing Logic ----------
    const flatRate = this.vehicleDetailsForm.get('amount')?.value || 0;
    let amount: number;

    if (hoursDiff <= 24) {
      amount = flatRate;
    } else {
      const extraHours = hoursDiff - 24;
      const extraDays = Math.ceil(extraHours / 24);
      amount = flatRate + extraDays * flatRate;
    }

    // ---------- 6️⃣ IST Display Formatting ----------
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };

    const entryIST = entryDate.toLocaleString('en-IN', formatOptions);
    const exitIST = exitDate.toLocaleString('en-IN', formatOptions);

    // ---------- 7️⃣ Set bill amount in form ----------
    this.billAmount.setValue(amount.toFixed(2));

    // ---------- 8️⃣ Return ----------
    return {
      hours: hoursDiff.toFixed(2),
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
  }

  private buildHistory(
    Entry: string | null,
    Exit: string | null,
    BillNumber: string | null
  ) {
    const history: any = {
      Entry,
      Exit,
      BillNumber,
    };

    return history;
  }

  isFormValid(): boolean {
    // 1. Check the main FormGroup
    const isMainFormValid = this.vehicleDetailsForm.valid;
  
    // 2. Check Static Standalones
    const isStaticValid = 
      this.billNbr.valid && 
      this.dailyStatus.valid && 
      this.fromDateDaily.valid && 
      this.entryTime.valid;
  
    // 3. Check Conditional Standalones (Exit/Paid Logic)
    let isConditionalValid = true;
    
    if (this.dailyStatus.value === 'paid') {
      // If status is paid, these MUST have values and be valid
      const hasExitData = !!this.endDateDaily.value && !!this.actualCost.value;
      const isExitValid = this.endDateDaily.valid && this.actualCost.valid;
      
      isConditionalValid = hasExitData && isExitValid;
      
      // Trigger visual errors if invalid
      if (!isConditionalValid) {
        this.endDateDaily.markAsTouched();
        this.actualCost.markAsTouched();
      }
    }
  
    // 4. Final Verdict
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
  // 1. Comprehensive Validation Guard
  const isFormGroupValid = this.vehicleDetailsForm.valid;
  const areStandalonesValid = 
    this.dailyStatus.valid && 
    this.fromDateDaily.valid && 
    (this.dailyStatus.value === 'paid' ? (this.endDateDaily.valid && this.actualCost.valid) : true);

  if (!isFormGroupValid || !areStandalonesValid) {
    this.vehicleDetailsForm.markAllAsTouched();
    this.dailyStatus.markAsTouched();
    this.actualCost.markAsTouched();
    this.fromDateDaily.markAsTouched();
    
    this.showAlert = true;
    this.type = 'error';
    this.message = 'Please fill all required fields correctly.';
    return;
  }

  try {
    const formValue = this.vehicleDetailsForm.getRawValue();
    const normalizedData = this.normalizePayload({ ...formValue });
    
    // Shared payload parts
    const billingData = {
      billNumber: this.billNbr.value,
      dailyStatus: this.dailyStatus.value,
      fromDateDaily: this.fromDateDaily.value,
      entryTime: this.entryTime.value,
      note: this.note.value
    };

    // CASE 1: New Daily Entry
    if (this.isNewDailyCustomer) {
      const payload = { ...normalizedData, ...billingData };
      await this.newCustomerEntryService.addNewCustomerEntry(payload);
      this.message = 'Daily Customer Added Successfully!';
    } 

    // CASE 2: Settling an Unpaid Daily Customer
    else if (this.isDailyUnpaidCustomer) {
      const updatePayload = {
        ...normalizedData,
        dailyStatus: 'paid',
        endDateDaily: this.endDateDaily.value,
        exitTime: this.exitTime.value,
        billAmount: this.billAmount.value,
        settledAmount: this.actualCost.value,
      };
      
      const historyPayload = this.buildHistory(
        this.fromDateDaily.value ?? '',
        this.endDateDaily.value ?? '',
        this.billNbr.value ?? ''
      );

      await this.newCustomerEntryService.updateCustomerByVehicleNumber(
        this.currentCustomer,
        updatePayload,
        historyPayload
      );
      this.message = 'Payment Settled & History Updated!';
    }

    // CASE 3: Monthly InActive converting to Daily
    else if (this.isMonthlyInActiveCustomer) {
      const convertPayload = {
        ...normalizedData,
        ...billingData,
        dailyStatus: 'Unpaid' // Force status for conversion
      };
      
      await this.newCustomerEntryService.updateCustomerByVehicleNumber(
        this.currentCustomer,
        convertPayload
      );
      this.message = 'Customer converted to Daily status.';
    }

    this.type = 'success';
    this.showAlert = true;
    this.onSuccessCleanup(); // Custom method to reset everything

  } catch (error) {
    this.type = 'error';
    this.showAlert = true;
    this.message = 'Database error. Please try again.';
    console.error('Submission Error:', error);
  }
};

private onSuccessCleanup() {
  this.vehicleDetailsForm.reset();
  this.resetStandaloneControls(); // Your existing method
  this.vehicleDetailsForm.markAsPristine();
  this.vehicleDetailsForm.markAsUntouched();
  
  // Keep message visible for 3 seconds then hide
  setTimeout(() => this.showAlert = false, 3000);
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
