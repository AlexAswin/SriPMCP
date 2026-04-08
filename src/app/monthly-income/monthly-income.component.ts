import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { MatCard, MatCardTitle, MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  firstValueFrom,
  forkJoin,
  map,
  of,
  shareReplay,
  take,
  takeUntil,
} from 'rxjs';
import { TransactionService } from '../transaction.service';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';
import { MatRadioModule } from '@angular/material/radio';
import { MatSliderModule } from '@angular/material/slider';
import { ButtonComponent } from '../Common/button/button.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';

type SortKey = 'date' | 'pending';
interface Totals {
  totalAmount: number;
  totalPaid: number;
  totalBalance: number;
}
// ── interfaces ───────────────────────────────────────────────────────────────
interface Transaction {
  id?: string;
  transactionDate?: string;
  transactionAmount?: number;
  transactionType?: string;
  existingPending?: number;
  newPending?: number;
}

interface CustomerTransactions {
  monthlyCost?: number;
  previousPending?: number;
  amountToPay?: number;
  transactionAmount?: number;
  currentPending?: number;
  lastTransactionDate?: string | null;
  paymentMethod?: string;
  currentMonthTotal?: number;
  isTransactionMade?: boolean;
  transactionHistory?: Transaction[];
}

interface Customer {
  vehicleNumber?: string;
  monthlyStatus?: 'Active' | 'InActive';
  amount: number;
  Transactions?: CustomerTransactions;
  FullTransactionHistory?: Transaction[];
  displayMonth?: string;
}

interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}

interface FilterState {
  showActive: boolean;
  showInactive: boolean;
  minPending: number | null;
  maxPending: number | null;
  fromDate: string | null;
  toDate: string | null;
  sort: SortState | null;
  vehicleFilter: string;
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
  minPending: any = null;
  filterByPending: boolean = false;

  filteredByDate: boolean = false;

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
  totalBalanceActiveCustomers$!: Observable<number>;

  vehicleFilter$ = new BehaviorSubject<string>('');

  private destroy$ = new Subject<void>();
  showHistory: boolean = false;

  // filteredByDate: boolean = true

  constructor(private transactionService: TransactionService) {}

  ngOnInit(): void {
    this.allCustomers$ = this.transactionService
      .getAllCustomersWithTransactions()
      .pipe(shareReplay(1));

    const filters$: Observable<FilterState> = combineLatest({
      showActive: this.showActive$,
      showInactive: this.showInactive$,
      minPending: this.minPending$,
      maxPending: this.maxPending$,
      fromDate: this.fromDate$,
      toDate: this.toDate$,
      sort: this.sort$,
      vehicleFilter: this.vehicleFilter$,
    });

    this.filteredCustomers$ = combineLatest([
      this.allCustomers$,
      filters$,
    ]).pipe(
      map(([customers, filters]) => this.applyFilters(customers, filters))
    );

    this.setupTotals();
  }

  private getMonthsInRange(d1: Date, d2: Date): string[] {
    const months: string[] = [];
    const current = new Date(d1.getFullYear(), d1.getMonth(), 1);
    const last = new Date(d2.getFullYear(), d2.getMonth(), 1);

    while (current <= last) {
      months.push(current.toISOString().substring(0, 7));
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }

  private buildTransactionMonthRow(
    customer: Customer,
    monthKey: string,
    txs: Transaction[]
  ): Customer {
    const monthlyCost = customer.amount;

    const sorted = [...txs].sort((a, b) =>
      (a.transactionDate ?? '').localeCompare(b.transactionDate ?? '')
    );

    const firstTx = sorted[0];
    const lastTx = sorted[sorted.length - 1];
    const amountToPay = firstTx.existingPending ?? monthlyCost;
    const rawPrevious = amountToPay - monthlyCost;

    const isIdle = sorted.every(
      (t) => t.transactionType === 'No Transactions' || t.id?.includes('_IDLE')
    );

    return {
      ...customer,
      displayMonth: monthKey,
      Transactions: {
        ...customer.Transactions,
        monthlyCost,
        previousPending: rawPrevious > 0 ? rawPrevious : 0,
        amountToPay,
        transactionAmount: sorted.reduce(
          (sum, t) => sum + (t.transactionAmount ?? 0),
          0
        ),
        currentPending: lastTx.newPending ?? amountToPay,
        lastTransactionDate: isIdle ? null : lastTx.transactionDate ?? null,
        paymentMethod: isIdle
          ? 'Not Done'
          : sorted.length > 1
          ? 'Multiple'
          : lastTx.transactionType ?? 'Not Done',
      },
    };
  }

  private applyFilters(
    customers: Customer[],
    filters: FilterState
  ): Customer[] {
    const {
      showActive,
      showInactive,
      minPending,
      maxPending,
      fromDate,
      toDate,
      sort,
      vehicleFilter,
    } = filters;

    const minVal = minPending ?? 0;
    const maxVal = maxPending ?? Number.MAX_SAFE_INTEGER;

    const baseList = customers.filter((c) => {
      const vehicleMatch =
        !vehicleFilter ||
        c.vehicleNumber?.toUpperCase().includes(vehicleFilter.toUpperCase());

      const statusMatch =
        (showActive && c.monthlyStatus === 'Active') ||
        (showInactive && c.monthlyStatus === 'InActive');

      return vehicleMatch && statusMatch;
    });

    if (fromDate && toDate) {
      this.filteredByDate = true;

      const parsedFrom = new Date(fromDate + 'T00:00:00');
      const parsedTo = new Date(toDate + 'T00:00:00');
      const targetMonths = this.getMonthsInRange(parsedFrom, parsedTo);

      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}`;

      return baseList
        .flatMap((customer) => {
          const history: Transaction[] = customer.FullTransactionHistory ?? [];

          const inRangeHistory = history.filter((tx) => {
            if (tx.id?.includes('_IDLE')) return false;
            const txDate = tx.transactionDate;
            if (!txDate) return false;
            return txDate >= fromDate && txDate <= toDate;
          });

          const monthsGroup = new Map<string, Transaction[]>();
          for (const tx of inRangeHistory) {
            const monthKey = tx.transactionDate!.substring(0, 7);
            if (targetMonths.includes(monthKey)) {
              const group = monthsGroup.get(monthKey) ?? [];
              group.push(tx);
              monthsGroup.set(monthKey, group);
            }
          }

          return targetMonths.map((monthKey) => {
            const txs = monthsGroup.get(monthKey);

            if (!txs || txs.length === 0) {
              const monthlyCost = customer.amount;
              const isPastMonth = monthKey < currentMonthStr;

              const lastKnownTx = [...history]
                .filter(
                  (t) =>
                    !t.id?.includes('_IDLE') &&
                    t.transactionDate &&
                    t.transactionDate.substring(0, 7) < monthKey
                )
                .sort((a, b) =>
                  (b.transactionDate ?? '').localeCompare(
                    a.transactionDate ?? ''
                  )
                )[0];

              const previousPending = lastKnownTx?.newPending ?? 0;
              const amountToPay = previousPending + monthlyCost;

              return {
                ...customer,
                displayMonth: monthKey,
                Transactions: {
                  ...customer.Transactions,
                  monthlyCost,
                  previousPending,
                  amountToPay,
                  transactionAmount: 0,
                  currentPending: isPastMonth
                    ? amountToPay
                    : customer.Transactions?.currentPending ?? amountToPay,
                  lastTransactionDate: null,
                  paymentMethod: 'Not Done',
                },
              } as Customer;
            }

            return this.buildTransactionMonthRow(customer, monthKey, txs);
          });
        })
        .filter((row) => {
          const bal = row.Transactions?.currentPending ?? 0;
          return bal >= minVal && bal <= maxVal;
        })
        .sort((a, b) => this.applySorting(a, b, sort));
    }

    this.filteredByDate = false;

    return baseList
      .map((c) => {
        const trans = c.Transactions ?? {};
        const monthlyCost = c.amount;
        const amountToPay = trans.currentMonthTotal ?? monthlyCost;

        return {
          ...c,
          Transactions: {
            ...trans,
            monthlyCost,
            previousPending: Math.max(0, amountToPay - monthlyCost),
            amountToPay,
            transactionAmount: trans.transactionAmount ?? 0,
            currentPending: trans.currentPending ?? 0,
          },
        };
      })
      .filter((c) => {
        const bal = c.Transactions?.currentPending ?? 0;
        return bal >= minVal && bal <= maxVal;
      })
      .sort((a, b) => this.applySorting(a, b, sort));
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
      map((items) =>
        items.reduce(
          (acc, i) => {
            const trans = i.Transactions;
            return {
              monthlyCost: acc.monthlyCost + Number(trans?.monthlyCost || 0),
              prevPending:
                acc.prevPending + Number(trans?.previousPending || 0),
              paid: acc.paid + Number(trans?.transactionAmount || 0),
              balance: acc.balance + Number(trans?.currentPending || 0),
            };
          },
          { monthlyCost: 0, prevPending: 0, paid: 0, balance: 0 }
        )
      ),
      shareReplay(1)
    );

    this.totalMonthlyCost$ = totals$.pipe(map((t) => t.monthlyCost));
    this.totalPreviousPending$ = totals$.pipe(map((t) => t.prevPending));
    this.totalPaid$ = totals$.pipe(map((t) => t.paid));
    this.totalBalance$ = combineLatest([
      this.totalMonthlyCost$,
      this.totalPaid$,
    ]).pipe(map(([cost, totalPaid]) => cost - totalPaid));

    this.totalBalanceActiveCustomers$ = totals$.pipe(map((t) => t.balance));

    this.totalAmountToPay$ = combineLatest([
      this.totalMonthlyCost$,
      this.totalPreviousPending$,
    ]).pipe(map(([cost, prev]) => cost + prev));
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

    if (
      [
        'Backspace',
        'Delete',
        'Tab',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
      ].includes(key)
    )
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

    this.minPending = null;
    this.maxPending = null;

    this.fromDate$.next(null);
    this.toDate$.next(null);
    this.minPending$.next(null);
    this.maxPending$.next(null);

    this.showActive$.next(true);
    this.showInactive$.next(false);
  }

  createNewLedger = () => {
    this.transactionService.createNewMonthLedger();
  };

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
