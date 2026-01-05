import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class NewCustomerEntryService {

  constructor(private firestore: Firestore) { }

  addNewCustomerEntry(customerDetails: any) {
    const ref = collection(this.firestore, 'NewCustomerEntry');
    return addDoc(ref, customerDetails);
  }
}
