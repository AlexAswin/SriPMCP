import { Injectable } from '@angular/core';
import { Firestore, addDoc, arrayRemove, arrayUnion, collection, collectionData, deleteDoc, doc, docData, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from '@angular/fire/firestore';
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
    if (!customer) return;
  
    try {
      const customerQuery = query(
        collection(this.firestore, 'CustomerEntry'),
        where('vehicleNumber', '==', customer)
      );
      const snapshot = await getDocs(customerQuery);
      if (snapshot.empty) return;
  
      const customerDoc = snapshot.docs[0];
      const customerRef = doc(this.firestore, 'CustomerEntry', customerDoc.id);
  
      const dateParts = transactionData.transactionDate.split('-');
      const targetMonthId = `${dateParts[0]}-${dateParts[1]}`; 
  
      const targetMonthRef = doc(customerRef, 'Transactions', targetMonthId);
      const targetMonthSnap = await getDoc(targetMonthRef);
  
      const now = new Date();
      const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
      if (!targetMonthSnap.exists()) {
        console.error(`Ledger for ${targetMonthId} missing. Cannot post backdated payment.`);
        return; 
      }
  
      const existing = targetMonthSnap.data();
      const newPayment = Number(transactionData.transactionAmount) || 0;
      
      const oldPending = Number(existing['currentPending'] ?? existing['monthlyCost'] ?? 0);
      const updatedPending = Math.max(oldPending - newPayment, 0);
      const updatedTotalPaid = (existing['transactionAmount'] || 0) + newPayment;
      const currentMonthTotal = existing['currentMonthTotal']?? (existing['currentPending'] || 0) + existing['monthlyCost'] ;

  
      const newEntry = {
        transactionAmount: newPayment,
        transactionDate: transactionData.transactionDate,
        transactionType: transactionData.paymentMethod || 'Backdated Payment',
        existingPending: oldPending,
        newPending: updatedPending,
        id: `${customer}-${targetMonthId}-${(existing['transactionHistory']?.length + 1 || 1)}`,
      };
  
      let history = existing['transactionHistory'] || [];
      await updateDoc(targetMonthRef, {
        transactionHistory: arrayUnion(newEntry),
        transactionAmount: updatedTotalPaid,
        currentPending: updatedPending,
        isTransactionMade: true,
        currentMonthTotal: currentMonthTotal,
        lastTransactionDate: transactionData.transactionDate,
        paymentMethod: transactionData.paymentMethod

      });
  
      if (targetMonthId !== currentMonthId) {
        const currentMonthRef = doc(customerRef, 'Transactions', currentMonthId);
        const currentSnap = await getDoc(currentMonthRef);
        
        if (currentSnap.exists()) {
          const currentData = currentSnap.data();
          const currentOpeningPending = Number(currentData['currentPending'] || 0);
          
          await updateDoc(currentMonthRef, {
            currentPending: Math.max(currentOpeningPending - newPayment, 0),
            currentMonthTotal: Math.max(currentOpeningPending - newPayment, 0)
          });
        }
      }
  
      await updateDoc(customerRef, {
        FullTransactionHistory: arrayUnion({
          ...newEntry,
          // timestamp: new Date(),
          id: `${customer}-${targetMonthId}-${(existing['transactionHistory']?.length + 1 || 1)}`,
        }),
      });
  
      console.log(`Updated ${targetMonthId} and adjusted current balances.`);
  
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
        if (!customers.length) return of([]);
  
        const customerStreams = customers.map((customer) => {

          if (customer.monthlyStatus !== 'InActive') {
            const transactionDocRef = doc(
              this.firestore,
              `CustomerEntry/${customer.id}/Transactions/${currentMonth}`
            );
  
            return docData(transactionDocRef).pipe(
              map((ledger: any) => {
                if (!ledger) {
                  this.createNewMonthLedgerForActiveCustomers(currentMonth);
                }
                return {
                  ...customer,
                  Transactions: ledger || {}
                };
              })
            );
          } 
          
          else {
            const txRef = collection(
              this.firestore,
              `CustomerEntry/${customer.id}/Transactions`
            );
  
            return collectionData(txRef, { idField: 'monthId' }).pipe(
              map((txns: any[]) => {
                let lastTxn = {};
                if (txns && txns.length > 0) {
                  txns.sort((a, b) => a.monthId.localeCompare(b.monthId));
                  lastTxn = txns[txns.length - 1];
                }
                return {
                  ...customer,
                  Transactions: lastTxn
                };
              })
            );
          }
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
    
    if (customersSnap.empty) {
      console.log('No active customers found.');
      return;
    }
  
    const dateParts = date.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
  
    const currentMonthId = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const prevDateObj = new Date(year, month - 1, 1);
    const prevMonthId = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}`;
  
    let batch = writeBatch(this.firestore);
    let operationCount = 0;
  
    for (const customerDoc of customersSnap.docs) {
      if (operationCount >= 400) {
        await batch.commit();
        batch = writeBatch(this.firestore);
        operationCount = 0;
      }
  
      const customerId = customerDoc.id;
      const customerData = customerDoc.data();
      const transactionsRef = collection(this.firestore, `CustomerEntry/${customerId}/Transactions`);
  
      const currentLedgerRef = doc(transactionsRef, currentMonthId);
      const currentSnap = await getDoc(currentLedgerRef);
      
      if (currentSnap.exists()) {
        console.log(`Skipping ${customerId}: Ledger ${currentMonthId} already exists.`);
        continue; 
      }
  
      const prevLedgerRef = doc(transactionsRef, prevMonthId);
      const prevSnap = await getDoc(prevLedgerRef);
      const prevData = prevSnap.exists() ? prevSnap.data() : {};
  
      const monthlyCost = Number(prevData['monthlyCost'] ?? customerData['monthlyCost'] ?? 0);
      const prevPending = Number(prevData['currentPending'] ?? 0);
      const advance = Number(prevData['advance'] ?? customerData['advance'] ?? 0);
      const isTransactionMade = prevData['isTransactionMade'] ?? false;
  
      const newPending = prevPending + monthlyCost;
  
      const idleMarkerId = `${prevMonthId}_IDLE`;
      const fullHistory = customerData['FullTransactionHistory'] || [];
      const alreadyHasIdle = fullHistory.some((h: any) => h.id === idleMarkerId);
  
      if (!isTransactionMade && !alreadyHasIdle && prevSnap.exists()) {
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
  
      batch.set(currentLedgerRef, {
        currentPending: newPending,
        currentMonthTotal: newPending,
        isTransactionMade: false,
        monthlyCost: monthlyCost,
      }, { merge: true });
  
      operationCount++;
    }
  
    if (operationCount > 0) {
      await batch.commit();
      console.log('Monthly Ledger generation complete.');
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

  async deleteTransactionByID(vehicleNumber: string, transactionId: string) {
    try {
      const customerQuery = query(
        collection(this.firestore, 'CustomerEntry'),
        where('vehicleNumber', '==', vehicleNumber)
      );
      const snapshot = await getDocs(customerQuery);
      if (snapshot.empty) return;
  
      const customerDoc = snapshot.docs[0];
      const customerData = customerDoc.data();
      const customerRef = customerDoc.ref;

      const monthId = transactionId.split('-').slice(1, 3).join('-'); 
      const monthDocRef = doc(this.firestore, `CustomerEntry/${customerDoc.id}/Transactions/${monthId}`);
      const monthSnap = await getDoc(monthDocRef);
  
      const fullHistory = customerData['FullTransactionHistory'] || [];
      const toRemoveFull = fullHistory.find((t: any) => t.id === transactionId);
  
      let toRemoveShort = null;
      if (monthSnap.exists()) {
        const monthData = monthSnap.data();
        const shortHistory = monthData['transactionHistory'] || [];
        toRemoveShort = shortHistory.find((t: any) => t.id === transactionId);
      }
  
      if (toRemoveFull) {
        await updateDoc(customerRef, {
          FullTransactionHistory: arrayRemove(toRemoveFull)
        });
      }
      if (toRemoveShort) {
        await updateDoc(monthDocRef, {
          transactionHistory: arrayRemove(toRemoveShort),
          transactionAmount: (monthSnap.data()?.['transactionAmount'] || 0) - toRemoveShort.transactionAmount
        });
      }
  
    } catch (error) {
      console.error("Error during double deletion:", error);
      throw error;
    }
  }

  async updateVehicleCurrentMonthPending(vehicleNumber: string, settlementAmount: number) {
    const currentMonth = this.getCurrentMonth();

  try {

    const transactionRef = doc(
      this.firestore, 
      `CustomerEntry/${vehicleNumber}/Transactions/${currentMonth}`
    );

    await updateDoc(transactionRef, {
      currentPending: settlementAmount,
      currentMonthTotal: settlementAmount,
      transactionAmount: 0 
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
