import { Component, Inject, inject } from '@angular/core';
import { MatDialogContent, MatDialogActions, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from "../Common/button/button.component";


@Component({
  selector: 'app-payment-confirmation',
  standalone: true,
  imports: [MatDialogContent, MatDialogActions, ButtonComponent],
  templateUrl: './payment-confirmation.component.html',
  styleUrl: './payment-confirmation.component.scss'
})
export class PaymentConfirmationComponent {
  
  constructor(
    public dialogRef: MatDialogRef<PaymentConfirmationComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onConfirm() {
    this.dialogRef.close('confirm');
  }

  onCancel() {
    this.dialogRef.close();
  }

}
