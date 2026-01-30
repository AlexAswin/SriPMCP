import { Component } from '@angular/core';
import { NavBarComponent } from '../Common/nav-bar/nav-bar.component';
import {MatButtonModule} from '@angular/material/button';
import {MatSidenavModule} from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { EntryFormComponent } from '../entry-form/entry-form.component';
import { MonthlyCustomerDetailsComponent } from '../monthly-customer-details/monthly-customer-details.component';
import { CommonModule } from '@angular/common';
import { MatGridListModule } from '@angular/material/grid-list';
import { DailyCustomerDetailsComponent } from '../daily-customer-details/daily-customer-details.component';
import { Route, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-dash-board',
  standalone: true,
  imports: [MatSidenavModule, MatButtonModule, MatIconModule, MatListModule, MatToolbarModule, EntryFormComponent,
    CommonModule, MatGridListModule, RouterModule, NavBarComponent],
  templateUrl: './dash-board.component.html',
  styleUrl: './dash-board.component.scss'
})
export class DashBoardComponent {
  showFiller = false;
  showReports = false;

  monthlyCustomerForm: boolean = false;
  dailyCustomerForm: boolean = false;

  constructor (private router: Router) {

  }


  openMonthlyCustomerForm() {
      this.router.navigate(['/monthlyCustomer']);
  }

  openDailyCustomerForm() {
    this.router.navigate(['/dailyCustomer']);    
  }

  toggleReports() {
    this.showReports = !this.showReports;
  }

}
