import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ButtonComponent } from '../Common/button/button.component';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { MatDialog } from '@angular/material/dialog';
import { PaymentConfirmationComponent } from '../payment-confirmation/payment-confirmation.component';
import { TransactionService } from '../transaction.service';
import { Observable, Subject, debounceTime, distinctUntilChanged, take, takeUntil, timer } from 'rxjs';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { AdminService } from '../admin.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-monthly-payments',
  standalone: true,
  imports: [MatFormFieldModule, CommonModule, ReactiveFormsModule, ButtonComponent, MatInputModule, MatOptionModule, MatSelectModule,
            MatSnackBarModule, MatIconModule, MatCardModule],
  templateUrl: './monthly-payments.component.html',
  styleUrl: './monthly-payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyPaymentsComponent implements OnInit, OnDestroy {

  monthlyPaymentForm!: FormGroup;

  searchWithVehicleNbr = new FormControl<string | null>('');
  payingAmount = new FormControl<number | null>(null);
  transactionDate = new FormControl<string | null>(null);

  existingPending: number = (0);
  customerStatus: string = ''

  readonly dialog = inject(MatDialog);

  paymentMethods$!: Observable<any[]>;
  private destroy$ = new Subject<void>();
  isSubmitting: boolean = false;

  maxDate!: string;
  alert: boolean = false;
  alertType: 'success' | 'error' = 'success';
  alertMessage: string = '';

  private lockedRawIndex: number | null = null; 


  ngOnInit() {
    this.monthlyPaymentFormDetails();
    this.paymentMethods$ = this.adminService.getPaymentMethods().pipe(take(1));
    this.getMaxDate();
  
    const vehicleCtrl = this.monthlyPaymentForm.get('vehicleNumber');
  
    if (!vehicleCtrl) return; // null guard — safe exit
  
    vehicleCtrl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        if (value?.trim()) {               // FIX 2: trim whitespace
          this.checkExistingUser(value.trim());
        }
      });
  }

  constructor (private fb: FormBuilder,
                private newCustomerEntryService: NewCustomerEntryService,
                private transactionService: TransactionService,
                private adminService: AdminService,
                private snackBar: MatSnackBar,
                private router: Router) { }

  monthlyPaymentFormDetails = () => {
    this.monthlyPaymentForm = this.fb.group({
      vehicleNumber: [{ value: '', disabled: false }, Validators.required],
      vehicleType: [{ value: '', disabled: false }, Validators.required],
      customerName: [{ value: '', disabled: false }, Validators.required],
      amount: [{ value: '', disabled: false }, Validators.required],
      advance: [{ value: '', disabled: false }, Validators.required],
      transactionDate: [{ value: '', disabled: false }, [Validators.required,(control: any) => {
        return control.value > this.maxDate ? { futureMonth: true } : null;
      }]],
      paymentMethod: [{ value: '', disabled: false }, Validators.required],
      payingAmount: [{ value: '', disabled: false }, Validators.required],
    })
  }

  checkExistingUser = async(vehicleNbr?: string) => {
    const vehicleNumber = vehicleNbr? vehicleNbr : this.searchWithVehicleNbr.value?.trim();

    if (!vehicleNumber) {
      return;
    }
    const formatedVehicleNbr = this.formateVehicleNumber(vehicleNumber);

    const customerDetails = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr, 'vehicleNbr');
    if(!customerDetails) {
      this.monthlyPaymentForm.patchValue({
        vehicleNumber: formatedVehicleNbr,
        vehicleType: '',
        customerName: '',
        amount: '',
        advance: ''
      });
      return;
    }
    this.existingPending = customerDetails.Transactions.currentPending;
    if(customerDetails && customerDetails.customerType === 'Monthly') {

      this.customerStatus = customerDetails.monthlyStatus;
      this.monthlyPaymentForm.patchValue({
        vehicleNumber: customerDetails.vehicleNumber,
        vehicleType: customerDetails.vehicleType,
        customerName: customerDetails.customerName,
        amount: customerDetails.Transactions.currentPending,
        advance: customerDetails.advance
      });
    } 
  }

  private formateVehicleNumber(value: string): string {
    if (typeof value !== 'string') return '';
    return value.toUpperCase().replace(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/, '$1 $2 $3 $4');
  }

  reformatVehicleNumber(value: any): string {
    if (typeof value !== 'string') return '';
    return value.toUpperCase().replace(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/, '$1 $2 $3 $4');
  }

  restrictNegativeInput(event: KeyboardEvent) {
    if (['-', 'e', '+'].includes(event.key)) {
      event.preventDefault();
    }
  }
  
  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key   = event.key.toUpperCase();
  
    if (['TAB', 'ARROWLEFT', 'ARROWRIGHT', 'ENTER'].includes(key)) return;
  
    const cursor   = input.selectionStart ?? 0;
    const rawIndex = input.value.substring(0, cursor).replace(/\s/g, '').length;
    const control  = this.monthlyPaymentForm.get('vehicleNumber');
  
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
  
    this.monthlyPaymentForm
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

  openDialog() {
    if (this.monthlyPaymentForm.invalid) {
      this.monthlyPaymentForm.markAllAsTouched(); 
      this.snackBar.open('Please fill all required fields correctly.', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error']
      });
      return;
    }
  
    const formData = this.monthlyPaymentForm.getRawValue();
    const paying = Number(formData.payingAmount);
    const due = Number(formData.amount);
  
    if (paying > due) {
      this.snackBar.open('Paying amount cannot exceed the Total Due.', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error']
      });
      return; 
    }
    
    const dialogRef = this.dialog.open(PaymentConfirmationComponent, {
      width: '700px',
      height: '350px',
      data: { 
        customer: formData.customerName, 
        vehicle: formData.vehicleNumber,
        payingAmount: paying,  
        totalDue: due,        
        transactionDate: formData.transactionDate 
      } 
    });
  
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result === true || result === 'confirm') {
        this.proceedTransaction();
      }
    });
  }

  proceedTransaction = async () => {
    if (this.isSubmitting) return;
  
    try {
      this.isSubmitting = true;
  
      const rawForm = this.monthlyPaymentForm.getRawValue();
      const customer = this.searchWithVehicleNbr.value;
  
      const transactionData = {
        monthlyCost:       rawForm.amount,
        advance:           rawForm.advance,
        paymentMethod:     rawForm.paymentMethod,
        transactionAmount: rawForm.payingAmount,
        transactionDate:   rawForm.transactionDate,
        customerStatus:    this.customerStatus,
      };
  
      const proceedTransaction = await this.transactionService
        .customerMonthlyTransactionDetails(customer, transactionData);
  
      if (proceedTransaction) {
        this.showAlert('Transaction successful!', 'success');
        this.resetAllFormStates();
      } else {
      this.showAlert('Transaction failed! Please try again...', 'error');
      }
  
    } catch (error) {
      console.error('Transaction error:', error);
      this.showAlert('Transaction failed! Please try again...', 'error');
    } finally {
      this.isSubmitting = false;
    }
  };

  showAlert(message: string, type: 'success' | 'error'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.alert = true;

    timer(4000).subscribe(() => {
      this.alert = false;
      this.alertMessage = '';
    });
  }
  
  private resetAllFormStates() {
    this.monthlyPaymentForm.reset();
    this.searchWithVehicleNbr.setValue('');
  }

  clearDetails() {
    // this.monthlyPaymentForm.reset();
  }

  

  closeForm() {
    this.router.navigate(['/dashBoard']);
  }

  getMaxDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    this.maxDate = this.formatToISO(new Date(year, month + 1, 0));

    this.transactionDate.valueChanges.subscribe(value => {
      if (value) {
        if (value > this.maxDate) {
          this.transactionDate.setValue('');
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



  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
