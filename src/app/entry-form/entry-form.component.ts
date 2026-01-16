import { Component, Input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../Common/button/button.component';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NewCustomerEntryService } from '../new-customer-entry.service';
import { MatCard } from '@angular/material/card';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-entry-form',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ButtonComponent, CommonModule, ReactiveFormsModule,
            MatCard, RouterModule],
  templateUrl: './entry-form.component.html',
  styleUrl: './entry-form.component.scss'
})
export class EntryFormComponent {
  @Input() type = 'success';

  message: string = '';

  searchWithVehicleNbr = new FormControl<string | null>('');
  searchWithBillNbr = new FormControl<string | null>('');
  
  newCustomer: boolean = false;
  existingCustomer: boolean = false;
  show = false;

  constructor (private  newCustomerEntryService :  NewCustomerEntryService,
               private router: Router) {

  }

  close() {
    this.show = false;
  }

  async checkExistingUser() {
    const vehicleNumber = this.searchWithVehicleNbr.value?.trim();

    if (!vehicleNumber) {
      console.log('No vehicle number entered');
      return;
    }
    const formatedVehicleNbr = this.formateVehicleNumber(vehicleNumber);

    const exists = await this.newCustomerEntryService.getVehicleByNumber(
      formatedVehicleNbr
    );

    if (
      exists &&
      (
        exists.customerType.value === 'Daily' ||
        exists.customerType.value === 'daily'
      )
    ) {
      this.router.navigate(['/dailyCustomer'], {
        queryParams: {
          vehicleNbr: this.searchWithVehicleNbr.value,
        },
      });
      console.log('Vehicle already exists :', exists);
    
    } else if (
      exists &&
      (
        exists.customerType.value === 'Monthly' ||
        exists.customerType.value === 'monthly'
      )
    ) {
      this.router.navigate(['/monthlyCustomer'], {
        queryParams: {
          vehicleNbr: this.searchWithVehicleNbr.value,
        },
      });
    
    } else {
      this.show = true;
      this.message = 'New Customer... Please Add Customer Details';
      console.log('New vehicle');
    }
  }    

  private formateVehicleNumber(value: string): string {
    return value
      .toUpperCase()
      .replace(/\s+/g, '')
      .trim();
  }

  handleFormClose(data: any) {
    this.newCustomer = false;
    this.show =false;
    this.searchWithVehicleNbr.reset();
  }
  
}
