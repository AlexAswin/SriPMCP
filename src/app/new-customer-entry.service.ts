import { Injectable } from '@angular/core';
import {
  addDoc,
  collectionData,
  doc,
  getDoc,
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
import { BehaviorSubject, Observable } from 'rxjs';
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
    const batch = writeBatch(this.firestore);

    const customerRef = doc(
      this.firestore,
      'CustomerEntry',
      customerDetails.vehicleNumber
    );

    const dateParts = customerDetails.fromDateMonthly.split('-');
    // const monthId = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}`;
    const monthId = `2026-03`;


    const transactionRef = doc(
      this.firestore,
      'CustomerEntry',
      customerDetails.vehicleNumber,
      'Transactions',
      monthId
    );

    const transactionData = {
      currentMonthTotal: Number(customerDetails.amount) || 0,
      monthlyCost: Number(customerDetails.amount) || 0,
      currentPending: Number(customerDetails.amount) || 0,
      isTransactionMade: false,
    };

    batch.set(customerRef, customerDetails);
    batch.set(transactionRef, transactionData);

    try {
      await batch.commit();
      console.log('Customer and Transaction created atomically.');
    } catch (error) {
      console.error('Batch failed! No data was saved.', error);
      throw error;
    }
  }

  async initializeMonthlyLedger(vehicleNumber: string, monthId: string, cost: number) {
    try {
      const ledgerRef = doc(
        this.firestore, 
        `CustomerEntry/${vehicleNumber}/Transactions/${monthId}`
      );
  
      await setDoc(ledgerRef, {
        monthlyCost: Number(cost) ,
        currentMonthTotal: Number(cost) ,
        currentPending: Number(cost) || 0,
        isTransactionMade: false,
      }, { merge: true });
  
    } catch (error) {
      console.error("Error creating reactivation ledger:", error);
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
  
    // Try current month first
    const currentMonthRef  = doc(this.firestore, `CustomerEntry/${customerId}/Transactions/${currentMonth}`);
    const currentMonthSnap = await getDoc(currentMonthRef);
  
    let transactionData: any = {};
  
    if (currentMonthSnap.exists()) {
      // Current month doc exists — use it
      transactionData = currentMonthSnap.data();
    } else {
      // Current month missing — fetch all and use the latest
      const allMonthsSnap = await getDocs(
        collection(this.firestore, `CustomerEntry/${customerId}/Transactions`)
      );
  
      if (!allMonthsSnap.empty) {
        const sorted = allMonthsSnap.docs
          .sort((a, b) => b.id.localeCompare(a.id)); // latest month first
  
        transactionData = {
          ...sorted[0].data(),
          monthId: sorted[0].id, // so you know which month this came from
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

    await updateDoc(docRef, updateData);

    if (historyPayload) {
      const historyRef = collection(
        this.firestore,
        'CustomerEntry',
        customerDocId,
        'statusHistory'
      );
      await addDoc(historyRef, historyPayload);
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

    // return `2026-04`;
  }
}
