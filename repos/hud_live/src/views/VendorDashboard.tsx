import { useEffect, useState, FormEvent } from 'react';
import { useLanguageStore } from '../store/useLanguageStore';
import { translations } from '../lib/translations';
import { useAuthStore } from '../store/useAuthStore';
import { useAppConfig } from '../store/useAppConfig';
import { Bid } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Award, TrendingUp, CheckCircle, Loader2, Settings, User, Trash2, Camera, AlertTriangle, Save, Copy } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import ImageUpload from '../components/ImageUpload';
import PortfolioManager from '../components/PortfolioManager';
import { collectionGroup, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { EVENT_TYPES } from '../lib/constants';
import { cn } from '../lib/utils';

type Tab = 'overview' | 'settings' | 'subscription';

export default function VendorDashboard() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const { user, setUser } = useAuthStore();
  const { config } = useAppConfig();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam && ['settings', 'subscription', 'overview'].includes(tabParam) ? tabParam : 'overview');

  useEffect(() => {
    if (tabParam && ['settings', 'subscription', 'overview'].includes(tabParam)) setActiveTab(tabParam);
    else setActiveTab('overview');
  }, [tabParam]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [requestsData, setRequestsData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Settings State
  const [newName, setNewName] = useState(user?.name || '');
  const [newPhoto, setNewPhoto] = useState(user?.photoURL || '');
  const [newPortfolio, setNewPortfolio] = useState<string[]>(user?.portfolio || []);
  const [newCategories, setNewCategories] = useState<string[]>(user?.serviceCategories || []);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Subscription State
  const [selectedSubPackageId, setSelectedSubPackageId] = useState<string | null>(null);
  const [subReceipt, setSubReceipt] = useState<string>('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subSuccess, setSubSuccess] = useState(false);

  const markBidAsRead = async (bidId: string, requestId: string) => {
    try {
      const bidRef = doc(db, 'requests', requestId, 'bids', bidId);
      await updateDoc(bidRef, { isReadByVendor: true });
    } catch (e) {
      console.error("Failed to mark bid as read", e);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(language === 'ar' ? 'تم النسخ!' : 'Copied!');
  };

  const handleConfirmSubscription = async () => {
    if (!selectedSubPackageId || !subReceipt || !user?.id) return;
    setIsSubscribing(true);
    try {
      const userRef = doc(db, 'users', user.id);
      const subscriptionRequest = {
        packageId: selectedSubPackageId,
        receiptBase64: subReceipt,
        submittedAt: Date.now()
      };
      await updateDoc(userRef, {
        subscriptionRequest
      });
      setUser({ ...user, subscriptionRequest });
      setSubSuccess(true);
      setTimeout(() => setSubSuccess(false), 5000);
      setSelectedSubPackageId(null);
      setSubReceipt('');
    } catch (err: any) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'Error occurred. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Track current time for real-time expiration checks
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    // Use collectionGroup because bids are in subcollections: /requests/{id}/bids
    const q = query(
      collectionGroup(db, 'bids'),
      where('vendorId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bid[];
      setBids(docs);
      setIsLoading(false);
    }, (error) => {
      console.error("Vendor Bids Fetch Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    const fetchRelatedRequests = async () => {
      const reqIds = Array.from(new Set<string>(bids.map(b => b.requestId)));
      const newRequestsData: Record<string, any> = { ...requestsData };
      let changed = false;

      for (const id of reqIds) {
        if (!newRequestsData[id]) {
          try {
             const docSnap = await import('firebase/firestore').then(({ getDoc, doc }) => getDoc(doc(db, 'requests', id)));
             if (docSnap.exists()) {
               const data = docSnap.data();
               let expiresAt = data.expiresAt;
               if (data.expiresAt && typeof data.expiresAt.toMillis === 'function') {
                 expiresAt = data.expiresAt.toMillis();
               }
               let createdAt = data.createdAt;
               if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
                 createdAt = data.createdAt.toMillis();
               } else if (!createdAt) {
                 createdAt = Date.now();
               }
               const maxDuration = (config.requestLifespanMinutes || 18) * 60 * 1000;
               if (expiresAt - createdAt > maxDuration) {
                 expiresAt = createdAt + maxDuration;
               }
               newRequestsData[id] = { id: docSnap.id, ...data, expiresAt };
               changed = true;
             }
          } catch (e) {
             console.log(e);
          }
        }
      }
      
      if (changed) {
        setRequestsData(newRequestsData);
      }
    };
    if (bids.length > 0) fetchRelatedRequests();
  }, [bids]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        fullName: newName,
        photoURL: newPhoto,
        portfolio: newPortfolio,
        serviceCategories: newCategories
      });

      // Update portfolio in existing pending bids
      const pendingBids = bids.filter(b => b.status === 'pending');
      for (const bid of pendingBids) {
        try {
          await updateDoc(doc(db, 'requests', bid.requestId, 'bids', bid.id), {
            vendorPortfolio: newPortfolio
          });
        } catch (bidErr) {
          console.error("Failed to update portfolio on bid:", bidErr);
        }
      }

      setUser({
        ...user,
        name: newName,
        photoURL: newPhoto,
        portfolio: newPortfolio,
        serviceCategories: newCategories
      });
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      console.error("Update failed:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.id));
      await signOut(auth);
      window.location.href = '/';
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const activeBids = bids.filter(b => {
    if (b.status !== 'pending') return false;
    const req = requestsData[b.requestId];
    if (!req) return true;
    const isCompleted = req.status === 'completed' || req.status === 'confirmed';
    const isExpired = Math.max(0, req.expiresAt - now) === 0 && !isCompleted;
    return !isCompleted && !isExpired;
  });

  const acceptedBids = bids.filter(b => b.status === 'accepted');
  const rejectedBids = bids.filter(b => b.status === 'rejected');
  
  const expiredBids = bids.filter(b => {
    if (b.status !== 'pending') return false;
    const req = requestsData[b.requestId];
    if (!req) return false;
    const isCompleted = req.status === 'completed' || req.status === 'confirmed';
    const isExpired = Math.max(0, req.expiresAt - now) === 0 && !isCompleted;
    return isCompleted || isExpired;
  });

  const stats = [
    { label: language === 'ar' ? 'العروض النشطة' : 'Active Bids', value: activeBids.length, icon: <TrendingUp className="w-5 h-5 text-warning" /> },
    { label: language === 'ar' ? 'العروض المقبولة' : 'Accepted Bids', value: acceptedBids.length, icon: <CheckCircle className="w-5 h-5 text-success" /> },
    { label: language === 'ar' ? 'عروض لم يحالفها الحظ' : 'Unsuccessful Bids', value: rejectedBids.length + expiredBids.length, icon: <AlertTriangle className="w-5 h-5 text-neutral-400" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 pt-8 pb-32 md:pb-12">
              <div className="relative mb-12">
                {/* Banner */}
                <div className="h-32 md:h-48 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-900 overflow-hidden relative shadow-inner">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                </div>
                
                {/* Profile Info Overlay */}
                <div className="px-6 sm:px-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 -mt-16 md:-mt-12 relative z-10">
                  <div className="flex flex-col md:flex-row items-center md:items-end gap-5 w-full md:w-auto">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white p-1.5 rounded-full shadow-xl shrink-0">
                      <div className="w-full h-full bg-primary-50 rounded-full overflow-hidden flex items-center justify-center border border-neutral-100">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <LayoutDashboard className="w-10 h-10 text-primary-300" />
                        )}
                      </div>
                    </div>
                    <div className="pb-2 sm:pb-4 text-center md:text-start">
                      <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 drop-shadow-sm">{user?.name}</h1>
                      <div className="flex items-center justify-center md:justify-start gap-3 mt-1">
                        <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest flex items-center justify-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                           {language === 'ar' ? 'مورد نشط' : 'Active Vendor'}
                        </p>
                        {user?.subscription?.status === 'active' && (
                          <span className="px-2 py-0.5 bg-accent-50 text-accent-600 border border-accent-200 rounded-lg text-xs font-bold -mt-0.5 flex items-center gap-1">
                            <Award className="w-3 h-3" /> Promoted
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pb-2 sm:pb-4 w-full md:w-auto flex justify-center md:justify-end">
                    <div className="flex p-1.5 bg-neutral-100/80 backdrop-blur-sm rounded-xl shadow-inner border border-neutral-200 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                      <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none ${activeTab === 'overview' ? 'bg-white text-primary-600 shadow-sm ring-1 ring-neutral-200/50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50/50'}`}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        {language === 'ar' ? 'نظرة عامة' : 'Overview'}
                      </button>
                      <button 
                        onClick={() => setActiveTab('subscription')}
                        className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none ${activeTab === 'subscription' ? 'bg-white text-primary-600 shadow-sm ring-1 ring-neutral-200/50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50/50'}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {t.subscriptions || 'Subscriptions'}
                      </button>
                      <button 
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none ${activeTab === 'settings' ? 'bg-white text-primary-600 shadow-sm ring-1 ring-neutral-200/50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50/50'}`}
                      >
                        <Settings className="w-4 h-4" />
                        {t.settings}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 10 }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  {stats.map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                        {stat.icon}
                      </div>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                        i === 0 ? 'bg-warning/10 text-warning' : i === 1 ? 'bg-success/10 text-success' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {stat.icon}
                      </div>
                      <span className="text-4xl font-black text-neutral-900 mb-1">{stat.value}</span>
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                    </motion.div>
                  ))}
                </div>

                {bids.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border border-neutral-300 rounded-base p-12 text-center shadow-sm flex flex-col items-center justify-center"
                  >
                    <div className="mb-8 w-48 h-48 opacity-80">
                      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-neutral-200">
                        <circle cx="100" cy="100" r="80" fill="currentColor" fillOpacity="0.3" />
                        <path d="M70 110L90 130L140 70" stroke="#1F3A70" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500" strokeDasharray="200" strokeDashoffset="0" />
                        <rect x="60" y="80" width="80" height="60" rx="4" stroke="#1F3A70" strokeWidth="8" fill="white" className="text-primary-500" />
                        <path d="M80 100H120" stroke="#1F3A70" strokeWidth="8" strokeLinecap="round" />
                        <path d="M80 120H100" stroke="#1F3A70" strokeWidth="8" strokeLinecap="round" />
                        <circle cx="160" cy="40" r="10" fill="#D4AF37" className="text-accent-500 animate-pulse" />
                        <path d="M30 160L45 145" stroke="#D4AF37" strokeWidth="6" strokeLinecap="round" className="text-accent-500" />
                      </svg>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-primary-500 mb-3">
                      {language === 'ar' ? 'لا توجد عروض فعالة في الوقت الحالي' : 'No active bids at the moment'}
                    </h3>
                    <p className="text-neutral-500 mb-8 max-w-md mx-auto text-base">
                      {language === 'ar' 
                        ? 'تصفح قائمة الطلبات النشطة لتقديم عروض أسعار تنافسية. كلما قدمت عروضاً أكثر، زادت فرصك في الفوز بالعقود.' 
                        : 'Browse the active requests feed to place competitive bids. The more you bid, the higher your chances of winning contracts.'}
                    </p>
                    <Link 
                      to="/" 
                      className="h-14 px-10 bg-primary-500 text-white rounded-sm font-bold inline-flex items-center gap-2 hover:bg-primary-600 transition-colors shadow-base hover:shadow-md transform hover:-translate-y-0.5"
                    >
                       <TrendingUp className="w-5 h-5" />
                       {language === 'ar' ? 'استكشف الفرص المتاحة' : 'Explore Opportunities'}
                    </Link>
                  </motion.div>
                ) : (
                  <div>
                    {activeBids.length > 0 && (
                      <div className="mb-12">
                        <h3 className="text-xl font-bold text-neutral-700 mb-6 flex items-center gap-2">
                           <div className="w-1.5 h-5 bg-warning rounded-full" />
                           {language === 'ar' ? 'العروض النشطة' : 'Active Bids'}
                        </h3>
                        <div className="space-y-4">
                          {activeBids.map(bid => {
                            const req = requestsData[bid.requestId];
                            const reqTitle = req ? (language === 'ar' ? req.title : req.titleEn) : bid.requestId;
                            return (
                            <motion.div
                              key={bid.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white border border-neutral-300 rounded-base p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex-1">
                                <h4 className="font-bold text-primary-500 mb-1 line-clamp-1">{reqTitle}</h4>
                                <div className="flex gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 font-bold rounded-xs uppercase tracking-wider bg-warning/10 text-warning`}>
                                     {language === 'ar' ? 'قيد الانتظار' : 'Pending'}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">
                                     {new Date(bid.createdAt?.seconds * 1000).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-8">
                                <div className="text-end">
                                  <span className="text-[10px] text-neutral-300 uppercase font-bold block">{language === 'ar' ? 'عرض السعر' : 'Your Bid'}</span>
                                  <span className="text-lg font-bold text-primary-500">{bid.amount} {t.sar}</span>
                                </div>
                                <Link to={`/request/${bid.requestId}`} className="h-10 px-6 bg-primary-100 text-primary-500 rounded-sm font-bold text-sm hover:bg-primary-500 hover:text-white transition-colors flex items-center justify-center whitespace-nowrap lg:whitespace-normal">
                                  {language === 'ar' ? 'عرض الطلب' : 'View Request'}
                                </Link>
                              </div>
                            </motion.div>
                          )})}
                        </div>
                      </div>
                    )}

                    {acceptedBids.length > 0 && (
                      <div className="mb-12">
                        <h3 className="text-xl font-bold text-neutral-700 mb-6 flex items-center gap-2">
                           <div className="w-1.5 h-5 bg-success rounded-full" />
                           {language === 'ar' ? 'العروض المقبولة' : 'Accepted Bids'}
                        </h3>
                        <div className="space-y-4">
                          {acceptedBids.map(bid => {
                            const req = requestsData[bid.requestId];
                            const reqTitle = req ? (language === 'ar' ? req.title : req.titleEn) : bid.requestId;
                            return (
                            <motion.div
                              key={bid.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white border border-success/30 rounded-base p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-primary-500 line-clamp-1">{reqTitle}</h4>
                                  {bid.isReadByVendor === false && (
                                    <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 font-bold rounded-xs uppercase tracking-wider bg-success/10 text-success`}>
                                     {t.accepted}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">
                                     {new Date(bid.createdAt?.seconds * 1000).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="mt-4 bg-success/10 border border-success/30 text-success-800 p-3 rounded-md text-xs font-bold flex flex-col sm:flex-row items-center sm:items-start gap-2 shadow-sm">
                                  <CheckCircle className="w-4 h-4 shrink-0 sm:mt-0.5" />
                                  <p className="text-center sm:text-start leading-relaxed">{language === 'ar' ? 'مبروك العميل قبل عرضك، إنتظر تواصل العميل معك' : 'Congratulations! The client accepted your offer. Please wait for them to contact you.'}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-8">
                                <div className="text-end">
                                  <span className="text-[10px] text-neutral-300 uppercase font-bold block">{language === 'ar' ? 'عرض السعر' : 'Your Bid'}</span>
                                  <span className="text-lg font-bold text-primary-500">{bid.amount} {t.sar}</span>
                                </div>
                                <Link 
                                  to={`/request/${bid.requestId}`} 
                                  onClick={() => markBidAsRead(bid.id, bid.requestId)}
                                  className="h-10 px-6 bg-primary-100 text-primary-500 rounded-sm font-bold text-sm hover:bg-primary-500 hover:text-white transition-colors flex items-center justify-center whitespace-nowrap lg:whitespace-normal"
                                >
                                  {language === 'ar' ? 'عرض الطلب' : 'View Request'}
                                </Link>
                              </div>
                            </motion.div>
                          )})}
                        </div>
                      </div>
                    )}

                    {(rejectedBids.length > 0 || expiredBids.length > 0) && (
                      <div>
                        <h3 className="text-xl font-bold text-neutral-700 mb-6 flex items-center gap-2">
                           <div className="w-1.5 h-5 bg-neutral-400 rounded-full" />
                           {language === 'ar' ? 'عروض لم يحالفها الحظ' : 'Unsuccessful Bids'}
                        </h3>
                        <div className="space-y-4">
                          {[...rejectedBids, ...expiredBids].map(bid => {
                            const req = requestsData[bid.requestId];
                            const reqTitle = req ? (language === 'ar' ? req.title : req.titleEn) : bid.requestId;
                            return (
                            <motion.div
                              key={bid.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-neutral-50 border border-neutral-200 rounded-base p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 grayscale"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-neutral-500 line-clamp-1">{reqTitle}</h4>
                                  {bid.isReadByVendor === false && (
                                    <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 font-bold rounded-xs uppercase tracking-wider ${bid.status === 'rejected' ? 'bg-error/10 text-error' : 'bg-neutral-200 text-neutral-500'}`}>
                                     {bid.status === 'rejected' ? t.rejected : (language === 'ar' ? 'منتهي/مغلق' : 'Expired/Closed')}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">
                                     {new Date(bid.createdAt?.seconds * 1000).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-8">
                                <div className="text-end">
                                  <span className="text-[10px] text-neutral-300 uppercase font-bold block">{language === 'ar' ? 'عرض السعر' : 'Your Bid'}</span>
                                  <span className="text-lg font-bold text-neutral-400">{bid.amount} {t.sar}</span>
                                </div>
                                <Link 
                                  to={`/request/${bid.requestId}`} 
                                  onClick={() => markBidAsRead(bid.id, bid.requestId)}
                                  className="h-10 px-6 bg-neutral-200 text-neutral-500 rounded-sm font-bold text-sm hover:bg-neutral-300 hover:text-neutral-700 transition-colors flex items-center justify-center whitespace-nowrap lg:whitespace-normal"
                                >
                                  {language === 'ar' ? 'عرض الطلب' : 'View Request'}
                                </Link>
                              </div>
                            </motion.div>
                          )})}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        ) : activeTab === 'subscription' ? (
          <motion.div
            key="subscription"
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 10 }}
            className="space-y-8"
          >
            {/* Current Sub Status */}
            <div className={`p-8 rounded-2xl shadow-sm border ${user?.subscription?.status === 'active' || user?.subscription?.status === 'trial' ? 'bg-success/5 border-success/30' : 'bg-neutral-50 border-neutral-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    {(user?.subscription?.status === 'active' || user?.subscription?.status === 'trial') ? <CheckCircle className="text-success" /> : <AlertTriangle className="text-warning" />}
                    {language === 'ar' ? 'حالة الاشتراك الحالي:' : 'Current Subscription Status:'} 
                    <span className={(user?.subscription?.status === 'active' || user?.subscription?.status === 'trial') ? 'text-success uppercase' : 'text-warning uppercase'}>
                      {user?.subscription?.status === 'trial' && (language === 'ar' ? 'فترة تجريبية' : 'Trial')}
                      {user?.subscription?.status === 'active' && (language === 'ar' ? 'نشط' : 'Active')}
                      {user?.subscription?.status === 'expired' && (language === 'ar' ? 'منتهي' : 'Expired')}
                      {user?.subscription?.status === 'pending_approval' && (language === 'ar' ? 'بانتظار الموافقة' : 'Pending Approval')}
                      {user?.subscription?.status === 'pending_transfer' && (language === 'ar' ? 'بانتظار المراجعة' : 'Pending Review')}
                      {!['trial', 'active', 'expired', 'pending_approval', 'pending_transfer'].includes(user?.subscription?.status || '') && (user?.subscription?.status || 'None')}
                    </span>
                  </h3>
                  {(user?.subscription?.status === 'active' || user?.subscription?.status === 'trial') && user.subscription.endsAt && (
                    <div className="flex flex-col items-center gap-1 mt-4">
                      <p className="text-neutral-600 font-medium text-lg">
                        {language === 'ar' ? 'تاريخ الإنتهاء:' : 'Ends At:'} <span className="font-bold text-neutral-900">{new Date(user.subscription.endsAt).toLocaleDateString()}</span>
                      </p>
                      <p className="text-sm font-bold bg-success/10 text-success px-4 py-1.5 rounded-full mt-2">
                        {language === 'ar' ? 'المدة المتبقية:' : 'Time Left:'} {Math.max(0, Math.ceil((user.subscription.endsAt - now) / (1000 * 60 * 60 * 24)))} {language === 'ar' ? 'أيام' : 'days'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

              <div className="space-y-8 mt-8 border-t border-neutral-200 pt-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-neutral-900 mb-2">
                    {language === 'ar' ? 'باقات الاشتراك' : 'Subscription Packages'}
                  </h2>
                  <p className="text-neutral-500 font-medium">
                    {language === 'ar' ? 'للاشتراك، يرجى أولاً تحويل المبلغ المطلوب إلى أحد حساباتنا البنكية ثم اختيار الباقة وإرفاق الإيصال.' : 'To subscribe, please first transfer the amount to one of our bank accounts, then select a package and upload the receipt.'}
                  </p>
                </div>

                {/* Step 1: Bank Accounts */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm">1</span>
                    {language === 'ar' ? 'الحسابات البنكية' : 'Bank Accounts'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {config.bankAccounts?.map((bank, i) => (
                      <div key={bank.id || `bank-${i}`} className="p-5 bg-white border border-neutral-200 rounded-sm shadow-sm relative group overflow-hidden">
                        <h4 className="font-black text-lg text-neutral-800 mb-3 border-b border-neutral-100 pb-2 bg-neutral-50 px-3 py-1 rounded-sm">{language === 'ar' ? bank.bankNameAr : bank.bankNameEn}</h4>
                        <div className="space-y-2 text-sm font-mono text-neutral-700 font-bold bg-neutral-50 p-3 rounded-sm border border-neutral-100">
                          <div className="flex justify-between items-center sm:hidden font-sans text-xs uppercase tracking-widest text-neutral-400 font-black mb-1">Account Info</div>
                          <div className="flex justify-between items-center p-1 rounded-sm hover:bg-neutral-100 transition-colors group/row">
                             <span className="text-neutral-500 uppercase tracking-widest text-[10px] font-black shrink-0">Acc Name</span>
                             <span className="text-neutral-900 break-all text-right">{bank.accountName}</span>
                          </div>
                          <div className="flex justify-between items-center p-1 rounded-sm hover:bg-neutral-100 transition-colors group/row relative">
                             <span className="text-neutral-500 uppercase tracking-widest text-[10px] font-black shrink-0">Acc Number</span>
                             <span className="text-neutral-900 break-all pl-6 pr-8 text-right">{bank.accountNumber}</span>
                             <button onClick={() => handleCopy(bank.accountNumber)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-primary-500 opacity-0 group-hover/row:opacity-100 transition-all rounded-sm hover:bg-white border border-transparent hover:border-neutral-200 bg-white">
                               <Copy className="w-3.5 h-3.5" />
                             </button>
                          </div>
                          <div className="flex justify-between items-center p-1 rounded-sm hover:bg-neutral-100 transition-colors group/row relative">
                             <span className="text-neutral-500 uppercase tracking-widest text-[10px] font-black shrink-0">IBAN</span>
                             <span className="text-neutral-900 break-all pl-6 pr-8 text-right">{bank.iban}</span>
                             <button onClick={() => handleCopy(bank.iban)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-primary-500 opacity-0 group-hover/row:opacity-100 transition-all rounded-sm hover:bg-white border border-transparent hover:border-neutral-200 bg-white">
                               <Copy className="w-3.5 h-3.5" />
                             </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2: Packages & Receipt */}
                <div className="space-y-4 pt-4 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm">2</span>
                    {t.packages || 'Packages'} &amp; {language === 'ar' ? 'الإيصال' : 'Receipt'}
                  </h3>
                  
                  {subSuccess && (
                    <div className="p-4 bg-success/10 border border-success/20 rounded-sm text-success font-bold flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      {language === 'ar' ? 'تم إرسال طلب الاشتراك بنجاح! جاري المراجعة.' : 'Subscription request sent successfully! Pending review.'}
                    </div>
                  )}
                  
                  {user?.subscriptionRequest && (
                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-sm text-warning-700 font-bold flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {language === 'ar' ? 'لديك طلب اشتراك قيد المراجعة الرجاء الانتظار.' : 'You have a subscription request pending review.'}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(!user?.subscriptionRequest) && config.subscriptionPackages?.map((pkg, i) => (
                      <div key={pkg.id || `pkg-${i}`} className={`p-6 bg-white border ${selectedSubPackageId === pkg.id ? 'border-primary-500 shadow-md ring-1 ring-primary-500' : 'border-neutral-200'} rounded-sm shadow-sm relative overflow-hidden group hover:border-primary-500 transition-colors`}>
                        <div className="absolute top-0 right-0 p-4">
                          <span className="text-sm font-black text-primary-500 border border-primary-500 px-3 py-1 rounded-full bg-primary-50">{pkg.price} {t.sar}</span>
                        </div>
                        <h4 className="font-black text-xl text-neutral-800 mb-1">{language === 'ar' ? pkg.nameAr : pkg.nameEn}</h4>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">{language === 'ar' ? `لمدة ${pkg.durationMonths} شهر` : `${pkg.durationMonths} Months Duration`}</p>
                        <ul className="text-sm text-neutral-600 space-y-2 mb-6">
                          {(language === 'ar' ? pkg.featuresAr : pkg.featuresEn)?.split('\n').map((f, i) => (
                            <li key={i} className="flex items-center gap-2 font-medium">
                              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>
                        
                        {selectedSubPackageId === pkg.id ? (
                          <div className="mt-4 pt-4 border-t border-primary-100 bg-primary-50/50 p-4 rounded-sm animate-in fade-in slide-in-from-top-4 duration-300">
                            <p className="text-sm font-bold text-neutral-800 mb-2">
                              {language === 'ar' ? 'إرفاق إيصال التحويل' : 'Upload Transfer Receipt'}
                            </p>
                            <ImageUpload 
                              currentImage={subReceipt}
                              onUploadComplete={setSubReceipt}
                              label={language === 'ar' ? 'صورة الإيصال' : 'Receipt Image'}
                              uploadMode="local"
                            />
                            <div className="flex gap-2 mt-4">
                              <button 
                                disabled={!subReceipt || isSubscribing}
                                onClick={handleConfirmSubscription}
                                className="flex-1 py-2 bg-primary-500 text-white font-bold text-sm uppercase tracking-widest rounded-sm hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {isSubscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {language === 'ar' ? 'تأكيد' : 'Confirm'}
                              </button>
                              <button 
                                onClick={() => { setSelectedSubPackageId(null); setSubReceipt(''); }}
                                className="px-4 py-2 bg-neutral-200 text-neutral-700 font-bold text-sm uppercase tracking-widest rounded-sm hover:bg-neutral-300 transition-colors"
                              >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            disabled={user?.subscription?.status === 'active' || user?.subscription?.status === 'trial'}
                            onClick={() => setSelectedSubPackageId(pkg.id)}
                            className="w-full py-3 bg-neutral-900 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-widest rounded-sm hover:bg-neutral-800 transition-colors"
                          >
                            {(user?.subscription?.status === 'active' || user?.subscription?.status === 'trial') 
                               ? (language === 'ar' ? 'لديك اشتراك فعال' : 'Active Subscription Exists') 
                               : t.subscribe || 'Subscribe'}
                          </button>
                        )}
                      </div>
                    ))}
                    {!config.subscriptionPackages?.length && (
                      <p className="text-neutral-500 font-bold p-4 bg-white border border-neutral-200 md:col-span-2">No packages available.</p>
                    )}
                  </div>
                </div>
              </div>
          </motion.div>
        ) : (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: 10 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Profile Settings */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white border border-neutral-200/60 rounded-2xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-neutral-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-5 h-5 text-primary-500" />
                  {t.editProfile}
                </h3>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  {/* Photo Profile */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-neutral-100">
                    <ImageUpload 
                      currentImage={newPhoto}
                      onUploadComplete={(url) => setNewPhoto(url)}
                      label={t.profilePhoto}
                    />
                  </div>

                  {/* Name Change */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.changeName}</label>
                      <input 
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full h-10 px-4 bg-neutral-50 border border-neutral-300 rounded-sm text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2 opacity-60">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.phone} ({language === 'ar' ? 'غير قابل للتعديل' : 'Disabled'})</label>
                      <input 
                        type="text" 
                        value={user?.phone}
                        disabled
                        className="w-full h-10 px-4 bg-neutral-100 border border-neutral-300 rounded-sm text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-neutral-100">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <label className="text-xs font-bold text-neutral-800 uppercase tracking-widest block">{language === 'ar' ? 'تخصصاتي' : 'My Categories'}</label>
                        <p className="text-[10px] text-neutral-500 font-bold mt-1">
                          {language === 'ar' ? 'يمكنك اختيار حتى 3 تخصصات كحد أقصى.' : 'You can select up to 3 categories.'}
                          {user?.subscription?.status !== 'active' && (
                            <span className="text-warning block">
                                {language === 'ar' ? 'يجب الاشتراك بباقة مدفوعة لتفعيل التعديل.' : 'Active subscription required to edit.'}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="bg-primary-50 text-primary-600 font-bold text-[10px] px-2 py-1 rounded-sm">
                        {newCategories.length} / 3
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {EVENT_TYPES.map(type => {
                        const isSelected = newCategories.includes(type);
                        const canEdit = user?.subscription?.status === 'active';
                        return (
                          <div 
                            key={type}
                            onClick={() => {
                              if (!canEdit) return;
                              setNewCategories(prev => {
                                if (prev.includes(type)) return prev.filter(c => c !== type);
                                if (prev.length >= 3) return prev;
                                return [...prev, type];
                              });
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all border",
                              !canEdit ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                              isSelected ? "bg-primary-50 border-primary-500 text-primary-600" : "bg-white border-neutral-200 text-neutral-400 hover:border-primary-200"
                            )}
                          >
                            {t[type as keyof typeof t] || type}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-neutral-100">
                    <PortfolioManager 
                      images={newPortfolio}
                      onChange={setNewPortfolio}
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button 
                      type="submit"
                      disabled={isUpdating}
                      className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xs text-xs font-bold uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {t.saveChanges}
                    </button>
                    {updateSuccess && (
                      <motion.span 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className="text-success text-xs font-bold uppercase italic"
                      >
                        ✓ {t.successUpdate}
                      </motion.span>
                    )}
                  </div>
                </form>
              </div>

              {/* Danger Zone */}
              <div className="bg-white border border-error/30 rounded-2xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-error mb-6 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t.dangerZone}
                </h3>
                
                <div className="p-4 bg-error/5 border border-error/10 rounded-sm mb-6">
                  <p className="text-sm text-error/80 leading-relaxed font-medium">
                    {t.deleteAccountWarning}
                  </p>
                </div>

                {!showDeleteConfirm ? (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="border-2 border-error text-error hover:bg-error hover:text-white px-6 py-2.5 rounded-xs text-xs font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.deleteAccount}
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                      onClick={handleDeleteAccount}
                      className="w-full sm:w-auto bg-error text-white px-8 py-3 rounded-xs text-xs font-bold uppercase tracking-widest shadow-lg shadow-error/20 transition-all hover:bg-error-dark active:scale-95"
                    >
                      {t.confirmDelete}
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(false)}
                      className="w-full sm:w-auto text-neutral-500 font-bold uppercase text-xs hover:underline"
                    >
                      {t.cancel}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <div className="bg-primary-500 rounded-2xl p-6 text-white shadow-lg">
                <h4 className="font-bold uppercase tracking-widest text-[10px] mb-4 opacity-80">{language === 'ar' ? 'بيانات المورد' : 'Vendor Stats'}</h4>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] uppercase opacity-70 block">{t.fullName}</span>
                    <span className="text-sm font-bold">{user?.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase opacity-70 block">{t.phone}</span>
                    <span className="text-sm font-bold" dir="ltr">{user?.phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase opacity-70 block">{language === 'ar' ? 'نوع النشاط' : 'Business Type'}</span>
                    <span className="inline-block px-2 py-0.5 bg-white/20 rounded-xs text-[10px] font-bold uppercase mt-1">
                       {user?.type === 'vendor' ? t.vendor : t.client}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-neutral-200/60 rounded-2xl p-6 shadow-sm">
                <p className="text-[11px] text-neutral-500 leading-relaxed italic">
                  {language === 'ar' 
                    ? 'نحن نقدر خصوصيتك. معلوماتك الأساسية مثل رقم الهاتف لا يمكن تغييرها لضمان مصداقية التعاملات في المنصة.' 
                    : 'We value your privacy. Essential information like phone number cannot be changed to ensure transaction credibility on the platform.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
