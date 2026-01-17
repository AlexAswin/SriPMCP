import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ButtonComponent } from '../Common/button/button.component';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { MatDialog } from '@angular/material/dialog';
import { PaymentConfirmationComponent } from '../payment-confirmation/payment-confirmation.component';
import { TransactionService } from '../transaction.service';

@Component({
  selector: 'app-monthly-payments',
  standalone: true,
  imports: [MatFormFieldModule, CommonModule, ReactiveFormsModule, ButtonComponent, MatInputModule, MatOptionModule],
  templateUrl: './monthly-payments.component.html',
  styleUrl: './monthly-payments.component.scss'
})
export class MonthlyPaymentsComponent implements OnInit{

  monthlyPaymentForm!: FormGroup;
  searchWithVehicleNbr = new FormControl<string | null>('');
  payingAmount = new FormControl<number | null>(null);
  transactionDate = new FormControl<string | null>(null);
  readonly dialog = inject(MatDialog);
  

  ngOnInit() {
    this.monthlyPaymentFormDetails();
  }

  constructor (private fb: FormBuilder,
                private newCustomerEntryService: NewCustomerEntryService,
                private transactionService: TransactionService) { }

  monthlyPaymentFormDetails = () => {
    this.monthlyPaymentForm = this.fb.group({
      vehicleNumber: [{ value: '', disabled: false }, Validators.required],
      vehicleType: [{ value: '', disabled: false }, Validators.required],
      customerName: [{ value: '', disabled: false }, Validators.required],
      amount: [{ value: '', disabled: false }, Validators.required],
      advance: [{ value: '', disabled: false }, Validators.required],
      transactionDate: [{ value: '', disabled: false }, Validators.required],
      payingAmount: [{ value: '', disabled: false }, Validators.required],
    })
  }

  checkExistingUser = async() => {
    const vehicleNumber = this.searchWithVehicleNbr.value?.trim();

    if (!vehicleNumber) {
      console.log('No vehicle number entered');
      return;
    }
    const formatedVehicleNbr = this.formateVehicleNumber(vehicleNumber);

    const customerDetails = await this.newCustomerEntryService.getVehicleByNumber(formatedVehicleNbr);
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
      .replace(/\s+/g, '')
      .trim();
  }

  openDialog() {
    const dialogRef = this.dialog.open(PaymentConfirmationComponent, {
      width: '500px',
      height: '220px',
      data: { customer: this.searchWithVehicleNbr.value,
              amount: this.payingAmount.value,
              transactionDate: this.transactionDate.value } 
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('Dialog result:', result);
      if (result === 'confirm') {
        this.proceedTransaction();
      } else {
        console.log('Transaction cancelled');
      }
    });
  }

  proceedTransaction = async() => {
    console.log('Transaction processing...');
    const customer = this.searchWithVehicleNbr.value;

    const transactionData = {
      monthlyCost: this.monthlyPaymentForm.get('amount')?.value,
      advance: this.monthlyPaymentForm.get('advance')?.value,
      transactionAmount: this.payingAmount.value,
      transactionDate: this.transactionDate.value 
    }

    await this.transactionService.customerMonthlyTransactionDetails(customer, transactionData)

  }

}
