import { Injectable } from '@angular/core';
import { Firestore, addDoc, arrayUnion, collection, collectionData, deleteDoc, doc, docData, getDoc, getDocs, query, setDoc, updateDoc, where } from '@angular/fire/firestore';
import { Observable, combineLatest, from, map, of, switchMap, tap } from 'rxjs';

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
      // const currentMonth = `2026-02`;
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      const transactionRef = doc(customerRef, 'Transactions', currentMonth);
      const monthlyTransactionDetails = await getDoc(transactionRef);
      const transactionData = {
        advance: customerDetails.advance,
        monthlyCost: customerDetails.amount,
        currentPending: customerDetails.amount,
        isTransactionMade: false
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

  customerMonthlyTransactionDetails = async ( customer: string | null, transactionData: any ) => {
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
  
      const date = new Date(transactionData.transactionDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      // const currentMonth = `2026-02`;

  
      const transactionRef = doc(customerRef, 'Transactions', currentMonth);
      const monthlyTransactionDetails = await getDoc(transactionRef);
  
      if (!monthlyTransactionDetails.exists()) {
        console.error('Monthly ledger does not exist');
        return;
      }
  
      const existing = monthlyTransactionDetails.data();
  
      const previousTotal = existing['transactionAmount'] || 0;
      const newPayment = transactionData.transactionAmount || 0;
      const updatedAmount = previousTotal + newPayment;
      const currentPending = existing['currentPending'] ?? existing['monthlyCost'] ?? 0;
      const pending = Math.max(currentPending - newPayment, 0);
  
      let history = existing['transactionHistory'];
      if (!Array.isArray(history)) {
        history = history ? [history] : [];
      }
  
      const newEntry = {
        transactionAmount: newPayment,
        transactionDate: transactionData.transactionDate,
        transactionType: transactionData.paymentMethod,
        existingPending: currentPending,
        newPending: pending
      };
  
      const updatedHistory = [...history, newEntry];
  
      await updateDoc(transactionRef, {
        transactionHistory: updatedHistory,
        transactionAmount: updatedAmount,
        currentPending: pending,
        lastTransactionDate: transactionData.transactionDate,
        paymentMethod: transactionData.paymentMethod,
        isTransactionMade: true
      });
  
      const uniqueDocId = `${currentMonth}_${Date.now()}`;
      const fullHistoryRef = doc( transactionRef, 'FullTransactionHistory', uniqueDocId );
  
      await updateDoc(customerRef, {
        FullTransactionHistory: arrayUnion({
          ...newEntry,
          timestamp: new Date(),
          id: `${currentMonth}_${Date.now()}`
        })
      });
  
    } catch (error) {
      console.error('Transaction Error:', error);
    }
  };

  getPreviousMonthId(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthId = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    return prevMonthId;
  }

  // getActiveMonthlyCustomers(): Observable<any[]> {
  //   const customersRef = collection(this.firestore, 'CustomerEntry');
  //   const q = query(customersRef, where('monthlyStatus', '==', 'Active'));
  //   console.log(q)
  
  //   return collectionData(q, { idField: 'id' }).pipe(
  //     switchMap((customers: any[]) => {
  
  //       const currentMonth = this.getCurrentMonth();
  
  //       const details = customers.map(customer => {
  
  //         const ledgerRef = doc(
  //           this.firestore,
  //           `CustomerEntry/${customer.id}/Transactions/${currentMonth}`
  //         );
  
  //         return docData(ledgerRef).pipe(
  //           map(ledger => {
  
  //             if (!ledger) {
  //               this.createNewMonthLedgerForActiveCustomers(currentMonth);
  //             }
  
  //             return {
  //               ...customer,
  //               Transactions: ledger
  //             };
  //           })
  //         );
  //       });
  
  //       return combineLatest(details);
  //     })
  //   );
  // }

  // getInactiveCustomersWithLastTransaction(): Observable<any[]> {
  //   const customersRef = collection(this.firestore, 'CustomerEntry');
  //   const q = query(customersRef, where('monthlyStatus', '==', 'InActive'));
  
  //   return collectionData(q, { idField: 'id' }).pipe(
  //     switchMap((customers: any[]) => {
  
  //       if (!customers.length) return of([]);
  
  //       const details = customers.map(customer => {
  
  //         const txRef = collection(
  //           this.firestore,
  //           `CustomerEntry/${customer.id}/Transactions`
  //         );
  
  //         return collectionData(txRef, { idField: 'monthId' }).pipe(
  //           map((txns: any[]) => {
  
  //             if (!txns.length) {
  //               return {
  //                 ...customer,
  //                 Transactions: null
  //               };
  //             }
  //             txns.sort((a, b) => a.monthId.localeCompare(b.monthId));
  
  //             const lastTxn = txns[txns.length - 1];
  
  //             return {
  //               ...customer,
  //               Transactions: lastTxn
  //             };
  //           })
  //         );
  //       });
  
  //       return combineLatest(details);
  //     })
  //   );
  // }

  getAllCustomersWithTransactions(): Observable<any[]> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(customersRef, where('customerType', '==', 'Monthly'));
    const currentMonth = this.getCurrentMonth();
  
    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((customers: any[]) => {
        const customerStreams = customers.map(customer => {
  
          const transactionDocRef = doc(
            this.firestore,
            `CustomerEntry/${customer.id}/Transactions/${currentMonth}`
          );
  
          const fullHistoryRef = collection(
            this.firestore,
            `CustomerEntry/${customer.id}/Transactions/${currentMonth}/FullTransactionHistory`
          );
  
          return combineLatest([
            docData(transactionDocRef),
            collectionData(fullHistoryRef, { idField: 'id' })
          ]).pipe(
            map(([ledger, fullHistory]) => {
  
              if (!ledger) {
                // this.createNewMonthLedgerForActiveCustomers(currentMonth);
              }
  
              return {
                ...customer,
                Transactions: ledger || {},
                // FullTransactionHistory: fullHistory || []
              };
            })
          );
        });
  
        return combineLatest(customerStreams);
      })
    );
  }
  
  
  
  private getCurrentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // return `2026-02`
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
    // const prevMonth = '2026-01'
  
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

        const transactionDate = prevSnap.exists()? prevSnap.data()?.['lastTransactionDate'] : 0;

        const newPending = prevPending + monthlyCost;
        const newLedgerRef = doc(transactionsRef, currentMonth);

        const transactionHistoryUnpaid = {
          existingPending : newPending,
          newPending: 0,
          transactionAmount : 0,
          transactionDate : null,
          transactionType : null
        }

        const transactionHistory: any[] = prevSnap.exists()? prevSnap.data()?.['transactionHistory'] || [transactionHistoryUnpaid] : [];

      
      const existingSnap = await getDoc(newLedgerRef);
      if (existingSnap.exists()) continue;
  
      await setDoc(newLedgerRef, {
        advance: advance,
        currentPending: newPending,
        monthlyCost: monthlyCost,
        isTransactionMade: false
        // transactionHistory: transactionHistory
      });
    }
  }

  getMonthIdFromDate(dateStr: string): string {
    const [y, m] = dateStr.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}`;

    // return `2026-02`
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
