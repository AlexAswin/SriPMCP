import { Injectable } from '@angular/core';
import { addDoc, collectionData, doc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { TransactionService } from './transaction.service';



@Injectable({
  providedIn: 'root'
})
export class NewCustomerEntryService {

  private vehicleSource = new BehaviorSubject<any>(null);
  vehicle$ = this.vehicleSource.asObservable();

  constructor(private firestore: Firestore,
              private transactionService: TransactionService) {}

  async addNewCustomerEntry(customerDetails: any) {  
    const docRef = doc(this.firestore, 'CustomerEntry', customerDetails.vehicleNumber);
  
    await setDoc(docRef, customerDetails);
    await this.transactionService.createNewMonthlyCustomerTransaction(customerDetails);
  }

  async getVehicleByNumber(vehicleNumber: string, identifier: string) {
    if (!vehicleNumber) return null;

    const vehiclesRef = collection(this.firestore, 'CustomerEntry');
    let q
    if (identifier === 'vehicleNbr') {
       q = query(
        vehiclesRef,
        where('vehicleNumber', '==', vehicleNumber)
      );
    } else {
       q = query(
        vehiclesRef,
        where('billNumber', '==', vehicleNumber)
      );
    }
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      this.setVehicle(null);
      return null;
    }

    const docSnap = snapshot.docs[0];
    const data = {
      id: docSnap.id,
      ...docSnap.data()
    }as any;

    this.setVehicle(data);

    return data;
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
      const historyRef = collection(this.firestore, 'CustomerEntry', customerDocId, 'statusHistory' );
      await addDoc(historyRef, historyPayload);
    }
    return docSnap.id;
  }

  getActiveMonthlyCustomers(): Observable<any[]> {
    const ref = collection(this.firestore, 'CustomerEntry');
  
    const q = query(
      ref,
      where('monthlyStatus', '==', 'Active')
    );
  
    return collectionData(q);
  }

}

