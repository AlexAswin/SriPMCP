import { Component, OnInit } from '@angular/core';
import { MatCard, MatCardTitle } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule} from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-monthly-income',
  standalone: true,
  imports: [MatCard, MatCardTitle, MatTableModule, MatChipsModule, CommonModule],
  templateUrl: './monthly-income.component.html',
  styleUrl: './monthly-income.component.scss'
})
export class MonthlyIncomeComponent implements OnInit{

  activeCustomers$!: Observable<any[]>;

  displayedColumns = [
    'vehicle',
    'name',
    'monthly',
    'balance',
    'status',
    'action'
  ];

  
  customers = [
    {
      id: 'TN01AB1234',
      vehicleNumber: 'TN01AB1234',
      customerName: 'Ravi',
      monthlyAmount: 1000,
      balance: 0,
      lastPaidMonth: '2026-01'
    },
    {
      id: 'TN02CD5678',
      vehicleNumber: 'TN02CD5678',
      customerName: 'Kumar',
      monthlyAmount: 1500,
      balance: 3000,
      lastPaidMonth: '2025-12'
    },
    {
      id: 'TN03EF9012',
      vehicleNumber: 'TN03EF9012',
      customerName: 'Anita',
      monthlyAmount: 800,
      balance: 800,
      lastPaidMonth: '2026-01'
    },
    {
      id: 'TN04GH3456',
      vehicleNumber: 'TN04GH3456',
      customerName: 'Suresh',
      monthlyAmount: 1200,
      balance: 2400,
      lastPaidMonth: '2025-11'
    }
  ];
  constructor (private newCustomerEntryService: NewCustomerEntryService) {

  }

  ngOnInit() {
    this.getActiveMonthlyUsers();
  }

  getActiveMonthlyUsers = () => {
    this.activeCustomers$ = this.newCustomerEntryService.getActiveMonthlyCustomers()
  }


  viewLedger(customer: any) {
    console.log('View ledger for:', customer.vehicleNumber);
  }
  
  openPayment(customer: any) {
    alert(`Payment clicked for ${customer.vehicleNumber}
  Balance: ₹${customer.balance}`);
  }
  

}
