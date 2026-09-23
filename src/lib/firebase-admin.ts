import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseConfig = {
    apiKey: "REDACTED_FIREBASE_API_KEY",
    authDomain: "app-autoescuelas.firebaseapp.com",
    projectId: "app-autoescuelas",
    storageBucket: "app-autoescuelas.firebasestorage.app",
    messagingSenderId: "1052256648851",
    appId: "1:1052256648851:web:be554d44e88ae94da5d766"
};

if (!getApps().length) {
    initializeApp({
        projectId: firebaseConfig.projectId,
    });
}

export const adminAuth = getAuth();
