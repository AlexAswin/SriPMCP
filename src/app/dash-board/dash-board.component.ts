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

  isAdmin: boolean = false
  isMobileMenuOpen = false;

  constructor (private router: Router) {

  }

  ngOnInit(): void {
    const userType = localStorage.getItem('UserType');
    if(userType === 'admin') {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
    }
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

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  LogOut() {
    localStorage.removeItem('UserType');
    localStorage.removeItem('User')
  }

}
