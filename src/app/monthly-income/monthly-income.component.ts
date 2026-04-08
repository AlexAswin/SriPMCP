import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { MatCard, MatCardTitle, MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule} from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Observable, Subject, combineLatest, firstValueFrom, forkJoin, map, of, shareReplay, take, takeUntil } from 'rxjs';
import { TransactionService } from '../transaction.service';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule} from '@angular/material/sidenav';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
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


type SortKey = 'date' | 'pending';
interface Totals {
  totalAmount: number;
  totalPaid: number;
  totalBalance: number;
}

@Component({
  selector: 'app-monthly-income',
  standalone: true,
  imports: [
    MatCard,
    MatCardTitle,
    MatTableModule,
    MatChipsModule,
    CommonModule,
    MatIconModule,
    MatSidenavModule,
    FormsModule,
    MatToolbarModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterModule,
    MatRadioModule,
    MatCardModule,
    MatSliderModule,
    ButtonComponent,
    MatSlideToggleModule,
    MatCheckboxModule,
  ],
  providers: [],
  templateUrl: './monthly-income.component.html',
  styleUrl: './monthly-income.component.scss',
})
export class MonthlyIncomeComponent implements OnInit, OnDestroy {
  allCustomers$!: Observable<any[]>;
  filteredCustomers$: Observable<any[]> = of([]);
  CustomersWithLedgerData: any[] = [];

  showActive = true;
  showInactive = false;

  maxPending: any = null;
  minPending:any = null;
  filterByPending: boolean = false;

  filteredByDate = false;

  currentMonth: string = '';

  events: string[] = [];
  opened = false;

  searchWithVehicleNbr = new FormControl<string | null>('');

  sortKey: SortKey | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  sort$ = new BehaviorSubject<{
    key: SortKey;
    direction: 'asc' | 'desc';
  } | null>(null);
  showExpandColumn = false;

  CustomersAndBalanceColumns = [
    'vehicle',
    'name',
    'Advance',
    'previousPending',
    'monthlyCost',
    'amountToPay',
    'paid',
    'balance',
    'date',
    'payMethod',
  ];

  customerType = 'Active';
  customerTypes: string[] = ['Active', 'InActive'];

  fromDate: Date | null = null;
  toDate: Date | null = null;
  dateFilter$ = new BehaviorSubject<{
    from: Date | null;
    to: Date | null;
  } | null>(null);

  expandedElement: any | null = null;

  filteredRows: any[] = [];
  showFooter: boolean = true;

  showActive$ = new BehaviorSubject<boolean>(true);
  showInactive$ = new BehaviorSubject<boolean>(false);

  minPending$ = new BehaviorSubject<number | null>(null);
  maxPending$ = new BehaviorSubject<number | null>(null);

  fromDate$ = new BehaviorSubject<string | null>(null);
  toDate$ = new BehaviorSubject<string | null>(null);

  totalMonthlyCost$!: Observable<number>;
  totalAmountToPay$!: Observable<number>;
  totalPreviousPending$!: Observable<number>;
  totalPaid$!: Observable<number>;
  totalBalance$!: Observable<number>;

  vehicleFilter$ = new BehaviorSubject<string>('');

  private destroy$ = new Subject<void>();
  showHistory: boolean = false;

  constructor(private transactionService: TransactionService) {}

  ngOnInit() {
    this.allCustomers$ = this.transactionService
      .getAllCustomersWithTransactions()
      .pipe(shareReplay(1));
  
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
    this.filteredCustomers$ = combineLatest([
      this.allCustomers$,
      this.showActive$,
      this.showInactive$,
      this.minPending$,
      this.maxPending$,
      this.fromDate$,
      this.toDate$,
      this.sort$,
      this.vehicleFilter$
    ]).pipe(
      map(([customers, showActive, showInactive, min, max, start, end, sort, vehicle]) => {
        
        let baseList = customers.filter((c) => {
          const vehicleMatch = !vehicle || c.vehicleNumber?.toUpperCase().includes(vehicle.toUpperCase());
          const statusMatch = (showActive && c.monthlyStatus === 'Active') ||
                             (showInactive && c.monthlyStatus === 'InActive');
          return vehicleMatch && statusMatch;
        });
  
        const minVal = min ?? 0;
        const maxVal = max ?? Number.MAX_SAFE_INTEGER;
  
        if (start && end) {
          const fromDate = new Date(start);
          const toDate = new Date(end);
          // Create a display string for the filter range to use if no transactions exist
          const filterMonthKey = start.substring(0, 7); 
  
          return baseList.flatMap((customer) => {
            const sortedHistory = [...(customer.FullTransactionHistory || [])].sort((a, b) => 
              new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
            );
            
            const monthsGroup = new Map<string, any[]>();
            sortedHistory.forEach(tx => {
              const txDate = new Date(tx.transactionDate);
              if (txDate >= fromDate && txDate <= toDate) {
                const monthKey = tx.transactionDate.substring(0, 7); 
                const existing = monthsGroup.get(monthKey) || [];
                monthsGroup.set(monthKey, [...existing, tx]);
              }
            });
  
            // --- FIX: If no transactions in range, return a default row ---
            if (monthsGroup.size === 0) {
              const monthlyCost = customer.amount || 600;
              // On load/default, amountToPay is their current total
              const amountToPay = customer.Transactions?.currentMonthTotal ?? monthlyCost;
              
              return [{
                ...customer,
                displayMonth: filterMonthKey,
                Transactions: {
                  ...customer.Transactions,
                  monthlyCost: monthlyCost,
                  previousPending: (amountToPay - monthlyCost) > 0 ? (amountToPay - monthlyCost) : 0,
                  amountToPay: amountToPay,
                  transactionAmount: 0,
                  currentPending: (filterMonthKey < currentMonthStr) ? 0 : amountToPay,
                  lastTransactionDate: null,
                  paymentMethod: 'Not Done'
                }
              }];
            }
        
            return Array.from(monthsGroup.entries()).map(([monthKey, txs]) => {
              const firstTx = txs[0];
              const lastTx = txs[txs.length - 1];
              const monthlyCost = customer.amount || 600;
              const amountToPay = firstTx.existingPending ?? monthlyCost;
              
              const isPastMonth = monthKey < currentMonthStr;
              const displayBalance = isPastMonth ? 0 : (lastTx.newPending ?? 0);
  
              return {
                ...customer,
                displayMonth: monthKey,
                Transactions: {
                  ...customer.Transactions,
                  monthlyCost: monthlyCost,
                  previousPending: (amountToPay - monthlyCost) > 0 ? (amountToPay - monthlyCost) : 0,
                  amountToPay: amountToPay,
                  transactionAmount: txs.reduce((sum, t) => sum + (t.transactionAmount || 0), 0),
                  currentPending: displayBalance,
                  lastTransactionDate: lastTx.transactionDate,
                  paymentMethod: txs.length > 1 ? 'Multiple' : lastTx.transactionType
                }
              };
            });
          })
          .filter(row => (row.Transactions?.currentPending ?? 0) >= minVal && (row.Transactions?.currentPending ?? 0) <= maxVal)
          .sort((a, b) => this.applySorting(a, b, sort));
        }
  
        // Default On-Load Logic (Already includes everyone in baseList)
        return baseList
          .map(c => {
            const trans = c.Transactions || {};
            const monthlyCost = c.amount || 600;
            const amountToPay = trans.currentMonthTotal ?? monthlyCost;
  
            return {
              ...c,
              Transactions: {
                ...trans,
                monthlyCost: monthlyCost,
                previousPending: (amountToPay - monthlyCost) > 0 ? (amountToPay - monthlyCost) : 0,
                amountToPay: amountToPay,
                transactionAmount: trans.transactionAmount || 0,
                currentPending: trans.currentPending || 0
              }
            };
          })
          .filter(c => (c.Transactions?.currentPending ?? 0) >= minVal && (c.Transactions?.currentPending ?? 0) <= maxVal)
          .sort((a, b) => this.applySorting(a, b, sort));
      })
    );
  
    this.setupTotals();
  }

  private applySorting(a: any, b: any, sort: any): number {
    if (!sort?.key) return 0;
    let valA: any, valB: any;

    if (sort.key === 'pending') {
      valA = a.Transactions?.currentPending ?? 0;
      valB = b.Transactions?.currentPending ?? 0;
    } else if (sort.key === 'date') {
      valA = new Date(a.Transactions?.lastTransactionDate || 0).getTime();
      valB = new Date(b.Transactions?.lastTransactionDate || 0).getTime();
    }

    return sort.direction === 'asc' ? valA - valB : valB - valA;
  }
  private setupTotals() {
    const totals$ = this.filteredCustomers$.pipe(
      map(items => items.reduce((acc, i) => {
        const trans = i.Transactions;
        return {
          monthlyCost: acc.monthlyCost + Number(trans?.monthlyCost || 0),
          prevPending: acc.prevPending + Number(trans?.previousPending || 0),
          paid: acc.paid + Number(trans?.transactionAmount || 0),
          balance: acc.balance + Number(trans?.currentPending || 0)
        };
      }, { monthlyCost: 0, prevPending: 0, paid: 0, balance: 0 })),
      shareReplay(1)
    );
  
    this.totalMonthlyCost$ = totals$.pipe(map(t => t.monthlyCost));
    this.totalPreviousPending$ = totals$.pipe(map(t => t.prevPending));
    this.totalPaid$ = totals$.pipe(map(t => t.paid));
    this.totalBalance$ = totals$.pipe(map(t => t.balance));
  
    // Now calculate Amount to Pay by combining the relevant streams
    this.totalAmountToPay$ = combineLatest([
      this.totalMonthlyCost$,
      this.totalPreviousPending$
    ]).pipe(
      map(([cost, prev]) => cost + prev)
    );
  }

  toggleAll(value: boolean) {
    this.showActive$.next(value);
    this.showInactive$.next(value);
  }

  showFilteredPending() {
    this.minPending$.next(this.minPending);
    this.maxPending$.next(this.maxPending);
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
      direction: this.sortDirection,
    });
  }

  filterVehicle = (event: Event) => {
    const input = event.target as HTMLInputElement | null;
  
    const vehicleNumber = input?.value?.trim().toUpperCase() || '';
  
    this.vehicleFilter$.next(vehicleNumber);
  
    this.showFooter = vehicleNumber === '';
  };

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

  expandRow(row: any) {
    this.expandedElement = this.isExpanded(row) ? null : row;
  }

  isExpanded(row: any) {
    return this.expandedElement === row;
  }

  resetFilters(fromInput: HTMLInputElement, toInput: HTMLInputElement) {
    fromInput.value = '';
    toInput.value = '';

    this.minPending = 0;
    this.maxPending = 3000000;

    this.fromDate$.next(null);
    this.toDate$.next(null);
    this.minPending$.next(null);
    this.maxPending$.next(null);

    this.showActive$.next(true);
    this.showInactive$.next(false);
  }

  createNewLedger = () => {
    this.transactionService.createNewMonthLedger();
  } 

  async downloadActiveCustomerPDF() {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFontSize(14);
    doc.text(`Monthly Balance Details - ${this.currentMonth}`, 14, 15);

    if (this.filteredCustomers$) {
      this.CustomersWithLedgerData = await firstValueFrom(
        this.filteredCustomers$
      );
    }

    const tableBody = this.CustomersWithLedgerData?.map((c: any) => [
      c.vehicleNumber,
      c.customerName,
      `${c.Transactions?.monthlyCost ?? 0}`,
      '',
      '',
      '',
      '',
      '',
    ]);

    const totalColumns = 8;
    const pageWidth = doc.internal.pageSize.getWidth();
    const columnWidth = pageWidth / totalColumns - 4;

    autoTable(doc, {
      head: [
        [
          'Vehicle',
          'Name',
          'Total Amount',
          'Paid',
          'Balance',
          'Transaction Date',
          'Payment Type',
          'Note',
        ],
      ],
      body: tableBody,
      startY: 20,
      styles: {
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [63, 81, 181],
        textColor: 255,
      },
      bodyStyles: {
        lineWidth: 0.3,
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
      theme: 'grid',
    });

    doc.save(`Monthly-Balance-Sheet ${this.currentMonth}.pdf`);
  }

  downloadFile = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFontSize(14);

    let title = '';

    if (this.filterByPending) {
      title = `Customer Pending Details from ₹${this.minPending} to ₹${this.maxPending}`;
    } else if (this.filteredByDate && this.fromDate && this.toDate) {
      title = `Transactions from ${this.fromDate} to ${this.toDate}`;
    } else if (this.customerType === 'Active') {
      title = 'Active Customer Details';
    } else {
      title = 'InActive Customer Details';
    }

    doc.text(title, 14, 15);

    if (this.filteredCustomers$) {
      this.CustomersWithLedgerData = await firstValueFrom(
        this.filteredCustomers$.pipe(take(1))
      );
    }

    const tableBody = this.CustomersWithLedgerData?.map((c: any) => [
      c.vehicleNumber,
      c.customerName,
      `${c.Transactions?.monthlyCost ?? 0}`,
      `${c.Transactions?.transactionAmount ?? 0}`,
      `${c.Transactions?.currentPending ?? 0}`,
      `${c.Transactions?.lastTransactionDate ?? 'No Transactions'}`,
      `${c.Transactions?.paymentMethod ?? 'Not Done'}`,
    ]);

    autoTable(doc, {
      head: [
        [
          'Vehicle',
          'Name',
          'Total Amount',
          'Paid',
          'Balance',
          'Transaction Date',
          'Payment Type',
        ],
      ],
      body: tableBody,
      startY: 20,
      styles: {
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [63, 81, 181],
        textColor: 255,
      },
      theme: 'grid',
    });

    doc.setFontSize(11);
    let fileName = '';

    if (this.filterByPending) {
      fileName = `PendingCustomersFrom${this.minPending}-to-${this.maxPending} - ${this.currentMonth}.pdf`;
    } else if (this.filteredByDate && this.fromDate && this.toDate) {
      fileName = `TransactionsFrom-${this.fromDate}-to-${this.toDate} - ${this.currentMonth}.pdf`;
    } else if (this.customerType === 'Active') {
      fileName = `Active-Monthly-Customers - ${this.currentMonth}.pdf`;
    } else {
      fileName = `Inactive-Monthly-Customers - ${this.currentMonth}.pdf`;
    }

    doc.save(fileName);
  };

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
