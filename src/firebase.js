// ── Firebase Configuration ────────────────────────────────────────────────────
// TODO: Replace the placeholder values below with your actual Firebase config.
// Steps:
//  1. Go to https://console.firebase.google.com
//  2. Create a new project (or use existing)
//  3. Enable "Phone" sign-in method under Authentication > Sign-in method
//  4. Register a Web App and copy the firebaseConfig object here
//  5. Enable Cloud Firestore in the Firebase console

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "YOUR_PROJECT.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "YOUR_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "YOUR_APP_ID",
};

const app    = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Development: disable reCAPTCHA for test phone numbers ──────────────────────
// This lets Firebase test phone numbers work without a real reCAPTCHA solve.
// Remove or guard this before deploying to production.
if (import.meta.env.DEV) {
  auth.settings.appVerificationDisabledForTesting = true;
}

export default app;
