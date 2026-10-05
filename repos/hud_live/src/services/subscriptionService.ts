import { db } from '../lib/firebase';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';

/**
 * Handles Stripe Checkout creation using the official Firebase Stripe Extension.
 * https://firebase.google.com/products/extensions/stripe-firestore-stripe-payments
 */
export async function startStripeCheckout(priceId: string, successUrl: string, cancelUrl: string) {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated for checkout.');
  }

  // The Firebase-Stripe extension automatically listens to new docs in the checkout_sessions collection
  const checkoutSessionsRef = collection(db, `users/${user.uid}/checkout_sessions`);
  const docRef = await addDoc(checkoutSessionsRef, {
    price: priceId,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return new Promise<void>((resolve, reject) => {
    // Wait for the extension to populate the checkout URL
    const unsubscribe = onSnapshot(docRef, (snap) => {
      const data = snap.data();
      if (!data) return;

      const { error, url } = data;
      if (error) {
        unsubscribe();
        reject(new Error(error.message));
      }
      if (url) {
        unsubscribe();
        window.location.assign(url); // Redirect to Stripe Checkout
        resolve();
      }
    });
  });
}

/**
 * Checks the user's active subscriptions mapped by Stripe Extension.
 */
export async function checkActiveSubscription(): Promise<boolean> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return false;

  const subscriptionsRef = collection(db, `users/${user.uid}/subscriptions`);
  // Look for active or trialing subs
  const q = query(subscriptionsRef, where("status", "in", ["trialing", "active"]));
  const querySnapshot = await getDocs(q);
  
  return !querySnapshot.empty;
}
