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
  providedIn: 'root',
})
export class AdminService {
  constructor(private firestore: Firestore) {}

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

  async updateVehiclePriceBatch(
    vehicleType: string,
    monthly: number,
    daily: number
  ) {
    try {
      const vehicleCollection = collection(this.firestore, 'vehicles');
      const q = query(
        vehicleCollection,
        where('vehicleType', '==', vehicleType)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return;

      const updateData = {
        monthlyCost: monthly,
        dailyCost: daily,
      };

      const updatePromises = querySnapshot.docs.map((docSnap) =>
        updateDoc(docSnap.ref, updateData)
      );

      await Promise.all(updatePromises);
      console.log('Prices updated successfully!');

      try {
        await this.adjustVehicleCostForCurrentMonth(
          vehicleType,
          monthly,
          daily
        );
      } catch (error) {}
    } catch (error) {
      console.error('Error updating vehicle price:', error);
      throw error;
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

  deletePaymentMethod(expenseId: string) {
    const docRef = doc(this.firestore, `paymentMethods/${expenseId}`);
    return deleteDoc(docRef);
  }

async adjustVehicleCostForCurrentMonth(vehicleType: string, monthlyCost: number, dailyCost: number) {
  try {
    const now = new Date();
    const monthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const customerCollection = collection(this.firestore, 'CustomerEntry');
    const q = query(customerCollection, where('vehicleType', '==', vehicleType));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`No customers found with vehicle type: ${vehicleType}`);
      return;
    }
    const updatePromises = querySnapshot.docs.map(customerDoc => {
      const transactionDocRef = doc(
        this.firestore, 
        `CustomerEntry/${customerDoc.id}/Transactions/${monthId}`
      );

      return setDoc(transactionDocRef, { 
        monthlyCost: monthlyCost 
      }, { merge: true });
    });

    await Promise.all(updatePromises);
    console.log(`Updated ${updatePromises.length} customers to monthlyCost: ${monthlyCost} for ${monthId}`);

  } catch (error) {
    console.error("Error updating subcollection costs:", error);
  }
}
}
