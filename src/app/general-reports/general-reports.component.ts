import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TransactionService } from '../transaction.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-general-reports',
  standalone: true,
  imports: [MatIconModule, CommonModule, RouterModule],
  templateUrl: './general-reports.component.html',
  styleUrl: './general-reports.component.scss'
})
export class GeneralReportsComponent {

  constructor(
    private transactionService: TransactionService,
  ) {}

  async downloadActiveCustomerPDF(withDetails?: boolean) {
    const activeCustomersData = await firstValueFrom(
      this.transactionService.getActiveMonthlyCustomers()
    );
    const activeCustomers = activeCustomersData?.sort(
      (a: any, b: any) => (a.lotNumber ?? 0) - (b.lotNumber ?? 0)
    );
  
    const doc = new jsPDF('l', 'mm', 'a4');
  
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
  
    doc.setFillColor(217, 217, 217);
    doc.rect(0, 0, pageWidth, 18, 'F');
  
    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('PMCP', 14, 13);
  
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
  
    const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const timestamp = `${datePart}${timePart}`;
    doc.text(`Active Customer Sheet - ${timestamp}`, pageWidth / 2, 13, { align: 'center' });
  
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(today, pageWidth - 14, 13, { align: 'right' });
  
    doc.setTextColor(0, 0, 0);
  
    const marginLeft  = 10;
    const marginRight = 10;
    const usableWidth = pageWidth - marginLeft - marginRight;
  
    const colWidths = {
      lotNumber:   usableWidth * 0.06,
      vehicle:     usableWidth * 0.12,
      name:        usableWidth * 0.12,
      amountToPay: usableWidth * 0.1,
      paid:        usableWidth * 0.1,
      balance:     usableWidth * 0.1,
      date:        usableWidth * 0.1,
      paymentType: usableWidth * 0.1,
      note:        usableWidth * 0.16,
    };
  
    const commonConfig = {
      startY: 24,
      margin: { left: marginLeft, right: marginRight },
      tableWidth: usableWidth,
      styles:             { lineWidth: 0.5, lineColor: [0, 0, 0] as any, fontSize: 10, cellPadding: 4 },
      headStyles:         { fillColor: [217, 217, 217] as any, textColor: 0, halign: 'center' as const },
      bodyStyles:         { fillColor: [245, 245, 245] as any, textColor: [0, 0, 0] as any, lineWidth: 0.3 },
      alternateRowStyles: { fillColor: [255, 255, 255] as any },
      theme: 'grid' as const,
    };
  
    if (withDetails) {
      const tableBody = (activeCustomers ?? []).map((c: any) => [
        c.lotNumber ?? '',
        c.vehicleNumber ?? '',
        c.customerName ?? '',
        c.customerPhoneNbr ?? '',
        c.vehicleName ?? c.vehicleName,
        c.address ?? '',
      ]);

      autoTable(doc, {
        head: [['Lot Number', 'Vehicle', 'Name', 'Phone Number', 'vehicle Name', 'Address']],
        body: tableBody,
        ...commonConfig,
      });

    } else {
      const tableBody = (activeCustomers ?? []).map((c: any) => [
        c.lotNumber ?? '',
        c.vehicleNumber ?? '',
        c.customerName ?? '',
        `${c.Transactions?.currentPending ?? 0}`,
        '', '', '', '', '',
      ]);

      autoTable(doc, {
        head: [['Lot Number', 'Vehicle', 'Name', 'Amount To Pay', 'Paid', 'Balance', 'Transaction Date', 'Payment Type', 'Note']],
        body: tableBody,
        ...commonConfig,
        columnStyles: {
          0: { cellWidth: colWidths.lotNumber,   halign: 'center' as const },
          1: { cellWidth: colWidths.vehicle,     halign: 'center' as const },
          2: { cellWidth: colWidths.name,        halign: 'center' as const },
          3: { cellWidth: colWidths.amountToPay, halign: 'center' as const },
          4: { cellWidth: colWidths.paid,        halign: 'center' as const },
          5: { cellWidth: colWidths.balance,     halign: 'center' as const },
          6: { cellWidth: colWidths.date,        halign: 'center' as const },
          7: { cellWidth: colWidths.paymentType, halign: 'center' as const },
          8: { cellWidth: colWidths.note,        halign: 'center' as const },
        },
      });
    }
  
    const filename = withDetails
      ? `Customer-Details ${timestamp}.pdf`
      : `Monthly-ActiveCustomers-Balance-Sheet ${timestamp}.pdf`;
  
    doc.save(filename);
  }

}
