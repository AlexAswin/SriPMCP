import { Component, Input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../Common/button/button.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-entry-form',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ButtonComponent, CommonModule],
  templateUrl: './entry-form.component.html',
  styleUrl: './entry-form.component.scss'
})
export class EntryFormComponent {
  @Input() type = 'success';
  existingCustomer: boolean = false;
  @Input() message: string = 'New Customer... Get Customer Details';

  show = true;

  close() {
    this.show = false;
  }

  checkExistingUser() {
    this.existingCustomer = !this.existingCustomer;
    this.message = this.existingCustomer? 'Existing Customer... Check the details': 'New Customer... Get Customer Details';
  }
  
}
