import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {provideNativeDateAdapter} from '@angular/material/core';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';


import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    provideFirebaseApp(() =>
      initializeApp({
        apiKey: "AIzaSyB-UYkc7rYy8E9IYeyG5mEtoCleTsBdpTA",
        authDomain: "sripmcp.firebaseapp.com",
        projectId: "sripmcp",
        storageBucket: "sripmcp.firebasestorage.app",
        messagingSenderId: "410118438687",
        appId: "1:410118438687:web:a5068bafbf822bb9faba2a",
        measurementId: "G-0G4LJWJP1L"
      })
    ),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
};
