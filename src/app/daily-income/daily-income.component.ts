import { Component } from '@angular/core';
import { MatSidenavContainer, MatSidenavContent, MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { RouterModule } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { TransactionService } from '../transaction.service';

@Component({
  selector: 'app-daily-income',
  standalone: true,
  imports: [MatSidenavContainer, MatSidenavContent, MatToolbarModule, MatIconModule, MatCardModule, MatSidenavModule, RouterModule, CommonModule,
            MatTableModule],
  templateUrl: './daily-income.component.html',
  styleUrl: './daily-income.component.scss'
})
export class DailyIncomeComponent {

  opened = false;
  currentMonth: string = '';
  
  allCustomersWithLedgers$!: Observable<any[]>;
  unPaidCustomersWithLedger$!: Observable<any[]>;
  inactiveCustomersWithLedger$!: Observable<any[]>;



  activeCustomersAndBalanceColumns = [
    'vehicle',
    'name',
    'BillNumber',
    'Amount',
    'FromDate',
    'ToDate',
    'TotalBalance'
  ];


  toggleSidenav() {
    this.opened = !this.opened;
  }

  ngOnInit() {
    this.currentMonth = new Date().toLocaleString('default', { month: 'long' });
    this.getDailyCustomers();
  }

  constructor ( private transactionService: TransactionService ) {

  }

  getDailyCustomers = () => {
    this.allCustomersWithLedgers$ = this.transactionService.getDailyCustomersTransactions().pipe(take(1)),
    this.unPaidCustomersWithLedger$ = this.allCustomersWithLedgers$.pipe((take(1)),
      map(customers => customers.filter(c => c.dailyStatus === 'Unpaid'))
      );

    this.inactiveCustomersWithLedger$ = this.allCustomersWithLedgers$.pipe((take(1)),
      map(customers => customers.filter(c => (c.dailyStatus === 'paid') && c.Transactions) )
    );
  }




}
