import { Injectable } from '@angular/core';
import { Firestore, addDoc, arrayRemove, arrayUnion, collection, collectionData, deleteDoc, deleteField, doc, docData, getDoc, getDocs, increment, query, setDoc, updateDoc, where, writeBatch } from '@angular/fire/firestore';
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
      const customerRef = customerDoc.ref;
  
      const dateParts     = transactionData.transactionDate.split('-');
      const targetMonthId = `${dateParts[0]}-${dateParts[1]}`;
  
      const targetMonthRef  = doc(customerRef, 'Transactions', targetMonthId);
      const targetMonthSnap = await getDoc(targetMonthRef);
      if (!targetMonthSnap.exists()) return;
  
      const targetData = targetMonthSnap.data();
      const newPayment = Number(transactionData.transactionAmount) || 0;
  
      const history: any[] = targetData['transactionHistory'] || [];
  
      const existingIndexes = history.map((t: any) => {
        const parts    = t.id.split('-');
        const lastPart = parts[parts.length - 1];
        return parseInt(lastPart) || 0;
      });
      const nextIndex = (existingIndexes.length > 0 ? Math.max(...existingIndexes) : 0) + 1;
      const newTxId   = `${customer}-${targetMonthId}-${nextIndex}`;
  
      const monthOpeningBalance = targetData['currentMonthTotal'] ?? targetData['monthlyCost'] ?? 0;
  
      const newEntryRaw = {
        id:                newTxId,
        transactionAmount: newPayment,
        transactionDate:   transactionData.transactionDate,
        transactionType:   transactionData.paymentMethod || 'Payment',
        existingPending:   0, 
        newPending:        0,
      };
  
      const mergedHistory = [...history, newEntryRaw].sort((a, b) => {
        const dateComp = (a.transactionDate ?? '').localeCompare(b.transactionDate ?? '');
        if (dateComp !== 0) return dateComp;
        const aIdx = parseInt(a.id?.split('-').at(-1) ?? '0') || 0;
        const bIdx = parseInt(b.id?.split('-').at(-1) ?? '0') || 0;
        return aIdx - bIdx;
      });
  
      let runningPending = monthOpeningBalance;
      const recalculatedHistory = mergedHistory.map((tx) => {
        const existing   = runningPending;
        const newPending = Math.max(existing - (tx.transactionAmount ?? 0), 0);
        runningPending   = newPending;
        return {
          ...tx,
          existingPending: existing,
          newPending,
        };
      });
  
      const newEntry = recalculatedHistory.find((t) => t.id === newTxId)!;
  
      const updatedPending = recalculatedHistory.at(-1)?.newPending ?? 0;
  
      const oldPending  = Number(targetData['currentPending'] ?? 0);
      const shiftAmount = oldPending - updatedPending; 
  
      const allTxDates    = recalculatedHistory.map((t) => t.transactionDate);
      const lastTxDate    = [...allTxDates].sort().at(-1);
      const paymentMethod = recalculatedHistory.length > 1
        ? 'Multiple'
        : transactionData.paymentMethod;
  
      const batch = writeBatch(this.firestore);
  
      batch.update(targetMonthRef, {
        transactionHistory:  recalculatedHistory,
        transactionAmount:   (targetData['transactionAmount'] || 0) + newPayment,
        currentPending:      updatedPending,
        isTransactionMade:   true,
        lastTransactionDate: lastTxDate,
        paymentMethod,
      });
  
      const allMonthsSnap = await getDocs(
        collection(this.firestore, `${customerRef.path}/Transactions`)
      );
  
      allMonthsSnap.docs.forEach((docSnap) => {
        if (docSnap.id > targetMonthId) {
          const mData           = docSnap.data();
          const mHistory: any[] = mData['transactionHistory'] || [];
  
          const updateObj: any = {
            currentPending:    increment(-shiftAmount),
            currentMonthTotal: increment(-shiftAmount),
          };
  
          if (mHistory.length > 0) {
            updateObj.transactionHistory = mHistory.map((t) => ({
              ...t,
              existingPending: (t.existingPending ?? 0) - shiftAmount,
              newPending:      (t.newPending      ?? 0) - shiftAmount,
            }));
          }
  
          batch.update(docSnap.ref, updateObj);
        }
      });
  
      const rawFullHistory: any[] = customerDoc.data()['FullTransactionHistory'] || [];
  
      const otherMonthHistory = rawFullHistory.filter(
        (tx: any) => (tx.transactionDate ?? '').substring(0, 7) !== targetMonthId
      );
  
      const shiftedOtherHistory = otherMonthHistory.map((tx: any) => {
        const txMonth = (tx.transactionDate ?? '').substring(0, 7);
        if (txMonth > targetMonthId) {
          return {
            ...tx,
            existingPending: (tx.existingPending ?? 0) - shiftAmount,
            newPending:      (tx.newPending      ?? 0) - shiftAmount,
          };
        }
        return tx;
      });
  
      const finalHistory = [
        ...shiftedOtherHistory.filter(
          (tx: any) => (tx.transactionDate ?? '').substring(0, 7) < targetMonthId
        ),
        ...recalculatedHistory,
        ...shiftedOtherHistory.filter(
          (tx: any) => (tx.transactionDate ?? '').substring(0, 7) > targetMonthId
        ),
      ].filter((t: any) => t.id !== `${targetMonthId}_IDLE`);
  
      batch.update(customerRef, {
        FullTransactionHistory: finalHistory,
      });
  
      await batch.commit();
  
    } catch (error) {
      console.error('Backdated Transaction Sync Failed:', error);
      throw error;
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

  private buildCustomerQuery() {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    return query(customersRef, where('customerType', '==', 'Monthly'));
  }
  
  getCustomersCurrentMonth(): Observable<any[]> {
    const currentMonth = this.getCurrentMonth();
    const q = this.buildCustomerQuery();
  
    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((customers: any[]) => {
        if (!customers.length) return of([]);
  
        const streams = customers.map((customer) => {
          const txRef = collection(
            this.firestore,
            `CustomerEntry/${customer.id}/Transactions`
          );
  
          // Fetch ALL month docs so history amount column works correctly
          return collectionData(txRef, { idField: 'monthId' }).pipe(
            map((txns: any[]) => {
              const monthlyTransactions: Record<string, any> = {};
              txns.forEach((t) => (monthlyTransactions[t.monthId] = t));
  
              const currentTxn = monthlyTransactions[currentMonth] ?? txns.at(-1) ?? {};
  
              return {
                ...customer,
                Transactions: currentTxn,
                monthlyTransactions,
              };
            })
          );
        });
  
        return combineLatest(streams);
      })
    );
  }
  
  getCustomersForRange(fromMonth: string, toMonth: string): Observable<any[]> {
    const currentMonth = this.getCurrentMonth();
    const q = this.buildCustomerQuery();
  
    return collectionData(q, { idField: 'id' }).pipe(
      switchMap((customers: any[]) => {
        if (!customers.length) return of([]);
  
        const streams = customers.map((customer) => {
          const txRef = collection(
            this.firestore,
            `CustomerEntry/${customer.id}/Transactions`
          );
  
          const txQuery = query(
            txRef,
            where('__name__', '>=', fromMonth),
            where('__name__', '<=', toMonth)
          );
  
          return collectionData(txQuery, { idField: 'monthId' }).pipe(
            map((txns: any[]) => {
              const monthlyTransactions: Record<string, any> = {};
              txns.forEach((t) => (monthlyTransactions[t.monthId] = t));
  
              const currentTxn = monthlyTransactions[currentMonth]
                ?? txns.at(-1)
                ?? {};
  
              return {
                ...customer,
                Transactions: currentTxn,
                monthlyTransactions,
              };
            })
          );
        });
  
        return combineLatest(streams);
      })
    );
  }

  private getCurrentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // return `2026-04`;
  }

  createNewMonthLedger = () => {
    // const currentMonth = '2026-04';
    const currentMonth = this.getCurrentMonth();
    this.createNewMonthLedgerForActiveCustomers(currentMonth)
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
            newPending: prevPending,
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
      const customerRef = customerDoc.ref;
      const customerData = customerDoc.data();
  
      const parts   = transactionId.split('-');
      const monthId = parts.slice(parts.length - 3, parts.length - 1).join('-');
  
      const monthDocRef = doc(this.firestore, `${customerRef.path}/Transactions/${monthId}`);
      const monthSnap   = await getDoc(monthDocRef);
      if (!monthSnap.exists()) return;
  
      const monthData = monthSnap.data();
      const history: any[] = monthData['transactionHistory'] || [];
      const toRemove = history.find((t: any) => t.id === transactionId);
      if (!toRemove) return;
  
      const amount = toRemove.transactionAmount ?? 0;
      const batch  = writeBatch(this.firestore);
  
      if (history.length === 1) {
        batch.update(monthDocRef, {
          lastTransactionDate: deleteField(),
          paymentMethod:       deleteField(),
          transactionHistory:  deleteField(),
          transactionAmount:   deleteField(),
          isTransactionMade:   false,
          currentPending:      increment(amount),
        });
      } else {
        const updatedMonthHistory = history
          .filter((t) => t.id !== transactionId)
          .map((t) => {
            const isAfter =
              t.transactionDate > toRemove.transactionDate ||
              (t.transactionDate === toRemove.transactionDate && t.id > transactionId);
  
            if (isAfter) {
              return {
                ...t,
                existingPending: (t.existingPending ?? 0) + amount,
                newPending:      (t.newPending      ?? 0) + amount,
              };
            }
            return t;
          });
  
        const sortedRemaining = [...updatedMonthHistory].sort((a, b) =>
          (b.transactionDate ?? '').localeCompare(a.transactionDate ?? '')
        );
        const lastTx        = sortedRemaining[0];
        const paymentMethod = updatedMonthHistory.length > 1
          ? 'Multiple'
          : lastTx?.transactionType ?? 'Not Done';
  
        batch.update(monthDocRef, {
          transactionAmount:   increment(-amount),
          currentPending:      increment(amount),
          transactionHistory:  updatedMonthHistory,
          lastTransactionDate: lastTx?.transactionDate ?? deleteField(),
          paymentMethod,
        });
      }
  
      const allMonthsSnap = await getDocs(
        collection(this.firestore, `${customerRef.path}/Transactions`)
      );
  
      allMonthsSnap.docs.forEach((docSnap) => {
        if (docSnap.id > monthId) {
          const mData    = docSnap.data();
          const mHistory: any[] = mData['transactionHistory'] || [];
  
          const updateObj: any = {
            currentPending:      increment(amount),
            currentMonthTotal:   increment(amount),
          };
  
          if (mHistory.length > 0) {
            updateObj.transactionHistory = mHistory.map((t) => ({
              ...t,
              existingPending: (t.existingPending ?? 0) + amount,
              newPending:      (t.newPending      ?? 0) + amount,
            }));
          }
  
          batch.update(docSnap.ref, updateObj);
        }
      });
  
      const fullHistory: any[] = customerData['FullTransactionHistory'] || [];
  
      const updatedFullHistory = fullHistory
        .filter((t) => t.id !== transactionId)
        .map((t) => {
          const tMonth  = (t.transactionDate ?? '').substring(0, 7);
          const isAfter =
            tMonth > monthId ||
            (tMonth === monthId && t.transactionDate > toRemove.transactionDate) ||
            (tMonth === monthId && t.transactionDate === toRemove.transactionDate && t.id > transactionId);
  
          if (isAfter) {
            return {
              ...t,
              existingPending: (t.existingPending ?? 0) + amount,
              newPending:      (t.newPending      ?? 0) + amount,
            };
          }
          return t;
        });
  
      const customerUpdate: any = {};
  
      if (updatedFullHistory.length === 0) {
        customerUpdate.FullTransactionHistory = deleteField();
      } else {
        customerUpdate.FullTransactionHistory = updatedFullHistory;
      }
  
      batch.update(customerRef, customerUpdate); 
      await batch.commit();
  
    } catch (error) {
      console.error('Deletion failed:', error);
      throw error;
    }
  }

  updateVehicleCurrentMonthPending = async (
    vehicleNumber: string,
    settlementAmount: number
  ): Promise<boolean> => {
    if (!vehicleNumber) return false;
  
    try {
      const customerQuery = query(
        collection(this.firestore, 'CustomerEntry'),
        where('vehicleNumber', '==', vehicleNumber)
      );
      const snapshot = await getDocs(customerQuery);
      if (snapshot.empty) return false;
  
      const customerDoc = snapshot.docs[0];
      const customerRef = doc(this.firestore, 'CustomerEntry', customerDoc.id);
  
      const now = new Date();
      const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
      const currentMonthRef = doc(customerRef, 'Transactions', currentMonthId);
      const currentMonthSnap = await getDoc(currentMonthRef);
  
      if (!currentMonthSnap.exists()) {
        console.error(`Ledger for ${currentMonthId} missing.`);
        return false;
      }
  
      const currentData = currentMonthSnap.data();
      const history: any[] = currentData['transactionHistory'] || [];
      const oldPending  = Number(currentData['currentPending'] ?? 0);
      const shiftAmount = oldPending - settlementAmount;
      const isCostAdjustmentMade = true;
  
      if (history.length === 0) {
        await updateDoc(currentMonthRef, {
          isCostAdjustmentMade,
          currentPending:    settlementAmount,
          currentMonthTotal: settlementAmount,
          monthlyCost:       0,
        });
  
        const rawFullHistory: any[] = customerDoc.data()['FullTransactionHistory'] || [];
        const updatedFullHistory = rawFullHistory.map((tx: any) => {
          if (tx.id?.includes(currentMonthId)) {
            return {
              ...tx,
              existingPending: (tx.existingPending || 0) - shiftAmount,
              newPending:      (tx.newPending      || 0) - shiftAmount,
            };
          }
          return tx;
        });
  
        await updateDoc(customerRef, {
          FullTransactionHistory: updatedFullHistory,
        });
  
        console.log(`Simple adjustment for ${vehicleNumber}. No transaction history found.`);
        return true;
      }
  
      const updatedHistory = history.map((tx: any) => ({
        ...tx,
        existingPending: (tx.existingPending || 0) - shiftAmount,
        newPending:      (tx.newPending      || 0) - shiftAmount,
      }));
  
      await updateDoc(currentMonthRef, {
        isCostAdjustmentMade,
        currentPending:     settlementAmount,
        currentMonthTotal:  settlementAmount,
        monthlyCost:        0,
        transactionHistory: updatedHistory,
      });
  
      const rawFullHistory: any[] = customerDoc.data()['FullTransactionHistory'] || [];
      const updatedFullHistory = rawFullHistory.map((tx: any) => {
        if (tx.id?.includes(currentMonthId)) {
          return {
            ...tx,
            existingPending: (tx.existingPending || 0) - shiftAmount,
            newPending:      (tx.newPending      || 0) - shiftAmount,
          };
        }
        return tx;
      });
  
      await updateDoc(customerRef, {
        FullTransactionHistory: updatedFullHistory,
      });
  
      console.log(`Adjustment complete for ${vehicleNumber}. Shift applied: ${shiftAmount}`);
      return true;
  
    } catch (error) {
      console.error('Adjustment Error:', error);
      throw error;
    }
  };

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
