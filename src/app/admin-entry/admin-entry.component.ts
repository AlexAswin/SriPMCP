import { Component, OnDestroy, OnInit } from '@angular/core';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import { ButtonComponent } from '../Common/button/button.component';
import {ChangeDetectionStrategy, signal} from '@angular/core';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIconModule} from '@angular/material/icon';
import { AdminService, VehicleType } from '../admin.service';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, take, takeUntil } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { TransactionService } from '../transaction.service';
import { MatCard, MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-admin-entry',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, ButtonComponent, MatExpansionModule, MatIconModule, ReactiveFormsModule,
            MatSelectModule, MatOptionModule, CommonModule, MatListModule, RouterModule, MatCard, MatTabsModule, MatChipsModule, MatCardModule],
  templateUrl: './admin-entry.component.html',
  styleUrl: './admin-entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEntryComponent implements OnInit, OnDestroy {

  vehicleTypes = signal<VehicleType[]>([]);
  editVehicleDetails = signal<boolean>(false);
  
  vehicleForm!: FormGroup;
  expenseForm!: FormGroup;
  paymentForm!: FormGroup;
  vehicleUpdateForm!: FormGroup;
  deleteCustomerForm!: FormGroup;

  expenses$!: Observable<any[]>;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private transactionService: TransactionService
  ) {}

  ngOnInit() {
    this.initAllForms();
    this.loadInitialData();
  }


  private initAllForms() {
    const priceValidators = [Validators.required, Validators.min(0)];
  
    this.vehicleForm = this.fb.group({
      vehicleType: ['', Validators.required],
      monthlyCost: ['', priceValidators],
      dailyCost: ['', priceValidators],
    });
  
    this.expenseForm = this.fb.group({
      expenseType: ['', Validators.required],
    });
  
    this.paymentForm = this.fb.group({
      paymentMethod: ['', Validators.required],
    });
  
    this.vehicleUpdateForm = this.fb.group({
      vehicleType: [{ value: '', disabled: true }, Validators.required],
      duration: ['Monthly', Validators.required],
      updatedPrice: ['', priceValidators]
    });
  
    this.deleteCustomerForm = this.fb.group({
      vehicleNumber: ['', Validators.required]
    });
  }

  private loadInitialData() {

    this.adminService.getVehicleTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.vehicleTypes.set(data); 
      });

    this.expenses$ = this.adminService.getExpenses();
  }

openEditMode(vehicle: any) {
  this.editVehicleDetails.set(true);
  this.vehicleUpdateForm.patchValue({
    vehicleType: vehicle.vehicleType,
    duration: 'Monthly',
    updatedPrice: vehicle.monthlyCost
  });
}

cancelEdit() {
  this.editVehicleDetails.set(false);
  this.vehicleUpdateForm.reset({ duration: 'Monthly' });
}

async saveVehicle() {
  if (this.vehicleForm.invalid) return;
  
  try {
    await this.adminService.addVehicle(this.vehicleForm.value);
    this.vehicleForm.reset();
  } catch (err) {
    console.error("Error adding vehicle:", err);
  }
}

async updateVehicleDetails() {
  if (this.vehicleUpdateForm.invalid) return;

  const { vehicleType, updatedPrice, duration } = this.vehicleUpdateForm.getRawValue();

  try {
    await this.adminService.updateVehiclePrice(vehicleType, Number(updatedPrice), duration);
    this.cancelEdit();
    // Show success message here
  } catch (err) {
    console.error("Update failed:", err);
  }
}

restrictVehicleInput(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement;
  const key = event.key;

  const rawValue = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const control = this.deleteCustomerForm.get('vehicleNumber');

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

onVehicleNumberInput(event: Event) {
  const input = event.target as HTMLInputElement;

  let raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  raw = raw.substring(0, 10);

  if(raw === '') {
    // this.cancelEntry();
    return;
  }

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

  this.deleteCustomerForm
    .get('vehicleNumber')
    ?.setValue(input.value, { emitEvent: false });
}

restrictNegativeVehicleInput(event: KeyboardEvent) {
  if (['-', 'e', '+'].includes(event.key)) {
    event.preventDefault();
  }
}


async deleteVehicle() {

  const vehicleType = this.vehicleUpdateForm.getRawValue().vehicleType;
  
  if (!vehicleType) return;


  const confirmDelete = confirm(`Are you sure you want to delete "${vehicleType}"? This will remove it from the selection list.`);
  
  if (confirmDelete) {
    try {

      await this.adminService.deleteVehicle(vehicleType);
      
      this.cancelEdit(); 
         
      console.log(`${vehicleType} deleted successfully`);
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert('Could not delete vehicle. Please try again.');
    }
  }
}

async savePayment() {

  if (this.paymentForm.invalid) {
    this.paymentForm.markAllAsTouched();
    return;
  }

  try {

    const payload = this.paymentForm.value;


    await this.adminService.addPaymentMethod(payload);


    this.paymentForm.reset();
    this.paymentForm.markAsPristine();
    this.paymentForm.markAsUntouched();
    
    console.log('Payment method added successfully');

  } catch (error) {
    console.error('Error saving payment method:', error);

  }
}


async saveExpense() {
  if (this.expenseForm.invalid) return;
  try {
    await this.adminService.addExpense(this.expenseForm.value);
    this.expenseForm.reset();
  } catch (err) {
    console.error(err);
  }
}

async deleteExpense(id: string) {
  if (confirm('Delete this expense category?')) {
    try {
      await this.adminService.deleteExpense(id);
    } catch (err) {
      console.error(err);
    }
  }
}

async deleteCustomerRecord() {
  if (this.deleteCustomerForm.invalid) return;
  
  const vNbr = this.deleteCustomerForm.value.vehicleNumber;
  if (confirm(`Are you sure you want to delete transactions for ${vNbr}?`)) {
    try {
      await this.transactionService.deleteCustomerCurrentMonthTransaction(vNbr);
      this.deleteCustomerForm.reset();
      alert('Record deleted successfully');
    } catch (err) {
      alert('Error deleting record');
    }
  }
}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}  
