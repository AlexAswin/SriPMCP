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
import { Observable, Subject, take, takeUntil } from 'rxjs';
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

  readonly dialog = inject(MatDialog);

  paymentMethods$!: Observable<any[]>;
  private destroy$ = new Subject<void>();

  

  ngOnInit() {
    this.monthlyPaymentFormDetails();
    this.paymentMethods$ = this.adminService.getPaymentMethods().pipe(take(1));
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
      transactionDate: [{ value: '', disabled: false }, Validators.required],
      paymentMethod: [{ value: '', disabled: false }, Validators.required],
      payingAmount: [{ value: '', disabled: false }, Validators.required],
    })
  }

  checkExistingUser = async() => {
    const vehicleNumber = this.searchWithVehicleNbr.value?.trim();

    if (!vehicleNumber) {
      return;
    }
    const formatedVehicleNbr = this.formateVehicleNumber(vehicleNumber);

    const customerDetails = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr, 'vehicleNbr');
    if(customerDetails && customerDetails.customerType === 'Monthly') {
      this.monthlyPaymentForm.patchValue({
        vehicleNumber: customerDetails.vehicleNumber,
        vehicleType: customerDetails.vehicleType,
        customerName: customerDetails.customerName,
        amount: customerDetails.amount,
        advance: customerDetails.advance
      });
    }
  }

  private formateVehicleNumber(value: string): string {
    return value
      .toUpperCase()
      // .replace(/\s+/g, '')
      .trim();
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
  
  }

  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key = event.key;
  
    const rawValue = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const control = this.searchWithVehicleNbr;
  
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key))
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
      if (!/^[a-zA-Z0-9]$/.test(key)) {
        event.preventDefault();
        return;
      }
    }
  
    if (rawValue.length >= 6 && rawValue.length < 10) {
      if (!/^[0-9]$/.test(key)) {
        event.preventDefault();
        control?.setErrors({ digitExpected: true });
        return;
      }
    }
  
    if (rawValue.length >= 10) {
      event.preventDefault();
    }
  }

  openDialog() {
    const dialogRef = this.dialog.open(PaymentConfirmationComponent, {
      width: '500px',
      height: '220px',
      data: { customer: this.searchWithVehicleNbr.value,
              amount: this.payingAmount.value,
              transactionDate: this.transactionDate.value } 
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result === 'confirm') {
        this.proceedTransaction();
      } else {
        console.log('Transaction cancelled');
      }
    });
  }

  proceedTransaction = async() => {
    try {
      const customer = this.searchWithVehicleNbr.value;

      const transactionData = {
        monthlyCost: this.monthlyPaymentForm.get('amount')?.value,
        advance: this.monthlyPaymentForm.get('advance')?.value,
        paymentMethod: this.monthlyPaymentForm.get('paymentMethod')?.value,
        transactionAmount: this.payingAmount.value,
        transactionDate: this.transactionDate.value 
      }
  
      await this.transactionService.customerMonthlyTransactionDetails(customer, transactionData);
      this.monthlyPaymentForm.reset();
      this.payingAmount.setValue(0);
      this.transactionDate.setValue('');
      this.searchWithVehicleNbr.setValue('');
      this.snackBar.open('Transaction successfull!', 'Close', {
        duration: 4000,     
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['snackbar-success'],
      });
    } catch (error) {
      this.snackBar.open('Transaction Failed. Try again!', 'Close', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['snackbar-error'],
      });
    }
  }

  

  closeForm() {
    this.router.navigate(['/dashBoard']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
