import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(private firestore: Firestore) { }

  customerMonthlyTransactionDetails = async (customer: string | null, transactionData: any) => {
    if (!customer) {
      console.error('Customer is null');
      return;
    }
  
    try {
      const customerQuery = query(
        collection(this.firestore, 'CustomerEntry'),
        where('vehicleNumber', '==', customer)
      );
  
      const snapshot = await getDocs(customerQuery);
  
      if (snapshot.empty) {
        console.error('Customer not found');
        return;
      }
  
      const customerDoc = snapshot.docs[0];
      const customerRef = doc(this.firestore, 'CustomerEntry', customerDoc.id);
  
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const transactionRef = doc(customerRef, 'Transactions', currentMonth);
  
      const monthlyTransactionDetails = await getDoc(transactionRef);
  
      if (monthlyTransactionDetails.exists()) {
        const existingData = monthlyTransactionDetails.data();
        const updatedAmount = (existingData['transactionAmount'] || 0) + (transactionData.transactionAmount || 0);
  
        await updateDoc(transactionRef, {
          transactionAmount: updatedAmount,
          transactionDate: transactionData.transactionDate
        });
  
        console.log(`Transaction updated. New cumulative amount: ${updatedAmount}`);
      } else {
        await setDoc(transactionRef, {
          ...transactionData,
        });
  
        console.log('First transaction added successfully');
      }
    } catch (error) {
      console.error('Error saving transaction', error);
    }
  }
}
