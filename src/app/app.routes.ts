import { Routes } from '@angular/router';
import { LogInComponent } from './log-in/log-in.component';
import { DashBoardComponent } from './dash-board/dash-board.component';
import { MonthlyCustomerDetailsComponent } from './monthly-customer-details/monthly-customer-details.component';
import { DailyCustomerDetailsComponent } from './daily-customer-details/daily-customer-details.component';
import { AdminEntryComponent } from './admin-entry/admin-entry.component';
import { MonthlyIncomeComponent } from './monthly-income/monthly-income.component';
import { MonthlyPaymentsComponent } from './monthly-payments/monthly-payments.component';
import { ExpenseDetailsComponent } from './expense-details/expense-details.component';
import { DailyIncomeComponent } from './daily-income/daily-income.component';

export const routes: Routes = [
  { path: '', component: LogInComponent },
  { path: 'dashBoard', component: DashBoardComponent },
  { path: 'monthlyCustomer', component: MonthlyCustomerDetailsComponent },
  { path: 'dailyCustomer', component: DailyCustomerDetailsComponent },
  { path: 'adminEntry', component: AdminEntryComponent },
  { path: 'monthlyPayments', component: MonthlyPaymentsComponent },
  { path: 'reports/monthlyIncome', component: MonthlyIncomeComponent },
  { path: 'reports/expense', component: ExpenseDetailsComponent },
  { path: 'reports/dailyIncome', component: DailyIncomeComponent },

];
