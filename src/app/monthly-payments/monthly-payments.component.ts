import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ButtonComponent } from '../Common/button/button.component';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { MatDialog } from '@angular/material/dialog';
import { PaymentConfirmationComponent } from '../payment-confirmation/payment-confirmation.component';
import { TransactionService } from '../transaction.service';
import { Observable, Subject, debounceTime, distinctUntilChanged, take, takeUntil } from 'rxjs';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { AdminService } from '../admin.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-monthly-payments',
  standalone: true,
  imports: [MatFormFieldModule, CommonModule, ReactiveFormsModule, ButtonComponent, MatInputModule, MatOptionModule, MatSelectModule,
            MatSnackBarModule, MatIconModule],
  templateUrl: './monthly-payments.component.html',
  styleUrl: './monthly-payments.component.scss'
})
export class MonthlyPaymentsComponent implements OnInit, OnDestroy {

  monthlyPaymentForm!: FormGroup;

  searchWithVehicleNbr = new FormControl<string | null>('');
  payingAmount = new FormControl<number | null>(null);
  transactionDate = new FormControl<string | null>(null);

  existingPending: number = (0);

  readonly dialog = inject(MatDialog);

  paymentMethods$!: Observable<any[]>;
  private destroy$ = new Subject<void>();
  isSubmitting: boolean = false;

  maxDate!: string;

  

  ngOnInit() {
    this.monthlyPaymentFormDetails();
    this.paymentMethods$ = this.adminService.getPaymentMethods().pipe(take(1));

    const vehicleCtrl = this.searchWithVehicleNbr;

    vehicleCtrl?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        if (value) {
          this.checkExistingUser(value);
        }
      });

    this.getMaxDate();

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
    const key = event.key;
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;
  
    const control = this.monthlyPaymentForm.get('vehicleNumber');

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
    this.monthlyPaymentForm.get('vehicleNumber')?.setValue(input.value, { emitEvent: false });

    const diff = input.value.length - oldVal.length;
    input.setSelectionRange(oldCursor + diff, oldCursor + diff);
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
        monthlyCost: rawForm.amount, 
        advance: rawForm.advance,       
        paymentMethod: rawForm.paymentMethod,
        transactionAmount: rawForm.payingAmount,
        transactionDate: rawForm.transactionDate 
      };
  
      const proceedTransaction = await this.transactionService.customerMonthlyTransactionDetails(customer, transactionData);

      if( proceedTransaction ) {
        this.snackBar.open('Transaction successful!', 'Close', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-success'],
        });
      this.resetAllFormStates();
      } else {
        this.snackBar.open('Transaction Failed! Please try again...', 'Close', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-success'],
        });
      }
  
  
    } catch (error) {
      console.error('Transaction Error:', error);
      this.snackBar.open('Transaction Failed. Try again!', 'Close', {
        duration: 4000,
        panelClass: ['snackbar-error'],
      });
    } finally {
      this.isSubmitting = false;
    }
  };
  
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
