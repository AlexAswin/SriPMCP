import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {FormBuilder, FormGroup, FormGroupDirective, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import { ButtonComponent } from '../Common/button/button.component';
import {ChangeDetectionStrategy, signal} from '@angular/core';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIconModule} from '@angular/material/icon';
import { AdminService, VehicleType } from '../admin.service';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, firstValueFrom, take, takeUntil } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { TransactionService } from '../transaction.service';
import { MatCard, MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { MonthlyIncomeComponent } from '../monthly-income/monthly-income.component';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';

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

  showSettlementDetails: boolean = false;

  expenses$!: Observable<any[]>;
  paymentMethods$!: Observable<any[]>;
  activeCustomers$: any[] = [];


  currentMonth: string = '';


  private destroy$ = new Subject<void>();

  alertMessage: string = '';
  alertType: 'success' | 'error' = 'success';
  activeScenario: 'adjust' | 'deleteLast' | 'deleteById' = 'adjust';

  monthlyStatus: string = ''

  isDeleting = false;
  alert: boolean = false

  @ViewChild(MonthlyIncomeComponent) monthlyIncomeComponent!: MonthlyIncomeComponent;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private transactionService: TransactionService,
    private newCustomerEntryService: NewCustomerEntryService,

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
      // Match the formControlName in your HTML mat-select
      selectedVehicleId: ['', Validators.required],
      // Match the formControlNames in your price inputs
      monthlyCost: ['', priceValidators],
      dailyCost: ['', priceValidators]
    });
  
    this.deleteCustomerForm = this.fb.group({
      vehicleNumber: ['', [Validators.required, Validators.pattern(/^[A-Z]{2}\s[0-9]{2}\s[A-Z]{1,2}\s[0-9]{4}$/)]],
      currentPending: [0],
      settlementAmount: [0]
    });
  }

  private loadInitialData() {

    this.adminService.getVehicleTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.vehicleTypes.set(data); 
      });

    this.expenses$ = this.adminService.getExpenses();
    this.paymentMethods$ = this.adminService.getPaymentMethods();

    this.currentMonth = new Date().toLocaleString('default', { month: 'long' });
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

onTabChange(): void {
  this.vehicleForm.reset();
  this.vehicleUpdateForm.reset();
  this.expenseForm.reset();
  this.paymentForm.reset();
}

createNewLedger = () => {
  this.transactionService.createNewMonthLedger();
};

async saveVehicle(formDirective: FormGroupDirective) {
  if (this.vehicleForm.invalid) return;
  
  try {
    await this.adminService.addVehicle(this.vehicleForm.value);
    this.showAlert('Vehicle added successfully!');

    formDirective.resetForm();

    this.vehicleForm.reset();
    
  } catch (err) {
    console.error("Error adding vehicle:", err);
    this.showAlert('Failed to add vehicle.', 'error');
  }
}

async updateVehicleDetails() {
  const { selectedVehicleId, monthlyCost, dailyCost } = this.vehicleUpdateForm.value;
  
  if (this.vehicleUpdateForm.invalid) {
    this.showAlert('Please enter valid prices.', 'error');
    return;
  }

  const vehicle = this.vehicleTypes().find(v => v.id === selectedVehicleId);
  
  if (vehicle && vehicle.vehicleType) {
    try {
      await this.adminService.updateVehiclePriceBatch(
        vehicle.vehicleType, 
        monthlyCost, 
        dailyCost
      );

      this.showAlert(`Prices for ${vehicle.vehicleType} updated successfully!`);

      this.vehicleUpdateForm.reset();
      
    } catch (error) {
      console.error("Update failed", error);
      this.showAlert('Failed to update vehicle prices. Please try again.', 'error');
    }
  } else {
    this.showAlert('Please select a valid vehicle first.', 'error');
  }
}

restrictVehicleInput(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement;
  const key = event.key;
  if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;

  const control = this.vehicleUpdateForm.get('vehicleNumber');

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
  this.vehicleUpdateForm.get('vehicleNumber')?.setValue(input.value, { emitEvent: false });

  const diff = input.value.length - oldVal.length;
  input.setSelectionRange(oldCursor + diff, oldCursor + diff);
}

restrictNegativeVehicleInput(event: KeyboardEvent) {
  if (['-', 'e', '+'].includes(event.key)) {
    event.preventDefault();
  }
}


async deleteVehicle() {
  const vehicleType = this.vehicleUpdateForm.getRawValue().selectedVehicleId;
  
  if (!vehicleType) {
    this.showAlert('No vehicle selected to delete.', 'error');
    return;
  }

  const confirmDelete = true;
  
  if (confirmDelete) {
    try {
      await this.adminService.deleteVehicle(vehicleType);
      this.cancelEdit(); 
      this.showAlert(`Vehicle "${vehicleType}" deleted successfully!`);
        
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      this.showAlert('Failed to delete vehicle. Please try again.', 'error');
    }
  }
}

onVehicleSelect(vehicleId: string) {
  const selectedVehicle = this.vehicleTypes().find(v => v.id === vehicleId);

  if (selectedVehicle) {
    this.editVehicleDetails.set(true);

    this.vehicleUpdateForm.patchValue({
      selectedVehicleId: vehicleId, 
      monthlyCost: selectedVehicle.monthlyCost,
      dailyCost: selectedVehicle.dailyCost
    });
  } else {
    this.editVehicleDetails.set(false);
    this.vehicleUpdateForm.reset();
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

async deletePaymentMethods(id: string) {
  if (confirm('Delete this Payment Method?')) {
    try {
      await this.adminService.deletePaymentMethod(id);
    } catch (err) {
      console.error(err);
    }
  }
}

private normalizeVehicleNumber(value: string): string {
  return (
    this.reformatVehicleNumber(value).toUpperCase().trim()
  );
}

reformatVehicleNumber(value: any): string {
  if (typeof value !== 'string') return '';
  return value.toUpperCase().replace(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/, '$1 $2 $3 $4');
}

async getCustomerRecord() {
  if (this.deleteCustomerForm.invalid) return;

  const vNbr = this.deleteCustomerForm.value.vehicleNumber;
  const formattedVehicleNbr = this.normalizeVehicleNumber(vNbr);

  try {
    const customerDetails = await this.newCustomerEntryService
      .getVehicleByNumber(formattedVehicleNbr, 'vehicleNbr');

    if (!customerDetails) {
      this.showSettlementDetails = false;
      this.showAlert('Vehicle not found. Please try again.', 'error');
      return;
    }

    // Fetch current month's Transaction subdoc directly
    const now            = new Date();
    const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const currentMonthPending = customerDetails.monthlyTransactions?.[currentMonthId]?.currentPending
      ?? customerDetails.Transactions?.currentPending  // fallback if still on main doc
      ?? 0;

    this.showSettlementDetails = true;
    this.monthlyStatus         = customerDetails.monthlyStatus;

    this.deleteCustomerForm.patchValue({
      currentPending: currentMonthPending,
    });

  } catch (err) {
    this.showSettlementDetails = false;
    this.showAlert('Invalid vehicle. Please try again.', 'error');
    console.error('Error fetching customer record:', err);
  }
}

  async deleteLastTransaction() {
    const vNbr = this.deleteCustomerForm.value.vehicleNumber;
    
    try {
      if (this.monthlyStatus === 'InActive') {
         this.transactionService.deleteCustomerCurrentMonthTransaction(vNbr);
        
        this.showAlert(`Last month transaction history for ${vNbr} deleted successfully!`);
        await this.getCustomerRecord(); 
        
      } else if (this.monthlyStatus === 'Active') {
        this.showAlert(
          `Vehicle ${vNbr} is currently active. Please Inactive the customer to delete records!`, 
          'error'
        );
      }
    } catch (err) {
      console.error("Deletion failed:", err);
      this.showAlert('Failed to delete the record. Please try again.', 'error');
    }
  }

  deleteTransactionById = async (id: string) => {
    const vehicleNbr = this.deleteCustomerForm.value.vehicleNumber;
    const tnxId = id.trim()

    try {
      this.transactionService.deleteTransactionByID(vehicleNbr, tnxId)
      this.showAlert('Transaction deleted successfully...');
    } catch (error) {
      this.showAlert('Something went wrong, Please try again.', 'error');
    }
  }


  async adjustPending() {
    const { vehicleNumber, settlementAmount } = this.deleteCustomerForm.getRawValue();
  
    if (settlementAmount === null || settlementAmount === undefined || settlementAmount < 0) {
      this.showAlert('Please enter a valid settlement amount.', 'error');
      return;
    }
  
    const confirmMsg = `Update pending amount for ${vehicleNumber} to ₹${settlementAmount}?`;
    
    if (confirm(confirmMsg)) {
      try {
        await this.transactionService.updateVehicleCurrentMonthPending(vehicleNumber, settlementAmount);
        
        this.showAlert(`Balance for ${vehicleNumber} updated to ₹${settlementAmount} successfully!`);
  
        this.deleteCustomerForm.get('settlementAmount')?.reset();
        
        await this.getCustomerRecord();
        
      } catch (err) {
        console.error('Adjustment Error:', err);
        this.showAlert('Failed to update the pending amount. Please try again.', 'error');
      }
    }
  }

  async downloadActiveCustomerPDF() {

    const activeCustomers = await firstValueFrom(this.transactionService.getActiveMonthlyCustomers());
  
    const doc = new jsPDF('l', 'mm', 'a4');
  
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
  
    doc.setFillColor(217, 217, 217);
    doc.rect(0, 0, pageWidth, 18, 'F');
  
    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('PMCP', 14, 13);
  
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
  
    const monthLabel = new Date(`${this.currentMonth}-01`).toLocaleDateString('en-IN', { month: 'long'});
    doc.text(`Active Customer Sheet - ${monthLabel}`, pageWidth / 2, 13, { align: 'center' });
  
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(today, pageWidth - 14, 13, { align: 'right' });
  
    doc.setTextColor(0, 0, 0);
  
    const tableBody = (activeCustomers ?? []).map((c: any) => [
      c.vehicleNumber   ?? '',
      c.customerName    ?? '',
      `${c.Transactions?.currentPending ?? 0}`,
      '',
      '',
      '',
      '',
      '',
    ]);
  
    const marginLeft  = 10;
    const marginRight = 10;
    const usableWidth = pageWidth - marginLeft - marginRight; 
  
    const colWidths = {
      vehicle:     usableWidth * 0.15,
      name:        usableWidth * 0.15,
      amountToPay: usableWidth * 0.10,
      paid:        usableWidth * 0.10,
      balance:     usableWidth * 0.10,
      date:        usableWidth * 0.12,
      paymentType: usableWidth * 0.10,
      note:        usableWidth * 0.16,
    };
  
    autoTable(doc, {
      head: [['Vehicle', 'Name', 'Amount To Pay', 'Paid', 'Balance', 'Transaction Date', 'Payment Type', 'Note']],
      body: tableBody,
      startY: 24,
      margin: { left: marginLeft, right: marginRight },
      tableWidth: usableWidth, 
      styles: {
        lineWidth:   0.5,
        lineColor:   [0, 0, 0],
        fontSize:    10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: 0,
        halign: 'center'
      },
      bodyStyles: {
        fillColor: [245, 245, 245],  
        textColor: [0, 0, 0],
        lineWidth:  0.3,
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],  
      },
      columnStyles: {
        0: { cellWidth: colWidths.vehicle,     halign: 'center' },
        1: { cellWidth: colWidths.name,        halign: 'center'   },
        2: { cellWidth: colWidths.amountToPay, halign: 'center'  },
        3: { cellWidth: colWidths.paid,        halign: 'center'  },
        4: { cellWidth: colWidths.balance,     halign: 'center'  },
        5: { cellWidth: colWidths.date,        halign: 'center' },
        6: { cellWidth: colWidths.paymentType, halign: 'center' },
        7: { cellWidth: colWidths.note,        halign: 'center'   },
      },
      theme: 'grid',
    });
  
    doc.save(`Monthly-Balance-Sheet ${monthLabel}.pdf`);
  }

  showAlert(message: string, type: 'success' | 'error' = 'success') {
    this.alert = true;
    this.alertMessage = message;
    this.alertType = type;
  
    setTimeout(() => {
      this.alert = false;
      this.alertMessage = '';
    }, 3000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}  

