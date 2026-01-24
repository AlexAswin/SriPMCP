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

@Component({
  selector: 'app-admin-entry',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, ButtonComponent, MatExpansionModule, MatIconModule, ReactiveFormsModule,
            MatSelectModule, MatOptionModule, CommonModule, MatListModule, RouterModule],
  templateUrl: './admin-entry.component.html',
  styleUrl: './admin-entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEntryComponent implements OnInit, OnDestroy {

  vehicleForm!: FormGroup;
  expenseForm!: FormGroup;
  paymentForm!: FormGroup;
  vehicleUpdateForm!: FormGroup;
  deleteCustomerForm!: FormGroup;

  readonly panelOpenState = signal(false);
  vehicleTypes: VehicleType[] = [];
  expenses$!: Observable<any[]>;

  showExpenses: boolean = false;
  editVehicleDetails: boolean = false;
  private destroy$ = new Subject<void>();


  constructor(
    private fb: FormBuilder,
    private adminService : AdminService,
    private transactionService: TransactionService
  ) {}

  ngOnInit() {
    this.vehicleDetailsForm();
    this.expenseDetailsForm();
    this.paymentDetailsForm();
    this.getVehicle();
    this.expenses$ = this.adminService.getExpenses().pipe(take(1));
    this.updateVehicleForm();
    this.deleteCustomer();
  }

  vehicleDetailsForm = () => {
    this.vehicleForm = this.fb.group({
      vehicleType: ['', Validators.required],
      monthlyCost: ['', Validators.required],
      dailyCost: ['', Validators.required],
    });
  }

  expenseDetailsForm = () => {
    this.expenseForm = this.fb.group({
      expenseType: ['', Validators.required],
    });
  }

  paymentDetailsForm = () => {
    this.paymentForm = this.fb.group({
      paymentMethod: ['', Validators.required],
    });
  }

  updateVehicleForm = () => {
    this.vehicleUpdateForm = this.fb.group({
      vehicleType: ['', Validators.required],
      duration: ['', Validators.required],
      updatedPrice:['']

    })
  }

  deleteCustomer = () => {
    this.deleteCustomerForm = this.fb.group({
      vehicleNumber: ['', Validators.required]
    })
  }

  saveVehicle() {
    if (this.vehicleForm.invalid) return;

    this.adminService.addVehicle(this.vehicleForm.value)
      .then(() => this.vehicleForm.reset());
  }
  
  saveExpense() {
    if (this.expenseForm.invalid) return;

    this.adminService.addExpense(this.expenseForm.value)
      .then(() => this.expenseForm.reset());
  }
  
  savePayment() {
    if (this.paymentForm.invalid) return;

    this.adminService.addPaymentMethod(this.paymentForm.value)
      .then(() => this.paymentForm.reset());
  }

  getVehicle() {
    this.adminService.getVehicleTypes()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(data => {
        this.vehicleTypes = data;
      });
  }


  updateVehicleDetails() {
    const vehicleType = this.vehicleUpdateForm.value.vehicleType;
    const newPrice = Number(this.vehicleUpdateForm.value.updatedPrice);
    const duration = this.vehicleUpdateForm.get('duration')?.value;
  
    if (!vehicleType || !newPrice || !duration) return;
  
    this.adminService
      .updateVehiclePrice(vehicleType, newPrice, duration)
      .then(() => {
        this.vehicleUpdateForm.reset();
        this.vehicleUpdateForm.markAsUntouched();
        this.vehicleUpdateForm.markAsPristine();
      })
      .catch(err => console.error(err));
  }

  deleteVehicle() {
    const vehicleType = this.vehicleUpdateForm.value.vehicleType;
    if (!vehicleType) return;
  
    this.adminService.deleteVehicle(vehicleType)
      .then(() => {
        this.vehicleUpdateForm.reset();
        this.vehicleUpdateForm.markAsUntouched();
        this.getVehicle();
      })
      .catch(err => console.error(err));
  }

  deleteExpense(expenseId: string) {
    this.adminService.deleteExpense(expenseId)
      .then(() => console.log('Expense deleted'))
      .catch(err => console.error(err));
  }

  deleteCustomerRecord = () => {
    const vehicleNumber = this.deleteCustomerForm.value.vehicleNumber;
    this.transactionService.deleteCustomerCurrentMonthTransaction(vehicleNumber)
    .then(() => {
      console.log('Deleted successfully');
    })
    .catch(err => {
      console.error('Error deleting transaction:', err);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  
}
