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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ── Test Phone Numbers ────────────────────────────────────────────────────────
// Add your test numbers here (must also be configured in Firebase Console)
// Firebase Console → Authentication → Sign-in method → Phone → Test numbers
// Only populated in development builds — production bundles get an empty array.
const TEST_PHONE_NUMBERS = import.meta.env.DEV
  ? [
      '+919876543210',  // Your test number (configure in Firebase Console with OTP: 123456)
      // Add more test numbers here as needed
    ]
  : [];

// ── Smart Test Mode Detection ─────────────────────────────────────────────────
// Helper function to check if a phone number is a test number
export function isTestPhoneNumber(phoneNumber) {
  return TEST_PHONE_NUMBERS.includes(phoneNumber);
}

// Helper function to enable/disable test mode dynamically
export function setTestMode(enabled) {
  auth.settings.appVerificationDisabledForTesting = enabled;
  if (import.meta.env.DEV) {
    console.log(enabled ? '🧪 Test mode enabled' : '📱 Production mode enabled (reCAPTCHA + real SMS)');
  }
}

// Default: production mode (will be enabled per-login in Login.jsx)
auth.settings.appVerificationDisabledForTesting = false;

export default app;
