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
    this.activeCustomersWithLedger$ = this.transactionService.getActiveCustomersWithCurrentMonthLedger();
    console.log(this.activeCustomersWithLedger$);
  }

}
