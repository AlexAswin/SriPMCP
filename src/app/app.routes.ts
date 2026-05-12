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
import { authGuard } from './auth.guard';
import { GeneralReportsComponent } from './general-reports/general-reports.component';

export const routes: Routes = [
  { path: '', component: LogInComponent },

  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'dashBoard',        component: DashBoardComponent },
      { path: 'monthlyCustomer',  component: MonthlyCustomerDetailsComponent },
      { path: 'dailyCustomer',    component: DailyCustomerDetailsComponent },
      { path: 'adminEntry',       component: AdminEntryComponent },
      { path: 'monthlyPayments',  component: MonthlyPaymentsComponent },
      {
        path: 'reports',
        children: [
          { path: 'monthlyIncome', component: MonthlyIncomeComponent },
          { path: 'dailyIncome',   component: DailyIncomeComponent },
          { path: 'expense',       component: ExpenseDetailsComponent },
          { path: 'generalReports',  component: GeneralReportsComponent },
        ]
      }
    ]
  },

  { path: '**', redirectTo: '' }
];
