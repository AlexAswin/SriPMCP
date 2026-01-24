import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatCard, MatCardTitle } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule} from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { Observable, Subject, firstValueFrom, forkJoin, map, take, takeUntil } from 'rxjs';
import { TransactionService } from '../transaction.service';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule} from '@angular/material/sidenav';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ButtonComponent } from '../Common/button/button.component';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-monthly-income',
  standalone: true,
  imports: [MatCard, MatCardTitle, MatTableModule, MatChipsModule, CommonModule, MatIconModule, MatSidenavModule, FormsModule,
    MatToolbarModule, ButtonComponent, MatNativeDateModule,  MatDatepickerModule, MatInputModule, ReactiveFormsModule, RouterModule],
    providers: [],
  templateUrl: './monthly-income.component.html',
  styleUrl: './monthly-income.component.scss'
})
export class MonthlyIncomeComponent implements OnInit, OnDestroy {
  allCustomersWithLedgers$!: Observable<any[]>;
  activeCustomersWithLedger$!: Observable<any[]>;
  inactiveCustomersWithLedger$!: Observable<any[]>;

  currentMonth: string = '';

  events: string[] = [];
  opened = false;
  activeCustomersWithLedgerData: any[] = [];
  private destroy$ = new Subject<void>();

  expectedMonthlyIncome$!: Observable<any[]>;
  totalMonthlyTransaction$!: Observable<any[]>;
  totalPending$!: Observable<any[]>;


  activeCustomersAndBalanceColumns = [
    'vehicle',
    'name',
    'Advance',
    'monthlyCost',
    'paid',
    'balance',
    'date',
    'payMethod',
  ];

  constructor ( private transactionService: TransactionService ) {

  }

  ngOnInit() {
    this.getActiveMonthlyUsers();
  }

  getActiveMonthlyUsers = () => {
    this.currentMonth = new Date().toLocaleString('default', { month: 'long' });
    this.allCustomersWithLedgers$ = this.transactionService.getMonthlyCustomersTransactions().pipe(take(1)),
    this.activeCustomersWithLedger$ = this.allCustomersWithLedgers$.pipe((take(1)),
      map(customers => customers.filter(c => c.monthlyStatus === 'Active'))
      );

    this.inactiveCustomersWithLedger$ = this.allCustomersWithLedgers$.pipe((take(1)),
      map(customers => customers.filter(c => (c.monthlyStatus === 'InActive') && c.Transactions) )
    ); 
    this.calculateExpectedMonthlyIncome();
    this.calculateMonthlyTransactionsAmount();
    this.calculateTotalPending();
    }

  toggleSidenav() {
    this.opened = !this.opened;
  }

  calculateExpectedMonthlyIncome = (): Observable<number> =>{
    return this.expectedMonthlyIncome$ = this.allCustomersWithLedgers$.pipe((take(1)),
      map(customers =>
        customers.reduce(
          (sum, customer) =>
            sum + Number(customer.Transactions?.monthlyCost ?? 0),
          0
        )
      )
    );
  }

  calculateMonthlyTransactionsAmount = () => {
    this.totalMonthlyTransaction$ = this.allCustomersWithLedgers$.pipe((take(1)),
      map(customers =>
        customers.reduce(
          (sum, customer) =>
            sum + Number(customer.Transactions?.transactionAmount ?? 0),
          0
        )
      )
    );
  }

  calculateTotalPending = () => {
    this.totalPending$ = this.allCustomersWithLedgers$.pipe((take(1)),
      map(customers =>
        customers.reduce(
          (sum, customer) =>
            sum + Number(customer.Transactions?.currentPending ?? 0),
          0
        )
      )
    );
  }

  async downloadActiveCustomerPDF() {
    const doc = new jsPDF('l', 'mm', 'a4');
  
    doc.setFontSize(14);
    doc.text(`Monthly Balance Details - ${this.currentMonth}`, 14, 15);
  
    this.activeCustomersWithLedgerData = await firstValueFrom(
      this.activeCustomersWithLedger$
    );
  
    const tableBody = this.activeCustomersWithLedgerData.map((c: any) => [
      c.vehicleNumber,
      c.customerName,
      `Rs ${c.Transactions?.currentPending ?? 0}`,
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

  downloadMonthlyReportPDF = async () => {

    forkJoin({
      active: this.activeCustomersWithLedger$.pipe(take(1)),
      inactive: this.inactiveCustomersWithLedger$.pipe(take(1), takeUntil(this.destroy$))
    }).subscribe(({ active, inactive }) => {
  
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentMonth = this.currentMonth;
  
      // 🔹 Totals
      const totalExpectedIncome =
        [...active, ...inactive].reduce(
          (sum, c) => sum + Number(c.Transactions?.monthlyCost ?? 0),
          0
        );

        const totalTransactionIncome =
        [...active, ...inactive].reduce(
          (sum, c) => sum + Number(c.Transactions?.transactionAmount ?? 0),
          0
        );
  
      const totalPending =
        [...active, ...inactive].reduce(
          (sum, c) => sum + Number(c.Transactions?.currentPending ?? 0),
          0
        );
  
      // 🔹 Title
      doc.setFontSize(14);
      doc.text(`Monthly Report - ${currentMonth}`, 14, 15);
  
      // ================= ACTIVE =================
      doc.setFontSize(12);
      doc.text('Active Customers', 14, 25);
  
      autoTable(doc, {
        startY: 30,
        head: [[
          'Vehicle No',
          'Customer Name',
          'Monthly Cost',
          'Paid',
          'Pending',
          'Payment Method',
          'Transaction Date'
        ]],
        body: active.map(c => [
          c.vehicleNumber,
          c.customerName,
          c.Transactions?.monthlyCost ?? 0,
          c.Transactions?.transactionAmount ?? 0,
          c.Transactions?.currentPending ?? 0,
          c.Transactions?.paymentMethod ?? '-',
          c.Transactions?.transactionDate ?? 'NO TRANSACTION'
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [40, 167, 69] }
      });
  
      // ================= INACTIVE =================
      const inactiveStartY = (doc as any).lastAutoTable.finalY + 10;
  
      doc.setFontSize(12);
      doc.text('Inactive Customers', 14, inactiveStartY);
  
      autoTable(doc, {
        startY: inactiveStartY + 5,
        head: [[
          'Vehicle No',
          'Customer Name',
          'Monthly Cost',
          'Paid',
          'Pending',
          'Transaction Date'
        ]],
        body: inactive.map(c => [
          c.vehicleNumber,
          c.customerName,
          c.Transactions?.monthlyCost ?? 0,
          c.Transactions?.transactionAmount ?? 0,
          c.Transactions?.currentPending ?? 0,
          c.Transactions?.transactionDate ?? 'NO TRANSACTION'
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [220, 53, 69] }
      });
  
      // ================= SUMMARY =================
      const summaryY = (doc as any).lastAutoTable.finalY + 15;
  
      doc.setFontSize(12);
      doc.text(
        `Total Expected Income : ₹ ${totalExpectedIncome.toLocaleString('en-IN')}`,
        14,
        summaryY
      );

      doc.text(
        `Total Transaction Amount : ₹ ${totalTransactionIncome.toLocaleString('en-IN')}`,
        14,
        summaryY + 8
      );
  
      doc.text(
        `Total Pending Amount : ₹ ${totalPending.toLocaleString('en-IN')}`,
        14,
        summaryY + 16
      );
  
      doc.save(`Monthly_Report_${currentMonth}.pdf`);
    });

  }
  

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
