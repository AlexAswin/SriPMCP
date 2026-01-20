import { Injectable } from '@angular/core';
import { addDoc, collectionData, deleteDoc, doc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface VehicleType {
  id?: string;
  vehicleType: string;
  monthlyCost: number;
  dailyCost: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(private firestore: Firestore) { }

  addVehicle(vehicleData: any) {
    const docRef = doc(this.firestore, 'vehicles', vehicleData.vehicleType);
    return setDoc(docRef, vehicleData);
  }

  addExpense(data: any) {
    const ref = collection(this.firestore, 'expenses');
    return addDoc(ref, data);
  }

  addPaymentMethod(data: any) {
    const ref = collection(this.firestore, 'paymentMethods');
    return addDoc(ref, data);
  }

  getPaymentMethods(): Observable<any[]> {
    const ref = collection(this.firestore, 'paymentMethods');
    return collectionData(ref, { idField: 'id' });
  }

  getVehicleTypes(): Observable<VehicleType[]> {
    const ref = collection(this.firestore, 'vehicles');
    return collectionData(ref, { idField: 'id' }) as Observable<VehicleType[]>;
  }

  async updateVehiclePrice(vehicleType: string, newCost: number, duration: string) {
    try {
      const vehicleCollection = collection(this.firestore, 'vehicles');
  
      const q = query(vehicleCollection, where('vehicleType', '==', vehicleType));
      const querySnapshot = await getDocs(q);
  
      if (querySnapshot.empty) {
        return;
      }

      const updateData =
        duration === 'Monthly' ? { monthlyCost: newCost } : { dailyCost: newCost };
  
      querySnapshot.forEach(async docSnap => {
        await updateDoc(docSnap.ref, updateData);
      });
    } catch (error) {
      console.error('Error updating vehicle price:', error);
    }
  }

  deleteVehicle(vehicleType: string) {
    const docRef = doc(this.firestore, `vehicles/${vehicleType}`);
    return deleteDoc(docRef);
  }

  getExpenses() {
    const expenses = collection(this.firestore, 'expenses');
    return collectionData(expenses, { idField: 'id' });
  }

  deleteExpense(expenseId: string) {
    const docRef = doc(this.firestore, `expenses/${expenseId}`);
    return deleteDoc(docRef);
  }
}
