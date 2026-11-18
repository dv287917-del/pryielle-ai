import { initializeApp } from "firebase/app";
import { Capacitor } from "@capacitor/core";
import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.generated";
import { IS_FLOAT } from "./lib/floating";

export const app = initializeApp(firebaseConfig);

// In the Android WebView getAuth() can hang on its popup iframe, so use explicit persistence there.
export const auth = Capacitor.isNativePlatform() || IS_FLOAT
  ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
  : getAuth(app);

// WebView: WebChannel streaming often never connects, so force long-polling (reliable) and
// use the in-memory cache (the IndexedDB cache can hang/lock on app restart and leave "SUMMONING" stuck).
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
});
