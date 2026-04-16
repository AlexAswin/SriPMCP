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
  monthlyCost?: number;
  isCostAdjustmentMade?: boolean;
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
  isCostAdjustmentMade?: boolean;
  transactionHistory?: Transaction[];
}

interface Customer {
  vehicleNumber?: string;
  monthlyStatus?: 'Active' | 'InActive';
  amount: number;
  fromDateMonthly?: string | null;
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

  customerType: string = 'Active';
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

    this.currentMonth = new Date().toLocaleString('default', { month: 'long' });

    combineLatest({
      showActive:   this.showActive$,
      showInactive: this.showInactive$,
    }).subscribe(({ showActive, showInactive }) => {
      if (showActive && showInactive) {
        this.customerType = '';
      } else if (showActive) {
        this.customerType = 'Active';
      } else if (showInactive) {
        this.customerType = 'InActive';
      } else {
        this.customerType = '';
      }
    });

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
    const trans = customer.Transactions ?? {};
  
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
    const sorted = [...txs].sort((a, b) =>
      (a.transactionDate ?? '').localeCompare(b.transactionDate ?? '')
    );
  
    const firstTx = sorted[0];
    const lastTx  = sorted[sorted.length - 1];
  
    const isIdle = sorted.every(
      (t) => t.transactionType === 'No Transactions' || t.id?.includes('_IDLE')
    );
  
    const totalPaid = sorted.reduce((sum, t) => sum + (t.transactionAmount ?? 0), 0);
  
    if (trans.isCostAdjustmentMade && monthKey === currentMonthStr) {
      const previousPending = firstTx.existingPending ?? 0;
      const monthlyCost     = 0;
      const amountToPay     = previousPending + monthlyCost;
  
      return {
        ...customer,
        displayMonth: monthKey,
        Transactions: {
          ...trans,
          monthlyCost,
          previousPending,
          amountToPay,
          transactionAmount:   totalPaid,
          currentPending:      lastTx.newPending ?? amountToPay,
          lastTransactionDate: isIdle ? null : lastTx.transactionDate ?? null,
          paymentMethod: isIdle
            ? 'Not Done'
            : sorted.length > 1
            ? 'Multiple'
            : lastTx.transactionType ?? 'Not Done',
        },
      };
    }
  
    const monthlyCost = customer.amount;
    const amountToPay = firstTx.existingPending ?? monthlyCost;
    const rawPrevious = amountToPay - monthlyCost;
  
    return {
      ...customer,
      displayMonth: monthKey,
      Transactions: {
        ...trans,
        monthlyCost,
        previousPending: rawPrevious > 0 ? rawPrevious : 0,
        amountToPay,
        transactionAmount:   totalPaid,
        currentPending:      lastTx.newPending ?? amountToPay,
        lastTransactionDate: isIdle ? null : lastTx.transactionDate ?? null,
        paymentMethod: isIdle
          ? 'Not Done'
          : sorted.length > 1
          ? 'Multiple'
          : lastTx.transactionType ?? 'Not Done',
      },
    };
  }

  private applyFilters(customers: Customer[], filters: FilterState): Customer[] {
    const { showActive, showInactive, minPending, maxPending, fromDate, toDate, sort, vehicleFilter } = filters;
  
    const minVal = minPending ?? 0;
    const maxVal = maxPending ?? Number.MAX_SAFE_INTEGER;
  
    const now             = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
    const baseList = customers
      .filter((c) => {
        const vehicleMatch =
          !vehicleFilter ||
          c.vehicleNumber?.toUpperCase().includes(vehicleFilter.toUpperCase());

        const statusMatch =
          (showActive && c.monthlyStatus === 'Active') ||
          (showInactive && c.monthlyStatus === 'InActive');

        return vehicleMatch && statusMatch;
      })
      .map((c) => {
        if (!vehicleFilter) return c;
        const sortedHistory = [...(c.FullTransactionHistory ?? [])].sort(
          (a, b) =>
            (a.transactionDate ?? '').localeCompare(b.transactionDate ?? '')
        );

        return {
          ...c,
          FullTransactionHistory: sortedHistory.map((tx) => {
            const monthKey = (tx.transactionDate ?? '').substring(0, 7);
            const previousPending =
              sortedHistory
                .filter(
                  (t) => (t.transactionDate ?? '').substring(0, 7) < monthKey
                )
                .at(-1)?.newPending ?? 0;

            return {
              ...tx,
              monthlyCost: tx.isCostAdjustmentMade === true ? 0 : c.amount,
              previousPending,
            };
          }),
        };
      });
  
    const withinPendingRange = (row: Customer): boolean => {
      const bal = row.Transactions?.currentPending ?? 0;
      return bal >= minVal && bal <= maxVal;
    };
  
    if (fromDate && toDate) {
      this.filteredByDate = true;
      
    
      const rangeStart   = fromDate.substring(0, 10);
      const rangeEnd     = toDate.substring(0, 10);
      const parsedFrom   = new Date(rangeStart + 'T00:00:00');
      const parsedTo     = new Date(rangeEnd   + 'T00:00:00');
      const targetMonths = this.getMonthsInRange(parsedFrom, parsedTo);

      const isSingleMonth = targetMonths.length === 1;
      const isMultiMonth  = targetMonths.length > 1;

      if (isSingleMonth) {
        this.filteredByDate = false;
      }
    
      return baseList
        .flatMap((customer) => {
          const history: Transaction[] = customer.FullTransactionHistory ?? [];
    
          const customerStartMonth = customer.fromDateMonthly
            ? customer.fromDateMonthly.substring(0, 7)
            : targetMonths[0];
    
          const customerMonths = targetMonths.filter((m) => m >= customerStartMonth);
          if (customerMonths.length === 0) return [];
    
          const monthsGroup = new Map<string, Transaction[]>();
          for (const tx of history) {
            if (tx.id?.includes('_IDLE'))   continue;
            if (!tx.transactionDate)        continue;
            if (tx.transactionDate < rangeStart || tx.transactionDate > rangeEnd) continue;
    
            const mk = tx.transactionDate.substring(0, 7);
            if (!customerMonths.includes(mk)) continue;
    
            const group = monthsGroup.get(mk) ?? [];
            group.push(tx);
            monthsGroup.set(mk, group);
          }
    
          return customerMonths
            .map((monthKey): Customer | null => {
              const txs   = monthsGroup.get(monthKey);
              const trans = customer.Transactions ?? {};
    
              if (txs?.length) {
                return this.buildTransactionMonthRow(customer, monthKey, txs);
              }
    
              const monthlyCost = customer.amount;
    
              if (customer.monthlyStatus === 'InActive' && monthKey !== currentMonthStr) {
                const hasAnyTxInOrBeforeMonth = history.some(
                  (t) => (t.transactionDate ?? '').substring(0, 7) <= monthKey
                );
                if (!hasAnyTxInOrBeforeMonth) return null;
              }
    
              const lastKnownTx = [...history]
                .filter((t) => {
                  const tMonth = t.transactionDate?.substring(0, 7) ?? t.id?.split('_')[0];
                  return tMonth != null && tMonth < monthKey;
                })
                .sort((a, b) => {
                  const aKey = a.transactionDate?.substring(0, 7) ?? a.id?.split('_')[0] ?? '';
                  const bKey = b.transactionDate?.substring(0, 7) ?? b.id?.split('_')[0] ?? '';
                  return bKey.localeCompare(aKey);
                })[0];
    
              const previousPending = lastKnownTx?.newPending ?? 0;
              const amountToPay     = previousPending + monthlyCost;
              const isPastMonth     = monthKey < currentMonthStr;
    
              if (trans.isCostAdjustmentMade && monthKey === currentMonthStr) {
                return {
                  ...customer,
                  displayMonth: monthKey,
                  Transactions: {
                    ...trans,
                    monthlyCost:         trans.monthlyCost      ?? 0,
                    previousPending:     trans.previousPending   ?? previousPending,
                    amountToPay:         trans.currentMonthTotal ?? amountToPay,
                    transactionAmount:   trans.transactionAmount ?? 0,
                    currentPending:      trans.currentPending    ?? 0,
                    lastTransactionDate: null,
                    paymentMethod:       'Not Done',
                  },
                };
              }
    
              return {
                ...customer,
                displayMonth: monthKey,
                Transactions: {
                  ...trans,
                  monthlyCost,
                  previousPending,
                  amountToPay,
                  transactionAmount:   0,
                  currentPending: isPastMonth
                    ? amountToPay
                    : (trans.currentPending ?? amountToPay),
                  lastTransactionDate: null,
                  paymentMethod:       'Not Done',
                },
              };
            })
            .filter((row): row is Customer => row !== null);
        })
        .filter(withinPendingRange)
        .sort((a, b) => this.applySorting(a, b, sort));
    }
  
    this.filteredByDate = false;
  
    return baseList
      .map((c) => {
        const trans       = c.Transactions ?? {};
        const monthlyCost = trans.monthlyCost       ?? 0;
        const amountToPay = trans.currentMonthTotal ?? monthlyCost;
  
        if (trans.isCostAdjustmentMade) {
          return {
            ...c,
            Transactions: {
              ...trans,
              monthlyCost,
              previousPending:   trans.currentMonthTotal ?? 0,
              amountToPay,
              transactionAmount: trans.transactionAmount ?? 0,
              currentPending:    trans.currentPending    ?? 0,
            },
          };
        }
  
        return {
          ...c,
          Transactions: {
            ...trans,
            monthlyCost,
            previousPending:   Math.max(0, amountToPay - monthlyCost),
            amountToPay,
            transactionAmount: trans.transactionAmount ?? 0,
            currentPending:    trans.currentPending    ?? 0,
          },
        };
      })
      .filter(withinPendingRange)
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
              monthlyCost: acc.monthlyCost + Number(trans?.monthlyCost    || 0),
              prevPending: acc.prevPending + Number(trans?.previousPending || 0),
              paid:        acc.paid        + Number(trans?.transactionAmount || 0),
              balance:     acc.balance     + Number(trans?.currentPending  || 0),
            };
          },
          { monthlyCost: 0, prevPending: 0, paid: 0, balance: 0 }
        )
      ),
      shareReplay(1)
    );
  
    this.totalMonthlyCost$            = totals$.pipe(map((t) => t.monthlyCost));
    this.totalPreviousPending$        = totals$.pipe(map((t) => t.prevPending));
    this.totalPaid$                   = totals$.pipe(map((t) => t.paid));
    this.totalBalanceActiveCustomers$ = totals$.pipe(map((t) => t.balance));
  
    this.totalAmountToPay$ = this.filteredCustomers$.pipe(
      map((items) =>
        items.reduce((sum, i) => {
          if (this.filteredByDate) {
            return sum + Number(i.Transactions?.amountToPay ?? 0);
          }
          return sum
            + Number(i.Transactions?.monthlyCost    ?? 0)
            + Number(i.Transactions?.previousPending ?? 0);
        }, 0)
      )
    );
  
    this.totalBalance$ = this.filteredCustomers$.pipe(
      map((items) => {
        if (this.filteredByDate) {
          const customerMap = new Map<string, number>();
          for (const i of items) {
            const key     = i.id ?? i.vehicleNumber;
            const month   = i.displayMonth ?? '';
            const pending = Number(i.Transactions?.currentPending ?? 0);
  
            const trackedMonth = customerMap.get(key + '_month') as unknown as string;
            if (!trackedMonth || month > trackedMonth) {
              customerMap.set(key, pending);
              customerMap.set(key + '_month', month as any);
            }
          }
  
          return [...customerMap.entries()]
            .filter(([key]) => !key.endsWith('_month'))
            .reduce((sum, [, val]) => sum + val, 0);
        }
  
        // Default: last transaction's newPending per customer
        return items.reduce((sum, i) => {
          const history = i.FullTransactionHistory ?? [];
          const lastTx  = [...history]
            .sort((a, b) => (a.transactionDate ?? '').localeCompare(b.transactionDate ?? ''))
            .at(-1);
          return sum + Number(lastTx?.newPending ?? 0);
        }, 0);
      })
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

  getTotalAmount(transactions: any[], field: string): number {
    return transactions?.reduce((sum, t) => sum + (t[field] ?? 0), 0) ?? 0;
  }

  getUniqueMonthlyCostTotal(transactions: any[]): number {
    if (!transactions?.length) return 0;
  
    const seen = new Set<string>();
    return transactions.reduce((sum, t) => {
      const month = (t.transactionDate ?? '').substring(0, 7);
      if (seen.has(month)) return sum;
      seen.add(month);
      return sum + (t.monthlyCost ?? 0);
    }, 0);
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

  async downloadActiveCustomerPDF() {
  const doc = new jsPDF('l', 'mm', 'a4');

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── navbar ───────────────────────────────────────────────────────
  doc.setFillColor(63, 81, 181);
  doc.rect(0, 0, pageWidth, 18, 'F');

  // Logo text (replace with actual image if you have one)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PMCP', 14, 12);

  // Title centered in navbar
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Active Customer Sheet - ${this.currentMonth}`, pageWidth / 2, 12, { align: 'center' });

  // Date right-aligned in navbar
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.text(today, pageWidth - 14, 12, { align: 'right' });

  // Reset text color for body
  doc.setTextColor(0, 0, 0);
  // ─────────────────────────────────────────────────────────────────

  if (this.filteredCustomers$) {
    this.CustomersWithLedgerData = await firstValueFrom(this.filteredCustomers$);
  }

  const tableBody = this.CustomersWithLedgerData?.map((c: any) => [
    c.vehicleNumber,
    c.customerName,
    `${c.Transactions?.currentPending ?? 0}`,
    '',
    '',
    '',
    '',
    '',
  ]);

  const totalColumns  = 8;
  const columnWidth   = pageWidth / totalColumns - 4;

  autoTable(doc, {
    head: [['Vehicle', 'Name', 'Amount To Pay', 'Paid', 'Balance', 'Transaction Date', 'Payment Type', 'Note']],
    body: tableBody,
    startY: 22,  // push table below navbar
    styles: {
      lineWidth:   0.3,
      lineColor:   [0, 0, 0],
      fontSize:    9,
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

  const pageWidth = doc.internal.pageSize.getWidth();
  const now       = new Date();
const datePart  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const timePart  = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
const timestamp = `${datePart}${timePart}`;


  doc.setFillColor(217, 217 ,217);
  doc.rect(0, 0, pageWidth, 18, 'F');

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PMCP', 14, 12);

  let title = '';
  if (this.filterByPending) {
    title = `Customer Pending Details from ₹${this.minPending} to ₹${this.maxPending}`;
  } else if (this.filteredByDate && this.fromDate && this.toDate) {
    title = `Transactions from ${this.fromDate} to ${this.toDate}`;
  } else if (this.showActive$.value && this.showInactive$.value) {
    title = `Transaction Details`;
  } else if (this.showInactive$.value && !this.showActive$.value) {
    title = `Inactive Customers Transaction Details`;
  } else {
    title = `Active Customers Transaction Details`;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 12, { align: 'center' });

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.text(today, pageWidth - 14, 12, { align: 'right' });

  doc.setTextColor(0, 0, 0);

  if (this.filteredCustomers$) {
    this.CustomersWithLedgerData = await firstValueFrom(
      this.filteredCustomers$.pipe(take(1))
    );
  }

  const tableBody = this.CustomersWithLedgerData?.map((c: any) => [
    c.vehicleNumber,
    c.customerName,
    `${c.Transactions?.monthlyCost        ?? 0}`,
    `${c.Transactions?.transactionAmount  ?? 0}`,
    `${c.Transactions?.currentPending     ?? 0}`,
    `${c.Transactions?.lastTransactionDate ?? 'No Transactions'}`,
    `${c.Transactions?.paymentMethod      ?? 'Not Done'}`,
  ]);

  const totalAmount  = this.CustomersWithLedgerData?.reduce((sum: number, c: any) => sum + Number(c.Transactions?.monthlyCost      ?? 0), 0) ?? 0;
  const totalPaid    = this.CustomersWithLedgerData?.reduce((sum: number, c: any) => sum + Number(c.Transactions?.transactionAmount ?? 0), 0) ?? 0;
  const totalBalance = this.CustomersWithLedgerData?.reduce((sum: number, c: any) => sum + Number(c.Transactions?.currentPending    ?? 0), 0) ?? 0;

  autoTable(doc, {
    head: [['Vehicle', 'Name', 'Total Amount', 'Paid', 'Balance', 'Transaction Date', 'Payment Type']],
    body: tableBody,
    foot: [['Total', '', `${totalAmount}`, `${totalPaid}`, `${totalBalance}`, '', '']],
    startY: 22,
    styles: {
      lineWidth:   0.5,
      lineColor:   [0, 0, 0],
      fontSize:    10,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [217, 217, 217],
      textColor: 0,
    },
    footStyles: {
      fillColor: [217, 217, 217],
      textColor: 0,
      fontStyle: 'bold',
    },
    showFoot: 'lastPage',
    theme:    'grid',
  });

  let fileName = '';
  if (this.filterByPending) {
    fileName = `PendingCustomersFrom${this.minPending}-to-${this.maxPending} - ${this.currentMonth}.pdf`;
  } else if (this.filteredByDate && this.fromDate && this.toDate) {
    fileName = `TransactionsFrom-${this.fromDate}-to-${this.toDate} - ${this.currentMonth}.pdf`;
  } else if (this.showActive$.value && this.showInactive$.value) {
    fileName = `Transaction Details - ${timestamp}.pdf`;
  } else if (this.showInactive$.value && !this.showActive$.value) {
    fileName = `Inactive Customers Transaction Details - ${timestamp}.pdf`;
  } else {
    fileName = `Active Customers Transaction Details - ${timestamp}.pdf`;
  }

  doc.save(fileName);
};

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
