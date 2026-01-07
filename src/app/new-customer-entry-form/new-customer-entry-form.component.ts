import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule} from '@angular/forms';
import { MatRadioModule} from '@angular/material/radio';
import { ButtonComponent } from '../Common/button/button.component';
import { NewCustomerEntryService } from '../new-customer-entry.service';

@Component({
  selector: 'app-new-customer-entry-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    CommonModule,
    MatSelectModule,
    MatGridListModule,
    MatDatepickerModule,
    MatIconModule,
    FormsModule,
    MatRadioModule,
    ButtonComponent,
  ],
  templateUrl: './new-customer-entry-form.component.html',
  styleUrl: './new-customer-entry-form.component.scss',
})
export class NewCustomerEntryFormComponent {
  vehicleForm: FormGroup;
  vehicleTypes = ['Car', '2-Wheeler', '4-Wheeler', 'Lorry'];
  customerTypes = ['Daily', 'Monthly'];
  status = ['Paid', 'Unpaid'];
  advanceStatus = ['Yes', 'No'];

  monthlyStatus = ['Active', 'InActive'];
  pricing: any = {
    Daily: {
      Car: 1000,
      '2-Wheeler': 2000,
      '4-Wheeler': 3000,
      Lorry: 4000,
    },
    Monthly: {
      Car: 5000,
      '2-Wheeler': 7000,
      '4-Wheeler': 9000,
      Lorry: 10000,
    },
  };

  isDailyCustomer: boolean = false;
  isMonthlyCustomer: boolean = false;
  selectedVehicleType: string = '';
  selectedTime: string = '';

  @Output() formClosed = new EventEmitter<void>();

  

  constructor(
    private fb: FormBuilder,
    private newCustomerEntry: NewCustomerEntryService
  ) {
    this.vehicleForm = this.fb.group({
      vehicleNumber: ['', Validators.required],
      customerName: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      vehicleType: ['', Validators.required],
      customerType: ['', Validators.required],
      amount: [{ value: '', disabled: false }],
      advance: [''],
      fromDateDaily: [null],
      timeIn: [''],
      fromDateMonthly: [null],
      billNumber: ['', this.billNumberRequiredIfDaily()],
      status: ['Unpaid'],
      monthlyStatus: ['Active', Validators.required],
      note: [''],
      address: ['']
    });

    this.vehicleForm.get('customerType')?.valueChanges.subscribe(type => {
      const statusCtrl = this.vehicleForm.get('status');
      const billNumberCtrl = this.vehicleForm.get('billNumber');
      const advanceCtrl = this.vehicleForm.get('advance');
      const monthlyStatusCtrl = this.vehicleForm.get('monthlyStatus');
      const fromDateMonthlyStatusCtrl = this.vehicleForm.get('fromDateMonthly');
      const fromDateDailyStatusCtrl = this.vehicleForm.get('fromDateDaily');
      const timeInCtrl = this.vehicleForm.get('timeInCtrl');


    
      if (type === 'Monthly') {
        statusCtrl?.disable({ emitEvent: false });
        billNumberCtrl?.disable({ emitEvent: false });
        monthlyStatusCtrl?.enable({ emitEvent: false });
        advanceCtrl?.enable({ emitEvent: false });
        fromDateMonthlyStatusCtrl?.enable({ emitEvent: false });
        fromDateDailyStatusCtrl?.disable({ emitEvent: false });
        timeInCtrl?.disable({ emitEvent: false });
      }
    
      if (type === 'Daily') {
        monthlyStatusCtrl?.disable({ emitEvent: false });
        advanceCtrl?.disable({ emitEvent: false });
        statusCtrl?.enable({ emitEvent: false });
        billNumberCtrl?.enable({ emitEvent: false });
        fromDateMonthlyStatusCtrl?.disable({ emitEvent: false });
        fromDateDailyStatusCtrl?.enable({ emitEvent: false });
        timeInCtrl?.enable({ emitEvent: false });
      }
    
      statusCtrl?.updateValueAndValidity({ emitEvent: false });
      monthlyStatusCtrl?.updateValueAndValidity({ emitEvent: false });
    });
      this.vehicleForm.valueChanges.subscribe((values) => {
      this.calculateAmount(values.customerType, values.vehicleType);
    });
  }

  billNumberRequiredIfDaily(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.parent) return null;
      const customerType = control.parent.get('customerType')?.value;
      const billNumber = control.value;

      if (
        customerType === 'Daily' &&
        (!billNumber || billNumber.trim() === '')
      ) {
        return { requiredIfDaily: true };
      }
      return null;
    };
  }

  onDateChange(event: any) {
    const selectedDate = event.target.value;
  
    if (!selectedDate) return;
  
    const time = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    console.log(time);
  
    this.vehicleForm.patchValue({
      timeIn: time
    });
  
  }

  onCustomerTypeChange(value: string) {
    if (value === 'Daily') {
      this.isDailyCustomer = true;
      this.isMonthlyCustomer = false;
    } else {
      this.isMonthlyCustomer = true;
      this.isDailyCustomer = false;
    }
  }

  calculateAmount(customerType: string, vehicleType: string) {
    const amount = this.pricing[customerType]?.[vehicleType] || '';
    this.vehicleForm.get('amount')?.setValue(amount, { emitEvent: false });
  }

  private normalizeVehicleNumber(value: string): string {
    return value
      .toUpperCase()
      .replace(/\s+/g, '')
      .trim();
  }

  submitForm() {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    const payload: any = { ...this.vehicleForm.value };
  
    if (payload.vehicleNumber) {
      payload.vehicleNumber = this.normalizeVehicleNumber(payload.vehicleNumber);
    }
  
    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
        delete payload[key];
      }
    });
  
    console.log('Final Payload:', payload);
  
    this.newCustomerEntry
      .addNewCustomerEntry(payload)
      .then(() => {
        console.log('Customer Details saved successfully');
        this.vehicleForm.reset();
        this.formClosed.emit();
      })
      .catch(error => {
        console.error('Error saving Customer Details:', error);
      });
  }
  

  cancelEntry() {
    this.vehicleForm.reset();
    this.formClosed.emit();
  }
}
