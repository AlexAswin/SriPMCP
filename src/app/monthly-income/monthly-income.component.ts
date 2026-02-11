import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { MatCard, MatCardTitle, MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule} from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Observable, Subject, combineLatest, firstValueFrom, forkJoin, map, of, shareReplay, take, takeUntil } from 'rxjs';
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
  allCustomers$!: Observable<any[]>;
  filteredCustomers$!: Observable<any[]>;

  showActive = true;
  showInactive = false;

  maxPending: number = null || 3000000;
  minPending = 0;

  filteredByDate = false;


  // allCustomersWithLedgers$!: Observable<any[]>;
  // activeCustomersWithLedger$!: Observable<any[]>;
  // inactiveCustomersWithLedger$!: Observable<any[]>;
  // displayedCustomers$: Observable<any[]> | null = null;
  // filteredActiveCustomersWithLedger$!: Observable<any[]>;

  // inactiveCustomers: boolean = false;
  // activeCustomers: boolean = false

  currentMonth: string = '';

  events: string[] = [];
  opened = false;
  activeCustomersWithLedgerData: any[] = [];


  sortKey: SortKey | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  sort$ = new BehaviorSubject<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  showExpandColumn = false;
  // activeCustomersAndBalanceColumns = [ 'vehicle', 'name', 'Advance', 'monthlyCost', 'paid', 'balance', 'date', 'payMethod' ];

  CustomersAndBalanceColumns = [
    'vehicle',
    'name',
    'Advance',
    'monthlyCost',
    'paid',
    'balance',
    'date',
    'payMethod',
    // ...(this.showExpandColumn ? ['expand'] : []),
  ];
  
  

  customerType = 'Active';
  customerTypes: string[] = ['Active', 'InActive'];

  
  value = 0;
  private filterCriteria$ = new BehaviorSubject<{min: number, max: number} | null>(null);

  fromDate: Date | null = null;
  toDate: Date | null = null;
  dateFilter$ = new BehaviorSubject<{ from: Date | null; to: Date | null } | null>(null);

  expandedElement: any | null = null;
  
  filteredRows: any[] = [];

  totals = {
    totalAmount: 0,
    totalPaid: 0,
    totalBalance: 0
  };

  private destroy$ = new Subject<void>();

  constructor ( private transactionService: TransactionService ) {

  }

  ngOnInit() {
    this.allCustomers$ = this.transactionService.getAllCustomersWithTransactions().pipe(
      shareReplay(1)
    );
    this.applyFilter();

  }

  applyFilter() {
    this.filteredCustomers$ = this.allCustomers$.pipe(
      map(customers => {
        if (this.showActive && this.showInactive) {
          return customers;
        } else if (this.showActive) {
          return customers.filter(c => c.monthlyStatus === 'Active');
        } else if (this.showInactive) {
          return customers.filter(c => c.monthlyStatus === 'InActive');
        } else {
          return [];
        }
      })
    );
  }

  toggleAll(checked: boolean) {
    this.showActive = checked;
    this.showInactive = checked;
    this.applyFilter();
  }
  
  toggleActive(checked: boolean) {
    this.showActive = checked;
    this.applyFilter();
  }
  
  toggleInactive(checked: boolean) {
    this.showInactive = checked;
    this.applyFilter();
  }

  calculateTotals(customers: any[]) {
    this.totals.totalAmount = customers.reduce(
      (sum, c) => sum + Number(c.Transactions?.monthlyCost ?? 0),
      0
    );
    // this.totals.totalPaid = customers.reduce(
    //   (sum, c) => sum + Number(c.Transactions?.transactionAmount ?? 0),
    //   0
    // );
    // this.totals.totalBalance = customers.reduce(
    //   (sum, c) => sum + Number(c.Transactions?.currentPending ?? 0),
    //   0
    // );
  }

  showFilteredPending() {
    this.filteredCustomers$ = this.allCustomers$.pipe(
      map(customers => {
        let filtered = customers;
  
        if (this.showActive && !this.showInactive) {
          filtered = filtered.filter(c => c.monthlyStatus === 'Active');
        } else if (!this.showActive && this.showInactive) {
          filtered = filtered.filter(c => c.monthlyStatus === 'InActive');
        } else if (this.showActive && this.showInactive) {
          filtered = filtered;
        } else {
          filtered = [];
        }
  
        filtered = filtered.filter(c => {
          const amount = c.Transactions.currentPending;
          return amount >= this.minPending && amount <= this.maxPending;
        });
  
        return filtered;
      })
    );
  }
  
  onFromDateChange(event: any) {
    this.fromDate = event.target.value;
    this.showFilteredTransactions();
  }

  onToDateChange(event: any) {
    this.toDate = event.target.value;
    this.showFilteredTransactions();
  }

  showFilteredTransactions() {
    const from = this.fromDate;
    const to = this.toDate;
  
    if (!from || !to) return;
    this.filteredByDate = true;
    this.filteredCustomers$ = this.allCustomers$!.pipe(
      map(customers => {
  
        const filteredTx = customers.flatMap(customer =>
          (customer.Transactions?.transactionHistory || [])
            .filter((tx: any) => tx.transactionDate >= from && tx.transactionDate <= to)
            .map((tx: any) => ({
              ...tx,
              customerId: customer.id,
              customerName: customer.customerName,
              monthlyStatus: customer.monthlyStatus
            }))
        );
  
        const grouped: any = {};
  
        filteredTx.forEach(tx => {
          if (!grouped[tx.transactionDate]) {
            grouped[tx.transactionDate] = [];
          }
          grouped[tx.transactionDate].push(tx);
        });
  
        return Object.keys(grouped)
        .sort((a, b) => a.localeCompare(b))
        .map(date => ({
          date,
          transactions: grouped[date]
        }));
      })
    );
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
  

  filterVehicle = (event: Event) => {
    const vehicleNumber = (event.target as HTMLInputElement).value.trim().toUpperCase();
  
    this.filteredCustomers$ = this.allCustomers$.pipe(
      map(customers => {
        const filtered = customers.filter(c =>
          c.vehicleNumber.includes(vehicleNumber)
        );
  
        this.filteredRows = filtered;
        return filtered;
      })
    );
  };

  expandRow(row: any) {
    this.expandedElement = this.isExpanded(row) ? null : row;
  }
  
  isExpanded(row: any) {
    return this.expandedElement === row;
  }

  resetFilters() {
    this.minPending = 0;
    this.maxPending = 1000000;

    this.filteredByDate = false
    this.fromDate = null;
    this.toDate = null;

    this.showActive = true;
    this.showInactive = false
    this.applyFilter();
  }

  async downloadActiveCustomerPDF() {
    const doc = new jsPDF('l', 'mm', 'a4');
  
    doc.setFontSize(14);
    doc.text(`Monthly Balance Details - ${this.currentMonth}`, 14, 15);
  
    if (this.filteredCustomers$) {
      this.activeCustomersWithLedgerData = await firstValueFrom(this.filteredCustomers$);
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
    doc.text(`${this.customerType} - Customer Details`, 14, 15);
  
    if (this.filteredCustomers$) {
      this.activeCustomersWithLedgerData = await firstValueFrom(
        this.filteredCustomers$.pipe(take(1))
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
  
    doc.setFontSize(11);  
    doc.save(`Monthly-Customer-Details-${this.currentMonth}.pdf`);
  };
  

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
