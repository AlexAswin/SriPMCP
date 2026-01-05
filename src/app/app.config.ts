import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {provideNativeDateAdapter} from '@angular/material/core';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';


import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideClientHydration(), provideAnimationsAsync(), provideNativeDateAdapter(),
    provideFirebaseApp(() => initializeApp({
      apiKey: "AIzaSyA_1vOEzZSs5W8ylsJqU1NwkApPwjRlw_c",
      authDomain: "pm-cp-6d357.firebaseapp.com",
      projectId: "pm-cp-6d357",
      storageBucket: "pm-cp-6d357.firebasestorage.app",
      messagingSenderId: "1082300166194",
      appId: "1:1082300166194:web:e6b1020e9fc251fd744c2b"
    })),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth())]
};
