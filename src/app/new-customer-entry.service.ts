import { Injectable } from '@angular/core';
import {
  addDoc,
  arrayUnion,
  collectionData,
  deleteField,
  doc,
  getDoc,
  or,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, map } from 'rxjs';
import { TransactionService } from './transaction.service';

@Injectable({
  providedIn: 'root',
})
export class NewCustomerEntryService {
  private vehicleSource = new BehaviorSubject<any>(null);
  vehicle$ = this.vehicleSource.asObservable();

  constructor(
    private firestore: Firestore,
    private transactionService: TransactionService
  ) {}

  async addNewCustomerEntry(customerDetails: any) {
    const customerRef = doc(
      this.firestore,
      'CustomerEntry',
      customerDetails.vehicleNumber
    );
  
    const dateParts =
      customerDetails.customerType === 'Monthly'
        ? customerDetails.fromDateMonthly.split('-')
        : customerDetails.fromDateDaily.split('-');
    const monthId = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}`;
  
    const transactionRef = doc(
      this.firestore,
      'CustomerEntry',
      customerDetails.vehicleNumber,
      'Transactions',
      monthId
    );
  
    const billNumberRef = doc(
      this.firestore,
      'BillNumbers',
      String(customerDetails.billNumber)
    );
  
    try {
      await runTransaction(this.firestore, async (transaction) => {
  
        // Bill number check — only for Daily customers
        if (customerDetails.customerType === 'Daily') {
          const billSnap = await transaction.get(billNumberRef);
          if (billSnap.exists()) {
            throw new Error(`Bill number ${customerDetails.billNumber} is already taken`);
          }
        }
  
        // Transaction data — only for Monthly customers
        if (customerDetails.customerType === 'Monthly') {
          const transactionData = {
            currentMonthTotal: Number(customerDetails.amount) || 0,
            monthlyCost: Number(customerDetails.amount) || 0,
            currentPending: Number(customerDetails.amount) || 0,
            isTransactionMade: false,
          };
          transaction.set(transactionRef, transactionData);
        }
  
        // Bill number assignment — only for Daily customers
        if (customerDetails.customerType === 'Daily') {
          transaction.set(billNumberRef, {
            customerId: customerDetails.vehicleNumber,
          });
        }
  
        transaction.set(customerRef, customerDetails);
      });
  
      console.log('Customer, Transaction, and BillNumber saved atomically.');
    } catch (error) {
      console.error('Transaction failed!', error);
      throw error;
    }
  }

  async isBillNumberTaken(billNumber: number): Promise<boolean> {
    const billRef = doc(this.firestore, 'BillNumbers', String(billNumber));
    const snap = await getDoc(billRef);
    return snap.exists();
  }

  async initializeMonthlyLedger(
    vehicleNumber: string,
    lastLedgerMonthId: string | null,
    currentMonth: string | null,
    cost: number
  ) {
    try {
      if (cost == null || isNaN(Number(cost))) {
        throw new Error(`Invalid cost value: ${cost}`);
      }
  
      if (!currentMonth) {
        throw new Error(`Invalid current month: ${currentMonth}`);
      }
  
      const normalizeMonthId = (monthId: string): string => {
        const parts = monthId.split('-');
        if (parts.length < 2 || !parts[0] || !parts[1]) {
          throw new Error(`Invalid month format: ${monthId}. Expected YYYY-MM or YYYY-MM-DD`);
        }
        return `${parts[0]}-${parts[1].padStart(2, '0')}`;
      };
  
      const normalizedCurrentMonth = normalizeMonthId(currentMonth);
      const normalizedLastMonthId = lastLedgerMonthId
        ? normalizeMonthId(lastLedgerMonthId)
        : null;
  
      const monthlyCost = Number(cost);
      const transactionsRef = collection(this.firestore, `CustomerEntry/${vehicleNumber}/Transactions`);
  
      const newLedgerRef = doc(transactionsRef, normalizedCurrentMonth);
      const existingDoc = await getDoc(newLedgerRef);
  
      if (existingDoc.exists()) {
        console.warn(`Ledger for ${normalizedCurrentMonth} already exists. Skipping initialization.`);
        return;
      }
  
      let previousPending = 0;
  
      if (normalizedLastMonthId) {
        const lastLedgerRef = doc(transactionsRef, normalizedLastMonthId);
        const lastLedgerSnap = await getDoc(lastLedgerRef);
  
        if (lastLedgerSnap.exists()) {
          previousPending = lastLedgerSnap.data()['currentPending'] ?? 0;
          console.log(`Found previous ledger: ${normalizedLastMonthId}. Carrying forward: ${previousPending}`);
        } else {
          console.warn(`Previous ledger ${normalizedLastMonthId} not found. Starting from 0.`);
        }
      } else {
        console.log('No previous ledger key provided. Starting from 0.');
      }
  
      const amountToPay = previousPending + monthlyCost;
  
      await setDoc(newLedgerRef, {
        monthlyCost: monthlyCost,
        currentMonthTotal: amountToPay,
        currentPending: amountToPay,
        isTransactionMade: false,
      });
  
      console.log(`Successfully initialized ledger for ${normalizedCurrentMonth} (vehicle: ${vehicleNumber})`);
  
    } catch (error) {
      console.error("Error initializing monthly ledger:", error);
      throw error;
    }
  }

  async getVehicleByNumber(vehicleNumber: string, identifier: string) {
    if (!vehicleNumber) return null;
  
    const vehiclesRef  = collection(this.firestore, 'CustomerEntry');
    const currentMonth = this.getCurrentMonth();
  
    const q = query(
      vehiclesRef,
      where(
        identifier === 'vehicleNbr' ? 'vehicleNumber' : 'billNumber',
        '==',
        vehicleNumber
      )
    );
  
    const snapshot = await getDocs(q);
  
    if (snapshot.empty) {
      this.setVehicle(null);
      return null;
    }
  
    const docSnap      = snapshot.docs[0];
    const customerId   = docSnap.id;
    const customerData = docSnap.data();
  
    const currentMonthRef  = doc(this.firestore, `CustomerEntry/${customerId}/Transactions/${currentMonth}`);
    const currentMonthSnap = await getDoc(currentMonthRef);
  
    let transactionData: any = {};
  
    if (currentMonthSnap.exists()) {
      transactionData = currentMonthSnap.data();
    } else {
      const allMonthsSnap = await getDocs(
        collection(this.firestore, `CustomerEntry/${customerId}/Transactions`)
      );
  
      if (!allMonthsSnap.empty) {
        const sorted = allMonthsSnap.docs
          .sort((a, b) => b.id.localeCompare(a.id)); 
  
        transactionData = {
          ...sorted[0].data(),
          monthId: sorted[0].id, 
        };
      }
    }
  
    const finalData = {
      id: customerId,
      ...customerData,
      Transactions: transactionData,
    } as any;
  
    this.setVehicle(finalData);
    return finalData;
  }


  setVehicle(data: any) {
    this.vehicleSource.next(data);
  }

  getVehicle() {
    return this.vehicleSource.value;
  }

  getActiveLotNumbers(): Observable<{ lotNumber: string, monthlyStatus: string }[]> {
    const customersRef = collection(this.firestore, 'CustomerEntry');
    const q = query(
      customersRef,
      or(
        where('monthlyStatus', '==', 'Active'),
        where('dailyStatus', '==', 'Unpaid')
      )
    );
    
    return from(getDocs(q)).pipe(
      map((snapshot: any) => snapshot.docs.map((doc: any) => doc.data() as { lotNumber: string, monthlyStatus: string }))
    );
  }

  async updateCustomerByVehicleNumber(
    vehicleNumber: string,
    updateData: any,
    historyPayload?: any
  ) {
    const ref = collection(this.firestore, 'CustomerEntry');
  
    const q = query(ref, where('vehicleNumber', '==', vehicleNumber));
    const snapshot = await getDocs(q);
  
    if (snapshot.empty) {
      throw new Error('Customer not found');
    }
  
    const docSnap = snapshot.docs[0];
    const customerDocId = docSnap.id;
    const docRef = doc(this.firestore, 'CustomerEntry', docSnap.id);
  
    const MONTHLY_FIELDS = ['lotNumber', 'monthlyStatus', 'startDateMonthly', 'endDateMonthly', 'fromDateMonthly', 'advance'];
    const DAILY_FIELDS   = ['dailyStatus', 'billNumber', 'fromDateDaily', 'endDateDaily', 'entryTime', 'exitTime', 'billAmount', 'actualCost', 'settledCost', 'totalDays'];
  
    const isDailyConversion   = updateData.dailyStatus === 'Unpaid' && !updateData.monthlyStatus;
    const isMonthlyConversion = updateData.monthlyStatus === 'Active' && !updateData.dailyStatus;
  
    const fieldsToDelete = isDailyConversion
      ? MONTHLY_FIELDS
      : isMonthlyConversion
      ? DAILY_FIELDS
      : [];
  
    const sanitizedData = fieldsToDelete.length
      ? {
          ...updateData,
          ...Object.fromEntries(fieldsToDelete.map(field => [field, deleteField()])),
        }
      : updateData;
  
    await updateDoc(docRef, sanitizedData);
  
    if (historyPayload) {
      const exitDate = historyPayload.Exit ?? historyPayload.endDate;
  
      if (!exitDate) {
        throw new Error('Exit Date is required for history document name');
      }
  
      const monthKey = exitDate.slice(0, 7);
  
      const historyRef = collection(
        this.firestore,
        'CustomerEntry',
        customerDocId,
        'statusHistory'
      );
  
      const historyDocRef = doc(historyRef, monthKey);
      const existingSnap = await getDoc(historyDocRef);
  
      if (existingSnap.exists()) {
        await updateDoc(historyDocRef, {
          entries: arrayUnion(historyPayload),
        });
      } else {
        await setDoc(historyDocRef, {
          entries: [historyPayload],
        });
      }
    }
  
    return docSnap.id;
  }

  getActiveMonthlyCustomers(): Observable<any[]> {
    const ref = collection(this.firestore, 'CustomerEntry');

    const q = query(ref, where('monthlyStatus', '==', 'Active'));

    return collectionData(q);
  }

  private getCurrentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
