import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { MatCard, MatCardTitle, MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule} from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Observable, Subject, combineLatest, firstValueFrom, forkJoin, map, of, take, takeUntil } from 'rxjs';
import { TransactionService } from '../transaction.service';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule} from '@angular/material/sidenav';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { MatRadioModule } from "@angular/material/radio";
import {MatSliderModule} from '@angular/material/slider';
import { ButtonComponent } from "../Common/button/button.component";
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatCheckboxModule} from '@angular/material/checkbox';

export interface Task {
  name: string;
  completed: boolean;
  subtasks?: Task[];
}

type SortKey = 'date' | 'pending';

@Component({
  selector: 'app-monthly-income',
  standalone: true,
  imports: [MatCard, MatCardTitle, MatTableModule, MatChipsModule, CommonModule, MatIconModule, MatSidenavModule, FormsModule,
    MatToolbarModule, MatNativeDateModule, MatDatepickerModule, MatInputModule, ReactiveFormsModule, RouterModule, MatRadioModule, MatCardModule,
    MatSliderModule, ButtonComponent, MatSlideToggleModule, MatCheckboxModule],
    providers: [],
  templateUrl: './monthly-income.component.html',
  styleUrl: './monthly-income.component.scss'
})
export class MonthlyIncomeComponent implements OnInit, OnDestroy {
  allCustomersWithLedgers$!: Observable<any[]>;
  activeCustomersWithLedger$!: Observable<any[]>;
  inactiveCustomersWithLedger$!: Observable<any[]>;
  displayedCustomers$: Observable<any[]> | null = null;

  inactiveCustomers: boolean = false;
  activeCustomers: boolean = false

  currentMonth: string = '';

  events: string[] = [];
  opened = false;
  activeCustomersWithLedgerData: any[] = [];
  private destroy$ = new Subject<void>();

  expectedMonthlyIncome$!: Observable<any[]>;
  totalMonthlyTransaction$!: Observable<any[]>;
  totalPending$!: Observable<any[]>;
  filteredActiveCustomersWithLedger$!: Observable<any[]>;

  sortKey: SortKey | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  
  sort$ = new BehaviorSubject<{
    key: SortKey;
    direction: 'asc' | 'desc';
  } | null>(null);
  
  activeCustomersAndBalanceColumns = [ 'vehicle', 'name', 'Advance', 'monthlyCost', 'paid', 'balance', 'date', 'payMethod' ];

  customerType = 'Active';
  customerTypes: string[] = ['Active', 'InActive'];
  showActive = true;
  showInactive = false;

  maxPending: number = null || 0;
  minPending = 0;
  value = 0;
  private filterCriteria$ = new BehaviorSubject<{min: number, max: number} | null>(null);

  fromDate: Date | null = null;
  toDate: Date | null = null;
  dateFilter$ = new BehaviorSubject<{ from: Date | null; to: Date | null } | null>(null);
  


  constructor ( private transactionService: TransactionService ) {

  }

  ngOnInit() {
    this.getActiveMonthlyUsers();
  }

  getActiveMonthlyUsers = () => {
    this.currentMonth = new Date().toLocaleString('default', { month: 'long' });
  
    this.allCustomersWithLedgers$ =
      this.transactionService.getActiveMonthlyCustomers();
  
    this.activeCustomersWithLedger$ = combineLatest([
      this.allCustomersWithLedgers$,
      this.filterCriteria$,
      this.dateFilter$,
      this.sort$
    ]).pipe(
      map(([customers, range, dateRange, sort]) => {
        let activeList = customers;

        if (range) {
          activeList = activeList.filter(c =>
            c.Transactions?.currentPending >= range.min &&
            c.Transactions?.currentPending <= range.max
          );
        }

        if (dateRange?.from && dateRange?.to) {
          const from = this.normalizeDate(dateRange.from);
          const to = this.normalizeDate(dateRange.to);
  
          activeList = activeList.filter(c => {
            if (!c.Transactions?.lastTransactionDate) return false;
  
            const txn = this.normalizeDate(new Date(c.Transactions.lastTransactionDate));
            return txn >= from && txn <= to;
          });
        }
  
        if (sort) {
          activeList = [...activeList].sort((a, b) => {
            if (sort.key === 'date') {
              return sort.direction === 'asc'
                ? new Date(a.Transactions.lastTransactionDate).getTime() -
                  new Date(b.Transactions.lastTransactionDate).getTime()
                : new Date(b.Transactions.lastTransactionDate).getTime() -
                  new Date(a.Transactions.lastTransactionDate).getTime();
            }
  
            if (sort.key === 'pending') {
              return sort.direction === 'asc'
                ? a.Transactions.currentPending - b.Transactions.currentPending
                : b.Transactions.currentPending - a.Transactions.currentPending;
            }
  
            return 0;
          });
        }
  
        return activeList;
      })
    );
  
    if (this.showInactive && !this.inactiveCustomersWithLedger$) {
      this.loadInactiveCustomers();
    }
  
    this.updateDisplayedCustomers();
    this.calculateMonthlySummary();
  };
  
  toggleSidenav = () => {
    this.opened = !this.opened;
  }

  toggleAll(checked: boolean) {
    this.showActive = checked;
    this.showInactive = checked;
  
    if (checked && !this.inactiveCustomersWithLedger$) {
      this.loadInactiveCustomers();
    }
    this.updateDisplayedCustomers();
  }
  
  toggleActive(checked: boolean) {
    this.showActive = checked;
    this.updateDisplayedCustomers();
  }
  
  toggleInactive(checked: boolean) {
    this.showInactive = checked;  
    if (checked && !this.inactiveCustomersWithLedger$) {
      this.loadInactiveCustomers();
    }
    this.updateDisplayedCustomers();
  }

  loadInactiveCustomers() {
    this.inactiveCustomersWithLedger$ =
      this.transactionService.getInactiveCustomersWithLastTransaction().pipe(
        map(customers => customers.filter(c => c.Transactions != null))
      );
    this.updateDisplayedCustomers();
  }
  
  updateDisplayedCustomers() {
    const active$ = this.showActive ? this.activeCustomersWithLedger$! : of([]);
    const inactive$ = this.showInactive ? this.inactiveCustomersWithLedger$! : of([]);

    if(this.showActive && !this.showInactive) {
      this.customerType = 'Active'
    } else if (!this.showActive && this.showInactive) {
      this.customerType = 'InActive'
    } else {
      this.customerType = ''
    }
  
    this.displayedCustomers$ = combineLatest([active$, inactive$]).pipe(
      map(([active, inactive]) => [...active, ...inactive])
    );
  }

  showFilteredPending = () => {
    this.filterCriteria$.next({ 
      min: this.minPending, 
      max: this.maxPending 
    });
  }

  resetFilteredPending = () => {
    this.filterCriteria$.next(null);
  }

  onFromDateChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.fromDate = value ? new Date(value) : null;
    this.emitDateFilter();
  }
  
  onToDateChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.toDate = value ? new Date(value) : null;
    this.emitDateFilter();
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  sortBy(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  
    this.sort$.next({
      key: this.sortKey!,
      direction: this.sortDirection
    });
  }
  
  private emitDateFilter() {
    this.dateFilter$.next({
      from: this.fromDate,
      to: this.toDate
    });
  }

  calculateMonthlySummary = () => {

    const summary$ = this.allCustomersWithLedgers$.pipe(
      take(1),
      map(customers => {
  
        return customers.reduce(
          (acc, customer) => {
  
            const monthlyCost = Number(customer.Transactions?.monthlyCost ?? 0);
            const paid = Number(customer.Transactions?.transactionAmount ?? 0);
            const pending = Number(customer.Transactions?.currentPending ?? 0);
  
            acc.expected += monthlyCost;
            acc.paid += paid;
            acc.pending += pending;
  
            return acc;
  
          },
          {
            expected: 0,
            paid: 0,
            pending: 0
          }
        );
      })
    );
  
    this.expectedMonthlyIncome$ = summary$.pipe(map(s => s.expected));
    this.totalMonthlyTransaction$ = summary$.pipe(map(s => s.paid));
    this.totalPending$ = summary$.pipe(map(s => s.pending));
  };
  

  async downloadActiveCustomerPDF() {
    const doc = new jsPDF('l', 'mm', 'a4');
  
    doc.setFontSize(14);
    doc.text(`Monthly Balance Details - ${this.currentMonth}`, 14, 15);
  
    if (this.displayedCustomers$) {
      this.activeCustomersWithLedgerData = await firstValueFrom(this.displayedCustomers$);
    }
  
    const tableBody = this.activeCustomersWithLedgerData?.map((c: any) => [
      c.vehicleNumber,
      c.customerName,
      `Rs ${c.Transactions?.monthlyCost ?? 0}`,
      '', 
      '',
      '',
      '',
      ''
    ]);

    const totalColumns = 8;
    const pageWidth = doc.internal.pageSize.getWidth();
    const columnWidth = pageWidth / totalColumns - 4;
  
    autoTable(doc, {
      head: [[
        'Vehicle',
        'Name',
        'Total Amount',
        'Paid',
        'Balance',
        'Transaction Date',
        'Payment Type',
        'Note'
      ]],
      body: tableBody,
      startY: 20,
      styles: {
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [63, 81, 181],
        textColor: 255,
      },
      bodyStyles: {
        lineWidth: 0.3
      },
      columnStyles: {
        0: { cellWidth: columnWidth },
        1: { cellWidth: columnWidth },
        2: { cellWidth: columnWidth },
        3: { cellWidth: columnWidth },
        4: { cellWidth: columnWidth },
        5: { cellWidth: columnWidth },
        6: { cellWidth: columnWidth },
        7: { cellWidth: columnWidth },
      },
      theme: 'grid'
    });
  
    doc.save(`Monthly-Balance-${this.currentMonth}.pdf`);
  }

  downloadFile = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
  
    doc.setFontSize(14);
    doc.text(`${this.customerType} - Customer Details - ${this.currentMonth}`, 14, 15);
  
    if (this.displayedCustomers$) {
      this.activeCustomersWithLedgerData = await firstValueFrom(
        this.displayedCustomers$.pipe(take(1))
      );
    }
  
    const tableBody = this.activeCustomersWithLedgerData?.map((c: any) => [
      c.vehicleNumber,
      c.customerName,
      `Rs ${c.Transactions?.monthlyCost ?? 0}`,
      `Rs ${c.Transactions?.transactionAmount ?? 0}`,
      `Rs ${c.Transactions?.currentPending ?? 0}`,
      `${c.Transactions?.lastTransactionDate ?? 'No Transactions'}`,
      `${c.Transactions?.paymentMethod ?? 'Not Done'}`,
    ]);
  
    autoTable(doc, {
      head: [[
        'Vehicle',
        'Name',
        'Total Amount',
        'Paid',
        'Balance',
        'Transaction Date',
        'Payment Type',
      ]],
      body: tableBody,
      startY: 20,
      styles: {
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [63, 81, 181],
        textColor: 255,
      },
      theme: 'grid'
    });
  
    // ======================================
    // ✅ ADD SUMMARY BELOW TABLE
    // ======================================
  
    const finalY = (doc as any).lastAutoTable.finalY + 10;
  
    const expected = await firstValueFrom(this.expectedMonthlyIncome$.pipe(take(1)));
    const paid = await firstValueFrom(this.totalMonthlyTransaction$.pipe(take(1)));
    const pending = await firstValueFrom(this.totalPending$.pipe(take(1)));
  
    doc.setFontSize(11);
  
    doc.text(`Total Expected Income : Rs ${expected}`, 14, finalY);
    doc.text(`Monthly Transaction : Rs ${paid}`, 14, finalY + 7);
    doc.text(`Amount Pending : Rs ${pending}`, 14, finalY + 14);
  
    doc.save(`Monthly-Customer-Details-${this.currentMonth}.pdf`);
  };
  

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
