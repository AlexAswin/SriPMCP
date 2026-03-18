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
    const monthId = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}`;
    // const monthId = `2026-02`;


    const transactionRef = doc(
      this.firestore,
      'CustomerEntry',
      customerDetails.vehicleNumber,
      'Transactions',
      monthId
    );

    const transactionData = {
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

  async getVehicleByNumber(vehicleNumber: string, identifier: string) {
    if (!vehicleNumber) return null;

    const vehiclesRef = collection(this.firestore, 'CustomerEntry');
    const currentMonth = this.getCurrentMonth();
    // const currentMonth = '2026-02';

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

    const docSnap = snapshot.docs[0];
    const customerId = docSnap.id;
    const customerData = docSnap.data();

    const transactionDocRef = doc(
      this.firestore,
      `CustomerEntry/${customerId}/Transactions/${currentMonth}`
    );

    const transactionSnap = await getDoc(transactionDocRef);
    const transactionData = transactionSnap.exists()
      ? transactionSnap.data()
      : {};

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
