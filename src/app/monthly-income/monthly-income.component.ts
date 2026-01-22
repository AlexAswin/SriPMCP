import { Component, OnInit } from '@angular/core';
import { MatCard, MatCardTitle } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule} from '@angular/material/chips';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable, Subject, firstValueFrom } from 'rxjs';
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

@Component({
  selector: 'app-monthly-income',
  standalone: true,
  imports: [MatCard, MatCardTitle, MatTableModule, MatChipsModule, CommonModule, MatIconModule, MatSidenavModule, FormsModule,
    MatToolbarModule, ButtonComponent, MatNativeDateModule,  MatDatepickerModule, MatInputModule, ReactiveFormsModule],
    providers: [DatePipe],
  templateUrl: './monthly-income.component.html',
  styleUrl: './monthly-income.component.scss'
})
export class MonthlyIncomeComponent implements OnInit{

  activeCustomersWithLedger$!: Observable<any[]>;
  currentMonth: string = '';

  events: string[] = [];
  opened = false;
  activeCustomersWithLedgerData: any[] = [];
  private destroy$ = new Subject<void>();

  selectedMonthYear = '';


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

  activeCustomerColumn = [
    'vehicle',
    'name',
    'total-amount',
    'paid',
    'balance',
    'date',
    'payMethod',
    'note'
  ];

  constructor ( private transactionService: TransactionService ) {

  }

  ngOnInit() {
    this.getActiveMonthlyUsers();
  }

  getActiveMonthlyUsers = () => {
    this.currentMonth = new Date().toLocaleString('default', { month: 'long' });
    this.activeCustomersWithLedger$ = this.transactionService.getActiveCustomersWithCurrentMonthLedger();
  }

  toggleSidenav() {
    this.opened = !this.opened;
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
  

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
