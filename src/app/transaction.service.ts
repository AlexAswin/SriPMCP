import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, docData, getDoc, getDocs, query, setDoc, updateDoc, where } from '@angular/fire/firestore';
import { Observable, combineLatest, map, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(private firestore: Firestore) { }

  async createNewMonthlyCustomerTransaction (customerDetails: any) {
    try {
      const customerQuery = query(
        collection(this.firestore, 'CustomerEntry'),
        where('vehicleNumber', '==', customerDetails.vehicleNumber)
      );
  
      const snapshot = await getDocs(customerQuery);
  
      if (snapshot.empty) {
        console.error('Customer not found');
        return;
      }
  
      const customerDoc = snapshot.docs[0];
      const customerRef = doc(this.firestore, 'CustomerEntry', customerDoc.id);
  
      const [year, month] = customerDetails.fromDateMonthly.split('-').map(Number);
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      const transactionRef = doc(customerRef, 'Transactions', currentMonth);
      const monthlyTransactionDetails = await getDoc(transactionRef);
      const transactionData = {
        advance: customerDetails.advance,
        monthlyCost: customerDetails.amount,
        currentPending: customerDetails.amount,
        transactionAmount: 0,
        transactionDate: customerDetails.fromDateMonthly
      }
  
      if (!monthlyTransactionDetails.exists()) {
        await setDoc(transactionRef, {
          ...transactionData,
        });
      }
    } catch (error) {
      console.error('Error saving transaction', error);
    }
  }

  customerMonthlyTransactionDetails = async (customer: string | null, transactionData: any) => {
    if (!customer) {
      console.error('Customer is null');
      return;
    }
  
    try {
      const customerQuery = query(
        collection(this.firestore, 'CustomerEntry'),
        where('vehicleNumber', '==', customer)
      );
  
      const snapshot = await getDocs(customerQuery);
  
      if (snapshot.empty) {
        console.error('Customer not found');
        return;
      }
  
      const customerDoc = snapshot.docs[0];
      const customerRef = doc(this.firestore, 'CustomerEntry', customerDoc.id);
  
      const [year, month] = transactionData.transactionDate.split('-').map(Number);
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      const transactionRef = doc(customerRef, 'Transactions', currentMonth);
      const monthlyTransactionDetails = await getDoc(transactionRef);
  
       if (monthlyTransactionDetails.exists()){
        
        const existingData = monthlyTransactionDetails.data();
        const updatedAmount = (existingData['transactionAmount'] || 0) + (transactionData.transactionAmount || 0);
        const currentPending = transactionData.monthlyCost - updatedAmount;
  
        await updateDoc(transactionRef, {
          transactionAmount: updatedAmount,
          transactionDate: transactionData.transactionDate,
          currentPending: currentPending
        });
      } else {
        const prevMonthId = this.getPreviousMonthId(currentMonth);
        const prevTransactionRef = doc(customerRef, 'Transactions', prevMonthId);
        const prevTxnSnap = await getDoc(prevTransactionRef);
        const prevTxnDetails = prevTxnSnap.data();
        const currentMonthUpdates = {
          advance: transactionData.advance,
          monthlyCost: transactionData.monthlyCost,
          currentPending: (prevTxnDetails!['currentPending'] || 0 ) + (transactionData.monthlyCost || 0 ),
          transactionAmount: transactionData.transactionAmount,
          transactionDate: transactionData.transactionDate,
        }
        await setDoc(transactionRef, {
          ...currentMonthUpdates
        });
        
      }
    } catch (error) {
      console.error('Error saving transaction', error);
    }
  }

  getPreviousMonthId(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1); // JS months 0-based
    const prevMonthId = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    return prevMonthId;
  }

  getActiveCustomersWithCurrentMonthLedger(): Observable<any[]> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(customersRef, where('monthlyStatus', '==', 'Active'));

    return collectionData(q).pipe(
      switchMap((customers: any[]) => {
        if (!customers.length) return of([]);

        const currentMonth = this.getCurrentMonth();

        const details = customers.map(customer => {
          const ledgerRef = doc(
            this.firestore,
            `CustomerEntry/${customer.vehicleNumber}/Transactions/${currentMonth}`
          );

          return docData(ledgerRef).pipe(
            map(Transactions => ({
              ...customer,
              Transactions: Transactions || null
            }))
          );
        });

        return combineLatest(details);
      })
    );
  }

  private getCurrentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

}
