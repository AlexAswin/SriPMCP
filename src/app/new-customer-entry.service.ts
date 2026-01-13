import { Injectable } from '@angular/core';
import { addDoc, doc, updateDoc } from '@angular/fire/firestore';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';



@Injectable({
  providedIn: 'root'
})
export class NewCustomerEntryService {

  private vehicleSource = new BehaviorSubject<any>(null);
  vehicle$ = this.vehicleSource.asObservable();

  constructor(private firestore: Firestore) {}

  // ➕ Add new customer
  addNewCustomerEntry(customerDetails: any) {
    const ref = collection(this.firestore, 'NewCustomerEntry');
    return addDoc(ref, customerDetails);
  }

  // 🔍 Get vehicle by number
  async getVehicleByNumber(vehicleNumber: string) {
    if (!vehicleNumber) return null;

    const vehiclesRef = collection(this.firestore, 'NewCustomerEntry');
    const q = query(
      vehiclesRef,
      where('vehicleNumber', '==', vehicleNumber)
    );

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

    // ✅ Store globally
    this.setVehicle(data);

    return data;
  }

  // 📦 Store data
  setVehicle(data: any) {
    this.vehicleSource.next(data);
  }

  // 📤 Get latest value (sync)
   getVehicle() {
    return this.vehicleSource.value;
  }

  async updateCustomerByVehicleNumber(
    vehicleNumber: string,
    updateData: any,
    historyPayload: any
  ) {
    const ref = collection(this.firestore, 'NewCustomerEntry');
  
    const q = query(ref, where('vehicleNumber', '==', vehicleNumber));
    const snapshot = await getDocs(q);
  
    if (snapshot.empty) {
      throw new Error('Customer not found');
    }
  
    // Assuming vehicleNumber is UNIQUE
    const docSnap = snapshot.docs[0];
    const customerDocId = docSnap.id;
    const docRef = doc(this.firestore, 'NewCustomerEntry', docSnap.id);
  
    await updateDoc(docRef, updateData);

    const historyRef = collection(
      this.firestore,
      'NewCustomerEntry',
      customerDocId,
      'statusHistory'
    );
  
    await addDoc(historyRef, historyPayload);
  
    return docSnap.id;
  }

}

