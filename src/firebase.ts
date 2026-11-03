// SAME Firebase project as Pryielle MSG. Koi naya project/database nahi.
import { initializeApp } from "firebase/app";
import { Capacitor } from "@capacitor/core";
import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.generated";

export const app = initializeApp(firebaseConfig);

export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
  : getAuth(app);

export const db = initializeFirestore(app, { localCache: memoryLocalCache(), experimentalForceLongPolling: true });
