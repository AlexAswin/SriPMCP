import { Component, Input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../Common/button/button.component';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
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
  searchWithBillingNbr = new FormControl<string | null>('');
  
  newCustomer: boolean = false;
  existingCustomer: boolean = false;
  show = false;

  constructor (private  newCustomerEntryService :  NewCustomerEntryService,
               private router: Router) {

  }

  close() {
    this.show = false;
  }

  async checkExistingUser(identifier: 'vehicleNbr' | 'billingNbr') {
    let inputValue: string | undefined;
  if (identifier === 'vehicleNbr') {
    inputValue = this.searchWithVehicleNbr.value?.trim();
  } else if (identifier === 'billingNbr') {
    inputValue = this.searchWithBillingNbr.value?.trim();
  }

  if (!inputValue) {
    return;
  }
    const formatedVehicleNbr = this.formateVehicleNumber(inputValue);

    const exists = await this.newCustomerEntryService.getVehicleByNumber( formatedVehicleNbr, identifier );

    if ( exists && exists.customerType === 'Daily' ) {
      this.router.navigate(['/dailyCustomer'], {
        queryParams: {
          vehicleNbr: exists.vehicleNumber,
        },
      });
    
    } else if ( exists && exists.customerType === 'Monthly') {
      this.router.navigate(['/monthlyCustomer'], {
        queryParams: {
          vehicleNbr: this.searchWithVehicleNbr.value,
        },
      });
    
    } else {
      this.show = true;
      this.message = 'Customer not exists....';
    }
  }

  private formateVehicleNumber(value: string): string {
    return (
      this.reformatVehicleNumber(value).toUpperCase().trim()
    );
  }

  reformatVehicleNumber(value: any): string {
    if (typeof value !== 'string') return '';
    return value.toUpperCase().replace(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/, '$1 $2 $3 $4');
  }

  onVehicleNumberInput(event: Event) {
    const input     = event.target as HTMLInputElement;
    const oldCursor = input.selectionStart ?? 0;
    const oldVal    = input.value;
  
    const raw    = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const state  = raw.substring(0, 2);
    const dist   = raw.substring(2, 4);
    const rest   = raw.substring(4);
    const series = (rest.match(/^[A-Z]{1,2}/) ?? [''])[0];
    const digits = (rest.replace(/^[A-Z]+/, '').match(/^\d{1,4}/) ?? [''])[0];
  
    const parts     = [state, dist, series, digits].filter(Boolean);
    const formatted = parts.join(' ');
  
    // ── Find cursor in raw space ───────────────────────────
    const rawCursorPos = this.getRawIndex(oldVal, oldCursor);
    const newCursor    = this.getFormattedIndex(formatted, rawCursorPos);
  
    input.value = formatted;
  
    // this.vehicleDetailsForm
    //   .get('vehicleNumber')
    //   ?.setValue(formatted, { emitEvent: false });
  
    // Set synchronously AND in setTimeout as fallback
    input.setSelectionRange(newCursor, newCursor);
    setTimeout(() => input.setSelectionRange(newCursor, newCursor), 0);
  }

  private getRawIndex(value: string, cursorPos: number): number {
    return value.substring(0, cursorPos).replace(/\s/g, '').length;
  }
  
  // Convert raw index → cursor position in formatted string
  private getFormattedIndex(formatted: string, rawIndex: number): number {
    let rawCount = 0;
  
    for (let i = 0; i < formatted.length; i++) {
      if (rawCount === rawIndex) return i;
      if (formatted[i] !== ' ') rawCount++;
    }
  
    return formatted.length;
  }

  restrictVehicleInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key   = event.key;
  
    if (['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;
  
    const isDigit  = /^[0-9]$/.test(key);
    const isLetter = /^[a-zA-Z]$/.test(key);
  
    if (!isDigit && !isLetter) return event.preventDefault();
  
    const control  = this.searchWithVehicleNbr;
    const cursor   = input.selectionStart ?? 0;
  
    // Strip spaces only up to cursor to get accurate raw position
    const rawIndex = input.value.substring(0, cursor).replace(/\s/g, '').length;
    const rawTotal = input.value.replace(/\s/g, '');
  
    // Clear inline errors before re-validating
    this.clearInlineErrors(control, ['letterExpected', 'digitExpected']);
  
    // Position 0–1: must be letters (state code)
    if (rawIndex < 2 && !isLetter) {
      control?.setErrors({ ...control.errors, letterExpected: true });
      return event.preventDefault();
    }
  
    // Position 2–3: must be digits (district code)
    if (rawIndex >= 2 && rawIndex < 4 && !isDigit) {
      control?.setErrors({ ...control.errors, digitExpected: true });
      return event.preventDefault();
    }
  
    // Position 4–5: must be letters (series)
    if (rawIndex >= 4 && rawIndex < 6 && !isLetter) {
      control?.setErrors({ ...control.errors, letterExpected: true });
      return event.preventDefault();
    }
  
    // Position 6–9: must be digits (number plate digits, max 4)
    if (rawIndex >= 6 && rawIndex < 10 && !isDigit) {
      control?.setErrors({ ...control.errors, digitExpected: true });
      return event.preventDefault();
    }
  
    // Hard cap at 10 raw characters
    if (rawTotal.length >= 10) {
      return event.preventDefault();
    }
  }
  
  private clearInlineErrors(control: AbstractControl | null, keys: string[]): void {
    if (!control?.errors) return;
    const updated = { ...control.errors };
    keys.forEach(k => delete updated[k]);
    control.setErrors(Object.keys(updated).length ? updated : null);
  }

  

  handleFormClose(data: any) {
    this.newCustomer = false;
    this.show =false;
    this.searchWithVehicleNbr.reset();
  }
  
}
