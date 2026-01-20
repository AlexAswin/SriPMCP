import { Component, OnInit } from '@angular/core';
import { MatCard, MatCardTitle } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule} from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { Observable } from 'rxjs';
import { TransactionService } from '../transaction.service';

@Component({
  selector: 'app-monthly-income',
  standalone: true,
  imports: [MatCard, MatCardTitle, MatTableModule, MatChipsModule, CommonModule],
  templateUrl: './monthly-income.component.html',
  styleUrl: './monthly-income.component.scss'
})
export class MonthlyIncomeComponent implements OnInit{

  activeCustomersWithLedger$!: Observable<any[]>;
  currentMonth: string = '';

  displayedColumns = [
    'vehicle',
    'name',
    'Advance',
    'monthlyCost',
    'paid',
    'balance',
    'date',
    'payMethod',
  ];

  constructor (private transactionService: TransactionService) {

  }

  ngOnInit() {
    this.getActiveMonthlyUsers();
  }

  getActiveMonthlyUsers = () => {
    this.currentMonth = new Date().toLocaleString('default', { month: 'long' });
    this.activeCustomersWithLedger$ = this.transactionService.getActiveCustomersWithCurrentMonthLedger();
  }

  createLedgerForNewMonth() {
    this.transactionService.createNewMonthLedgerForActiveCustomers('2026-02-01')
      .then(() => console.log('New month ledger created'))
      .catch(err => console.error(err));
  }
}
