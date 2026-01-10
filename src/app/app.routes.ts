import { Routes } from '@angular/router';
import { LogInComponent } from './log-in/log-in.component';
import { DashBoardComponent } from './dash-board/dash-board.component';
import { ExistingCustomerDetailsComponent } from './existing-customer-details/existing-customer-details.component';
import { MonthlyCustomerDetailsComponent } from './monthly-customer-details/monthly-customer-details.component';
import { DailyCustomerDetailsComponent } from './daily-customer-details/daily-customer-details.component';

export const routes: Routes = [
    { path: '', component: LogInComponent }, 
    { path: 'dashBoard', component: DashBoardComponent },
    { path: 'customerDetails', component: ExistingCustomerDetailsComponent },
    { path: 'monthlyCustomer', component: MonthlyCustomerDetailsComponent },
    { path: 'dailyCustomer', component: DailyCustomerDetailsComponent },
];
