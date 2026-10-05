import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useLanguageStore } from './store/useLanguageStore';
import { useAuthStore, UserProfile } from './store/useAuthStore';
import Navbar from './components/layout/Navbar';
import HomeView from './views/HomeView';
import AuthView from './views/AuthView';
import PostRequestView from './views/PostRequestView';
import RequestDetailView from './views/RequestDetailView';
import ClientDashboard from './views/ClientDashboard';
import VendorDashboard from './views/VendorDashboard';
import AdminDashboard from './views/AdminDashboard';
import CommissionView from './views/CommissionView';
import TermsAndPrivacyView from './views/TermsAndPrivacyView';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Home, ClipboardList, PlusCircle, User as UserIconLucide, Landmark, Shield } from 'lucide-react';
import { useAppConfig } from './store/useAppConfig';

import NotificationManager from './components/NotificationManager';

export default function App() {
  const { language, direction } = useLanguageStore();
  const { isAuthenticated, user, setUser, isLoading, setLoading } = useAuthStore();
  const fetchConfig = useAppConfig(state => state.fetchConfig);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [direction, language]);

  useEffect(() => {
    // Start listening to app setting changes
    const unsubConfig = fetchConfig();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          // Fetch profile from Firestore
          let userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          
          if (!userDoc.exists() && fbUser.email === 'swcc2012@gmail.com') {
            const { setDoc, serverTimestamp } = await import('firebase/firestore');
            await setDoc(doc(db, 'users', fbUser.uid), {
              uid: fbUser.uid,
              role: 'admin',
              email: fbUser.email,
              fullName: 'Admin',
              createdAt: serverTimestamp()
            });
            userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          }

          if (userDoc.exists()) {
            const profileData = userDoc.data();
            
            // Force admin role in DB if email matches
            if ((profileData.email || fbUser.email) === 'swcc2012@gmail.com' && profileData.role !== 'admin') {
              const { updateDoc } = await import('firebase/firestore');
              await updateDoc(doc(db, 'users', fbUser.uid), { role: 'admin' });
              profileData.role = 'admin';
            }

            setUser({
              id: fbUser.uid,
              phone: profileData.phone || fbUser.phoneNumber || '',
              name: profileData.fullName || '',
              email: profileData.email || fbUser.email || '',
              photoURL: profileData.photoURL || '',
              type: (profileData.email || fbUser.email) === 'swcc2012@gmail.com' ? 'admin' : (profileData.role || null),
              city: profileData.city || '',
              crNumber: profileData.crNumber || '',
              serviceCategories: profileData.serviceCategories || [],
              portfolio: profileData.portfolio || [],
              subscription: profileData.subscription || undefined,
              isBanned: profileData.isBanned || false
            } as UserProfile);
          } else {
            // No profile found, probably middle of registration
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <NotificationManager />
      <div className={`min-h-screen bg-neutral-100 mb-[68px] md:mb-0 font-${language === 'ar' ? 'cairo' : 'inter'}`}>
        <Navbar />
        
        <main className="pb-24 lg:pb-0">
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/commission" element={<CommissionView />} />
            <Route path="/terms" element={<TermsAndPrivacyView />} />
            <Route path="/auth" element={!isAuthenticated ? <AuthView /> : <Navigate to="/" />} />
            
            {/* Protected Routes */}
            <Route path="/post" element={isAuthenticated ? <PostRequestView /> : <Navigate to="/auth" />} />
            <Route path="/dashboard" element={
              isAuthenticated 
                ? (user?.type === 'admin' ? <AdminDashboard /> : (user?.type === 'client' ? <ClientDashboard /> : <VendorDashboard />))
                : <Navigate to="/auth" />
            } />
            <Route path="/request/:id" element={<RequestDetailView />} />
          </Routes>
        </main>

        {/* Bottom Nav for Mobile */}
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-safe-bottom">
          <div className="h-[68px] flex items-center justify-around px-2">
            <BottomTab icon={Home} label={language === 'ar' ? 'الرئيسية' : 'Home'} to="/" />
            
            {user?.type === 'client' && (
              <BottomTab icon={PlusCircle} label={language === 'ar' ? 'إضافة طلب' : 'Add Request'} to="/post" />
            )}
            
            {(user?.type === 'admin' || user?.type === 'vendor') && (
              <BottomTab 
                icon={ClipboardList} 
                label={language === 'ar' ? (user?.type === 'admin' ? 'الإدارة' : 'عروضي') : (user?.type === 'admin' ? 'Dashboard' : 'Bids')} 
                to="/dashboard" 
              />
            )}
            
            {user?.type !== 'vendor' && (
              <BottomTab icon={Landmark} label={language === 'ar' ? 'العمولة' : 'Commission'} to="/commission" />
            )}
            
            <BottomTab icon={Shield} label={language === 'ar' ? 'السياسات' : 'Policies'} to="/terms" />
            
            <BottomTab icon={UserIconLucide} label={language === 'ar' ? 'حسابي' : 'Profile'} to={user ? "/dashboard" : "/auth"} />
          </div>
        </div>
      </div>
    </Router>
  );
}

function BottomTab({ icon: Icon, label, to }: { icon: any, label: string, to: string }) {
  const location = useLocation();
  
  // Extract path and search from the 'to' prop
  const [toPath, toSearch] = to.split('?');
  
  let active = location.pathname === toPath;
  if (active && toSearch) {
    active = location.search.includes(toSearch);
  } else if (active && !toSearch && location.search) {
    active = false;
  }
  
  return (
    <Link 
      to={to} 
      className={`flex flex-1 flex-col items-center justify-center gap-1.5 h-full pt-1 transition-all ${
        active ? 'text-primary-600' : 'text-neutral-400 hover:text-neutral-600'
      }`}
    >
      <div className={`relative flex items-center justify-center transition-all duration-300 mb-1 ${active ? 'scale-110' : 'scale-100'}`}>
        <Icon 
          className="w-[22px] h-[22px]" 
          strokeWidth={active ? 2.5 : 2} 
          fill={active ? 'currentColor' : 'none'} 
          style={{ fillOpacity: active ? 0.15 : 0 }} 
        />
      </div>
      <span className={`text-[10px] leading-none transition-all duration-300 ${active ? 'font-bold' : 'font-medium'}`}>
        {label}
      </span>
    </Link>
  );
}
