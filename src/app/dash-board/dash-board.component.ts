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

@Component({
  selector: 'app-dash-board',
  standalone: true,
  imports: [NavBarComponent, MatSidenavModule, MatButtonModule, MatIconModule, MatListModule, MatToolbarModule, EntryFormComponent,
    MonthlyCustomerDetailsComponent, CommonModule, MatGridListModule],
  templateUrl: './dash-board.component.html',
  styleUrl: './dash-board.component.scss'
})
export class DashBoardComponent {
  showFiller = false;

  monthlyCustomerForm: boolean = false;

  openMonthlyCustomerForm() {
    this.monthlyCustomerForm = true;
  }

  openDailyCustomerForm() {
    
  }

}
