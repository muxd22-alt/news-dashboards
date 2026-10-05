import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLanguageStore } from './store/useLanguageStore';
import { useAuthStore, UserProfile } from './store/useAuthStore';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Layout
import Navbar from './components/layout/Navbar';
import BottomNav from './components/layout/BottomNav';

// Views
import HomeView from './views/HomeView';
import AuthView from './views/AuthView';
import ClientDashboard from './views/ClientDashboard';
import VendorDashboard from './views/VendorDashboard';
import AdminDashboard from './views/AdminDashboard';
import PostRequestView from './views/PostRequestView';
import RequestDetailView from './views/RequestDetailView';
import TermsAndPrivacyView from './views/TermsAndPrivacyView';
import CommissionView from './views/CommissionView';

function DashboardRouter() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <div className="p-12 text-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/auth" />;

  if (user?.type === 'admin') return <AdminDashboard />;
  if (user?.type === 'vendor') return <VendorDashboard />;
  return <ClientDashboard />; // Default to client if no role, AuthView forces selection anyway
}

export default function App() {
  const { language } = useLanguageStore();
  const { setUser, setLoading } = useAuthStore();
  const [init, setInit] = useState(false);

  useEffect(() => {
    // Start listening to Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          setInit(true);
          return;
        }

        // Fetch User profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const profile: UserProfile = {
            id: firebaseUser.uid,
            name: data.fullName || '',
            phone: firebaseUser.phoneNumber || data.phone || '',
            email: firebaseUser.email || data.email || '',
            type: data.role || 'client',
            photoURL: data.photoURL || '',
            city: data.city || '',
            crNumber: data.crNumber || '',
            serviceCategories: data.serviceCategories || [],
            website: data.website || '',
            portfolio: data.portfolio || [],
            isVerified: data.isVerified || false,
            subscription: data.subscription,
            subscriptionRequest: data.subscriptionRequest,
            isBanned: data.isBanned || false,
          };
          setUser(profile);
        } else {
          // New user created by phone auth but no profile yet -> handled by AuthView usually
          setUser(null); // Force them to complete profile if they try to browse
        }
      } catch (error) {
        console.error("Auth sync error:", error);
        setUser(null);
      } finally {
        setLoading(false);
        setInit(true);
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return (
    <BrowserRouter>
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-neutral-50 font-sans text-neutral-900 flex flex-col">
        {init && (
          <>
            <Navbar />
            <main className="flex-1 pb-[68px] md:pb-0">
              <Routes>
                <Route path="/" element={<HomeView />} />
                <Route path="/auth" element={<AuthView />} />
                <Route path="/dashboard" element={<DashboardRouter />} />
                <Route path="/post" element={<PostRequestView />} />
                <Route path="/request/:id" element={<RequestDetailView />} />
                <Route path="/terms" element={<TermsAndPrivacyView />} />
                <Route path="/commission" element={<CommissionView />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
            <BottomNav />
          </>
        )}
      </div>
    </BrowserRouter>
  );
}
