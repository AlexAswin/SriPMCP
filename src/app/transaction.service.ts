import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, deleteDoc, doc, docData, getDoc, getDocs, query, setDoc, updateDoc, where } from '@angular/fire/firestore';
import { Observable, combineLatest, map, of, switchMap, tap } from 'rxjs';

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
        transactionDate: 'NO TRANSACTION'
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
          currentPending: currentPending,
          paymentMethod: transactionData.paymentMethod
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
          paymentMethod: transactionData.paymentMethod
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
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthId = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    return prevMonthId;
  }

  getMonthlyCustomersTransactions(): Observable<any[]> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(customersRef, where('monthlyStatus', 'in', ['Active', 'InActive']));
  
    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((customers: any[]) => {
        if (!customers.length) return of([]);
  
        const currentMonth = this.getCurrentMonth();
  
        const details = customers.map(customer => {
          const ledgerRef = doc(
            this.firestore,
            `CustomerEntry/${customer.id}/Transactions/${currentMonth}`
          );
  
          return docData(ledgerRef).pipe(
            map(ledger => {
              if (!ledger) {
                this.createNewMonthLedgerForActiveCustomers(currentMonth);
              }
              return {
                ...customer,
                Transactions: ledger,
              };
            })
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
  
  async createNewMonthLedgerForActiveCustomers(date: string): Promise<void> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(customersRef, where('monthlyStatus', '==', 'Active'));
  
    const customersSnap = await getDocs(q);
    if (customersSnap.empty) return;
  
    const now = new Date();
  
    const currentMonth = this.getMonthIdFromDate(date)


  
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(
      prevMonthDate.getMonth() + 1
    ).padStart(2, '0')}`;

  
    for (const customer of customersSnap.docs) {
      const customerId = customer.id;
      const customerData = customer.data();
  
      const transactionsRef = collection(
        this.firestore,
        `CustomerEntry/${customerId}/Transactions`
      );
  
      const prevLedgerRef = doc(transactionsRef, prevMonth);
      const prevSnap = await getDoc(prevLedgerRef);
  
      const prevPending = prevSnap.exists()
        ? prevSnap.data()?.['currentPending'] ?? 0
        : 0;
        const monthlyCost = prevSnap.exists()
        ? prevSnap.data()?.['monthlyCost'] ?? 0
        : 0;

        const advance = prevSnap.exists()? prevSnap.data()?.['advance'] : 0;

        const transactionDate = prevSnap.exists()? prevSnap.data()?.['transactionDate'] : 0;

        const paymentMethod: string | null = prevSnap.exists()? (prevSnap.data()?.['paymentMethod'] as string ?? null) : null;

  
      const newPending = prevPending + monthlyCost;
      const newLedgerRef = doc(transactionsRef, currentMonth);
      const existingSnap = await getDoc(newLedgerRef);
      if (existingSnap.exists()) continue;
  
      await setDoc(newLedgerRef, {
        advance: advance,
        currentPending: newPending,
        monthlyCost: monthlyCost,
        transactionAmount: 0,
        transactionDate: 'NO TRANSACTION',
        paymentMethod: 'NOT PAID'
      });
    }
  }

  getMonthIdFromDate(dateStr: string): string {
    const [y, m] = dateStr.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  async deleteCustomerCurrentMonthTransaction(vehicleNumber: string) {
    const currentMonth = this.getCurrentMonth();
    const transactionRef = doc(this.firestore, `CustomerEntry/${vehicleNumber}/Transactions/${currentMonth}`);
    
    const snap = await getDoc(transactionRef);
    if (!snap.exists()) {
      console.log('No transaction found to delete');
      return;
    }
  
    await deleteDoc(transactionRef);
    console.log('Deleted successfully');
  }

   addDailyTransactionsToNewCustomer = async(customerDetails: any) => {
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
  
      const [year, month] = customerDetails.fromDateDaily.split('-').map(Number);
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      const transactionRef = doc(customerRef, 'Transactions', currentMonth);
      const dailyTransactionDetails = await getDoc(transactionRef);
      const transactionData = {
        dailyCost: customerDetails.amount,
        currentPending: customerDetails.amount,
        settledAmount: null,
        transactionAmount: 0,
        transactionDate: 'NO TRANSACTION'
      }
  
      if (!dailyTransactionDetails.exists()) {
        await setDoc(transactionRef, {
          ...transactionData,
        });
      }
    } catch (error) {
      console.error('Error saving transaction', error);
    }
  }

  getDailyCustomersTransactions(): Observable<any[]> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(customersRef, where('dailyStatus', 'in', ['paid', 'Unpaid']));
  
    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((customers: any[]) => {
        if (!customers.length) return of([]);
  
        const currentMonth = this.getCurrentMonth();
  
        const details = customers.map(customer => {
          const ledgerRef = doc(
            this.firestore,
            `CustomerEntry/${customer.id}/Transactions/${currentMonth}`
          );
  
          return docData(ledgerRef).pipe(
            map(ledger => {
              if (!ledger) {
                this.createNewMonthLedgerForActiveCustomers(currentMonth);
              }
              return {
                ...customer,
                Transactions: ledger,
              };
            })
          );
        });
  
        return combineLatest(details);
      })
    );
  }

  
  
}
