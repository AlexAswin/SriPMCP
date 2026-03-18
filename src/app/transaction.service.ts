import { Injectable } from '@angular/core';
import { Firestore, addDoc, arrayUnion, collection, collectionData, deleteDoc, doc, docData, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from '@angular/fire/firestore';
import { Observable, combineLatest, from, map, of, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  constructor(private firestore: Firestore) {}

  customerMonthlyTransactionDetails = async (
    customer: string | null,
    transactionData: any
  ) => {
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
      const currentPending =
        existing['currentPending'] ?? existing['monthlyCost'] ?? 0;
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
        newPending: pending,
      };

      const updatedHistory = [...history, newEntry];

      await updateDoc(transactionRef, {
        transactionHistory: updatedHistory,
        transactionAmount: updatedAmount,
        currentPending: pending,
        lastTransactionDate: transactionData.transactionDate,
        paymentMethod: transactionData.paymentMethod,
        isTransactionMade: true,
      });

      const uniqueDocId = `${currentMonth}_${Date.now()}`;
      const fullHistoryRef = doc(
        transactionRef,
        'FullTransactionHistory',
        uniqueDocId
      );

      await updateDoc(customerRef, {
        FullTransactionHistory: arrayUnion({
          ...newEntry,
          timestamp: new Date(),
          id: `${currentMonth}_${Date.now()}`,
        }),
      });
    } catch (error) {
      console.error('Transaction Error:', error);
    }
  };

  getPreviousMonthId(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthId = `${prevDate.getFullYear()}-${String(
      prevDate.getMonth() + 1
    ).padStart(2, '0')}`;
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
        const customerStreams = customers.map((customer) => {
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
            collectionData(fullHistoryRef, { idField: 'id' }),
          ]).pipe(
            map(([ledger]) => {
              if (!ledger) {
                this.createNewMonthLedgerForActiveCustomers(currentMonth);
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

    // return `2026-04`;
  }

  async createNewMonthLedgerForActiveCustomers(date: string): Promise<void> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(customersRef, where('monthlyStatus', '==', 'Active'));
    const customersSnap = await getDocs(q);
    if (customersSnap.empty) return;
  
    const currentMonthId = this.getMonthIdFromDate(date);
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    const prevMonthId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  
    let batch = writeBatch(this.firestore);
    let operationCount = 0;
  
    for (const customerDoc of customersSnap.docs) {
      if (operationCount >= 480) {
        await batch.commit();
        batch = writeBatch(this.firestore);
        operationCount = 0;
      }
  
      const customerId = customerDoc.id;
      const customerData = customerDoc.data();
      const transactionsRef = collection(this.firestore, `CustomerEntry/${customerId}/Transactions`);
  
      const prevLedgerRef = doc(transactionsRef, prevMonthId);
      const prevSnap = await getDoc(prevLedgerRef);
  
      const prevData = prevSnap.exists() ? prevSnap.data() : {};
      const prevPending = prevData['currentPending'] ?? 0;
      const monthlyCost = prevData['monthlyCost'] ?? 0;
      const isTransactionMade = prevData['isTransactionMade'] ?? false;
      const advance = prevData['advance'] ?? 0;
  
      const newPending = prevPending + monthlyCost;
      const idleMarkerId = `${prevMonthId}_IDLE`;
      
      const fullHistory = customerData['FullTransactionHistory'] || [];
      const alreadyHasIdle = fullHistory.some((h: any) => h.id === idleMarkerId);
  
      if (!isTransactionMade && !alreadyHasIdle) {
        const customerRef = doc(this.firestore, 'CustomerEntry', customerId);
        batch.update(customerRef, {
          FullTransactionHistory: arrayUnion({
            id: idleMarkerId,
            transactionType: 'No Transactions',
            transactionAmount: 0,
            existingPending: prevPending,
            newPending: newPending,
            transactionDate: null,
            timestamp: new Date() 
          }),
        });
        operationCount++;
      }
  
      const newLedgerRef = doc(transactionsRef, currentMonthId);
      batch.set(newLedgerRef, {
        advance: advance,
        currentPending: newPending,
        monthlyCost: monthlyCost,
        isTransactionMade: false, 
      }, { merge: true });
      operationCount++;
    }

    if (operationCount > 0) {
      await batch.commit();
    }
  }

  getMonthIdFromDate(dateStr: string): string {
    const [y, m] = dateStr.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}`;

    // return `2026-04`;
  }

  async deleteCustomerCurrentMonthTransaction(vehicleNumber: string) {
    const currentMonth = this.getCurrentMonth();
    const transactionRef = doc(
      this.firestore,
      `CustomerEntry/${vehicleNumber}/Transactions/${currentMonth}`
    );

    const snap = await getDoc(transactionRef);
    if (!snap.exists()) {
      console.log('No transaction found to delete');
      return;
    }

    await deleteDoc(transactionRef);
    console.log('Deleted successfully');
  }

  async updateVehicleCurrentMonthPending(vehicleNumber: string, settlementAmount: number) {
    const currentMonth = this.getCurrentMonth();

  try {

    const transactionRef = doc(
      this.firestore, 
      `CustomerEntry/${vehicleNumber}/Transactions/${currentMonth}`
    );

    await updateDoc(transactionRef, {
      currentPending: settlementAmount 
    });
    return true;
  } catch (error) {
    console.error("Firebase Update Error:", error);
    throw error;
  }
  }

  addDailyTransactionsToNewCustomer = async (customerDetails: any) => {
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

      const [year, month] = customerDetails.fromDateDaily
        .split('-')
        .map(Number);
      const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      const transactionRef = doc(customerRef, 'Transactions', currentMonth);
      const dailyTransactionDetails = await getDoc(transactionRef);
      const transactionData = {
        dailyCost: customerDetails.amount,
        currentPending: customerDetails.amount,
        settledAmount: null,
        transactionAmount: 0,
        transactionDate: 'NO TRANSACTION',
      };

      if (!dailyTransactionDetails.exists()) {
        await setDoc(transactionRef, {
          ...transactionData,
        });
      }
    } catch (error) {
      console.error('Error saving transaction', error);
    }
  };

  getDailyCustomersTransactions(): Observable<any[]> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(
      customersRef,
      where('dailyStatus', 'in', ['paid', 'Unpaid'])
    );

    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((customers: any[]) => {
        if (!customers.length) return of([]);

        const currentMonth = this.getCurrentMonth();

        const details = customers.map((customer) => {
          const ledgerRef = doc(
            this.firestore,
            `CustomerEntry/${customer.id}/Transactions/${currentMonth}`
          );

          return docData(ledgerRef).pipe(
            map((ledger) => {
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
