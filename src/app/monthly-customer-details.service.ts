import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class MonthlyCustomerDetailsService {

  constructor( private firestore: Firestore ) { }

  async getVehicleByNumber(vehicleNumber: string) {
    if (!vehicleNumber) return null;

    const vehiclesRef = collection(this.firestore, 'NewCustomerEntry');

    const q = query(
      vehiclesRef,
      where('vehicleNumber', '==', vehicleNumber)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];

    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  }
}
