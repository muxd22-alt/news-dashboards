import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize AppCheck
// Note: In development with localhost, you might see "AppCheck: debug token" logs.
// Replace VITE_RECAPTCHA_SITE_KEY with your actual site key from Firebase Console -> App Check -> ReCAPTCHA Enterprise
if (typeof window !== 'undefined') {
  // Uncomment the following line to enable the App Check debug provider in dev environment
  // (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  /*
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY || 'YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY'),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    console.error("AppCheck initialization failed:", error);
  }
  */
}

// Initialize Firestore using long polling to bypass iframe/proxy WebSocket restrictions
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Simple connection test as required by instructions
async function testConnection() {
  try {
    // Attempting to reach the server directly to verify config
    await getDocFromServer(doc(db, '_connection_test_', 'check'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
    // Note: Permission denied is expected since we haven't deployed rules yet, 
    // but it proves the client reached the server.
  }
}

testConnection();
