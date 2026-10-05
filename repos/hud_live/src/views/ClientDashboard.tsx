import { useEffect, useState, FormEvent } from 'react';
import { useLanguageStore } from '../store/useLanguageStore';
import { translations } from '../lib/translations';
import { useAuthStore } from '../store/useAuthStore';
import { useAppConfig } from '../store/useAppConfig';
import { Request } from '../types';
import RequestCard from '../components/feed/RequestCard';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, List, Package, CheckCircle, Loader2, Settings, User, Trash2, Camera, AlertTriangle, Save } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import ImageUpload from '../components/ImageUpload';
import { signOut, deleteUser } from 'firebase/auth';
import { useLocation } from 'react-router-dom';

type Tab = 'overview' | 'settings';

export default function ClientDashboard() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const { user, setUser } = useAuthStore();
  const { config } = useAppConfig();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam === 'settings' ? 'settings' : 'overview');

  useEffect(() => {
    if (tabParam === 'settings') setActiveTab('settings');
    else setActiveTab('overview');
  }, [tabParam]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Settings State
  const [newName, setNewName] = useState(user?.name || '');
  const [newPhoto, setNewPhoto] = useState(user?.photoURL || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, 'requests'),
      where('clientId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
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

        return {
          id: doc.id,
          ...data,
          expiresAt
        } as Request;
      });
      setRequests(docs);
      setIsLoading(false);
    }, (error) => {
      console.error("Client Requests Fetch Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        fullName: newName,
        photoURL: newPhoto
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
      // 1. Delete Firestore Data (Simple version for this demo)
      await deleteDoc(doc(db, 'users', user.id));
      
      // 2. Sign Out & potentially delete from Auth (requires recent login usually)
      await signOut(auth);
      // Note: deleteUser(auth.currentUser!) might fail if login is stale
      window.location.href = '/';
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const now = Date.now();
  const liveRequests = requests.filter(r => r.status === 'live' && Math.max(0, r.expiresAt - now) > 0);
  const completedRequests = requests.filter(r => r.status === 'completed' || r.status === 'confirmed');
  const expiredRequests = requests.filter(r => (r.status === 'live' || r.status === 'expired') && Math.max(0, r.expiresAt - now) === 0);

  const stats = [
    { label: language === 'ar' ? 'الطلبات النشطة' : 'Active Requests', value: liveRequests.length, icon: <Package className="w-5 h-5 text-success" /> },
    { label: language === 'ar' ? 'المكتملة' : 'Completed', value: completedRequests.length, icon: <CheckCircle className="w-5 h-5 text-primary-500" /> },
    { label: language === 'ar' ? 'المنتهية' : 'Expired', value: expiredRequests.length, icon: <Trash2 className="w-5 h-5 text-neutral-400" /> },
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
                      <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 mt-1">
                         <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                         {language === 'ar' ? 'عميل نشط' : 'Active Client'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pb-2 sm:pb-4 w-full md:w-auto flex justify-center md:justify-end">
                    <div className="flex p-1.5 bg-neutral-100/80 backdrop-blur-sm rounded-xl shadow-inner border border-neutral-200 w-full sm:w-auto">
                      <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 md:flex-none ${activeTab === 'overview' ? 'bg-white text-primary-600 shadow-sm ring-1 ring-neutral-200/50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50/50'}`}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        {language === 'ar' ? 'نظرة عامة' : 'Overview'}
                      </button>
                      <button 
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-1 md:flex-none ${activeTab === 'settings' ? 'bg-white text-primary-600 shadow-sm ring-1 ring-neutral-200/50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50/50'}`}
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
                        i === 0 ? 'bg-success/10 text-success' : i === 1 ? 'bg-primary-50 text-primary-500' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {stat.icon}
                      </div>
                      <span className="text-4xl font-black text-neutral-900 mb-1">{stat.value}</span>
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="mb-12">
                  <h3 className="text-xl font-bold text-neutral-700 mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-primary-500 rounded-full" />
                    {language === 'ar' ? 'الطلبات النشطة' : 'Active Requests'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveRequests.map(request => (
                      <RequestCard key={request.id} request={request} />
                    ))}
                    {liveRequests.length === 0 && (
                      <div className="col-span-full py-12 text-center bg-white rounded-base border border-dashed border-neutral-300">
                         <p className="text-neutral-400">{language === 'ar' ? 'لا توجد طلبات نشطة حالياً.' : 'No active requests at the moment.'}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-12">
                  <h3 className="text-xl font-bold text-neutral-700 mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-success rounded-full" />
                    {language === 'ar' ? 'الطلبات المكتملة' : 'Completed Requests'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {completedRequests.map(request => (
                      <RequestCard key={request.id} request={request} />
                    ))}
                    {completedRequests.length === 0 && (
                      <div className="col-span-full py-12 text-center bg-white rounded-base border border-dashed border-neutral-300">
                         <p className="text-neutral-400">{language === 'ar' ? 'لا توجد طلبات مكتملة بعد.' : 'No completed requests yet.'}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-neutral-700 mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-neutral-300 rounded-full" />
                    {language === 'ar' ? 'الطلبات المنتهية' : 'Expired Requests'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {expiredRequests.map(request => (
                      <RequestCard key={request.id} request={request} />
                    ))}
                    {expiredRequests.length === 0 && (
                      <div className="col-span-full py-12 text-center bg-white rounded-base border border-dashed border-neutral-300">
                         <p className="text-neutral-400">{language === 'ar' ? 'لا توجد طلبات منتهية.' : 'No expired requests.'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
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
              <section className="bg-white border border-neutral-200/60 rounded-2xl p-8 shadow-sm">
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
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">{t.phone} (Disabled)</label>
                      <input 
                        type="text" 
                        value={user?.phone}
                        disabled
                        className="w-full h-10 px-4 bg-neutral-100 border border-neutral-300 rounded-sm text-sm cursor-not-allowed"
                      />
                    </div>
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
              </section>

              {/* Danger Zone */}
              <section className="bg-white border border-error/30 rounded-2xl p-8 shadow-sm">
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
              </section>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <div className="bg-primary-500 rounded-2xl p-6 text-white shadow-lg">
                <h4 className="font-bold uppercase tracking-widest text-[10px] mb-4 opacity-80">{language === 'ar' ? 'معلومات الحساب' : 'Account Info'}</h4>
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
                    <span className="text-[10px] uppercase opacity-70 block">{language === 'ar' ? 'نوع الحساب' : 'Account Type'}</span>
                    <span className="inline-block px-2 py-0.5 bg-white/20 rounded-xs text-[10px] font-bold uppercase mt-1">
                      {user?.type === 'client' ? t.client : t.vendor}
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
