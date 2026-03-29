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

// ── Development: Test Mode for Localhost ──────────────────────────────────────
// Enable test mode for development to bypass reCAPTCHA and SMS sending.
// Add test phone numbers in Firebase Console: Authentication → Phone → Test numbers
// Example: +919999999999 with OTP 123456
//
// PRODUCTION: Test mode is automatically disabled (import.meta.env.DEV = false)
// Production uses real phone numbers with invisible reCAPTCHA verification.
if (import.meta.env.DEV) {
  auth.settings.appVerificationDisabledForTesting = true;
  console.log('🧪 Test mode enabled - use test phone numbers from Firebase Console');
  console.log('📝 Add test numbers: Firebase Console → Authentication → Sign-in method → Phone');
}

export default app;
