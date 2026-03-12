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
  // 1. Using Signals for OnPush compatibility
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

  // Grouped form initialization
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
    // 2. Removed take(1) so the list updates in real-time when a vehicle is added
    this.adminService.getVehicleTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.vehicleTypes.set(data); // Updating the signal triggers UI refresh
      });

    this.expenses$ = this.adminService.getExpenses();
  }

  // ACTIONS
 // Sets the Edit Pane state
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
    // No need to call getVehicle() if using a real-time stream in ngOnInit
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
  if (['-', 'e', '+'].includes(event.key)) {
    event.preventDefault();
  }
}

async deleteVehicle() {
  // 1. Get the type from the form (using getRawValue because it might be disabled)
  const vehicleType = this.vehicleUpdateForm.getRawValue().vehicleType;
  
  if (!vehicleType) return;

  // 2. Security Confirmation
  const confirmDelete = confirm(`Are you sure you want to delete "${vehicleType}"? This will remove it from the selection list.`);
  
  if (confirmDelete) {
    try {
      // 3. Call Service
      await this.adminService.deleteVehicle(vehicleType);
      
      // 4. Cleanup UI State
      this.cancelEdit(); // Closes the edit pane and resets the form
      
      // 5. Refresh local list (Optional if using a real-time Signal/Observable)
      // this.getVehicle(); 
      
      console.log(`${vehicleType} deleted successfully`);
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert('Could not delete vehicle. Please try again.');
    }
  }
}

async savePayment() {
  // 1. Validation Guard
  if (this.paymentForm.invalid) {
    this.paymentForm.markAllAsTouched();
    return;
  }

  try {
    // 2. Extract value
    const payload = this.paymentForm.value;

    // 3. Call Service
    await this.adminService.addPaymentMethod(payload);

    // 4. Success UI Update
    this.paymentForm.reset();
    this.paymentForm.markAsPristine();
    this.paymentForm.markAsUntouched();
    
    console.log('Payment method added successfully');
    // Optional: Trigger a snackbar/toast here
  } catch (error) {
    console.error('Error saving payment method:', error);
    // Optional: Show error alert to user
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
