import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../Common/button/button.component';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, Subject, combineLatest, debounceTime, distinctUntilChanged, filter, startWith, switchMap, takeUntil, withLatestFrom } from 'rxjs';
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

  type: 'success' | 'error' | 'warning' = 'success';
  message: string = '';
  showAlert = false;

  dailystatus = ['paid', 'Unpaid'];
  currentCustomer: string = '';

  isNewDailyCustomer: boolean = false;
  isDailyUnpaidCustomer: boolean = false;
  isDailyPaidCustomer: boolean = false;
  isMonthlyActiveCustomer: boolean = false;
  isMonthlyInActiveCustomer: boolean = false;

  billNbr = new FormControl<string>('');
  dailyStatus = new FormControl<string>('');
  fromDateDaily = new FormControl<string | null>(null);
  endDateDaily = new FormControl<string | null>(null);
  entryTime = new FormControl<string | null>(null);
  exitTime = new FormControl<string | null>(null);
  billAmount = new FormControl<string | number>('');
  actualCost = new FormControl<string>('');
  note = new FormControl<string>('');

  appxexitTime: string = '';
  showPaidDetails: boolean = false;
  alreadyPaid: boolean = false;
  private destroy$ = new Subject<void>();
  vehicleTypes$!: Observable<VehicleType[]>;

  ngOnInit() {
    this.vehicleTypes$ = this.adminService.getVehicleTypes();

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

    // vehicleCtrl?.valueChanges
    //   .pipe(debounceTime(500), distinctUntilChanged(), filter(value => value?.length >= 9 ), takeUntil(this.destroy$))
    //   .subscribe((value) => {
    //     if (value) {
    //       this.getCustomerDetails(value);
    //     }
    //   });

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

  onDailylyStatusChange(status: string | null) {
    if (status === 'paid') {
      this.showPaidDetails = true;
    } else {
      this.showPaidDetails = false;
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
    const vehicleNumber = vehicleNbr;

    if (!vehicleNumber) {
      return;
    }
    const formatedVehicleNbr = this.normalizeVehicleNumber(vehicleNumber);
    const res = await this.newCustomerEntryService.getVehicleByNumber( formatedVehicleNbr, 'vehicleNbr' );

    this.currentCustomer = res.vehicleNumber;
    if (res && res.dailyStatus === 'Unpaid') {
      this.isDailyUnpaidCustomer = true;
      this.isNewDailyCustomer = false;
      this.isDailyPaidCustomer = false;

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
      this.fromDateDaily.setValue(res.fromDateDaily),
        this.entryTime.setValue(res.entryTime);
      this.note.setValue(res.note);
      this.calculateBillAmount(res.fromDateDaily, res.entryTime);
    } else if (res && res.dailyStatus === 'paid') {
      this.isDailyUnpaidCustomer = false;
      this.isNewDailyCustomer = false;
      this.isDailyPaidCustomer = true;
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
      this.fromDateDaily.setValue(res.fromDateDaily),
        this.entryTime.setValue(res.entryTime);
        this.alreadyPaid = true
      this.billAmount.setValue(res.billAmount),
        this.endDateDaily.setValue(res.endDateDaily),
        this.exitTime.setValue(res.exitTime),
        this.actualCost.setValue(res.settledAmount),
        this.note.setValue(res.note);
    } else if (res && res.monthlyStatus === 'Active') {
      this.isMonthlyActiveCustomer = true;
      this.showAlert = true;
      this.type = 'error';
      this.message = 'Sorry... This customer is an Active Monthly Customer...';
    } else if (res && res.monthlyStatus === 'InActive') {
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
      this.message = 'This customer is an paid Daily Customer...';
    } else {
      this.isNewDailyCustomer = true;
    }
  };

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
    return value.toUpperCase().replace(/\s+/g, '').trim();
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

  submitForm = async () => {
    if (this.vehicleDetailsForm.invalid) {
      this.vehicleDetailsForm.markAllAsTouched();
      return;
    }
    try {
      if (this.isNewDailyCustomer) {
        let payload = this.normalizePayload({
          ...this.vehicleDetailsForm.value,
        });

        const customerDetails = {
          ...payload,
          billNumber: this.billNbr.value,
          dailyStatus: this.dailyStatus.value,
          fromDateDaily: this.fromDateDaily.value,
          entryTime: this.entryTime.value,
          note: this.note.value,
        };

        await this.newCustomerEntryService.addNewCustomerEntry(customerDetails);

        this.vehicleDetailsForm.reset({
          customerType: 'Daily'
        });
        this.entryTime.setValue('');
        this.message = 'Customer Added Successfully...';
      } else if (this.isDailyUnpaidCustomer) {
        const updatePayload: any = {
          dailyStatus: 'paid',
          endDateDaily: this.endDateDaily.value,
          exitTime: this.exitTime.value,
          billAmount: this.billAmount.value,
          settledAmount: this.actualCost.value,
        };
        const historyPayload = this.buildHistory(
          this.fromDateDaily.value,
          this.endDateDaily.value,
          this.billNbr.value
        );
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          updatePayload,
          historyPayload
        );
        this.vehicleDetailsForm.reset({
          customerType: 'Daily'
        });
        this.message = 'Customer Updated Successfully...';
      } else if (this.isMonthlyInActiveCustomer) {
        const updatePayload: any = {
          dailyStatus: 'Unpaid',
          billNumber: this.billNbr.value,
          fromDateDaily: this.fromDateDaily.value,
          entryTime: this.entryTime.value,
          note: this.note.value,
        };
        await this.newCustomerEntryService.updateCustomerByVehicleNumber(
          this.currentCustomer,
          updatePayload
        );

        this.vehicleDetailsForm.reset({
          customerType: 'Daily'
        });
        this.message = 'Customer Successfully Converted to Daily... ';
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
