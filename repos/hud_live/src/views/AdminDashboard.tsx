import React, { useState, useEffect, useMemo } from 'react';
import { useLanguageStore } from '../store/useLanguageStore';
import { translations } from '../lib/translations';
import { useAuthStore, UserProfile } from '../store/useAuthStore';
import { useAppConfig } from '../store/useAppConfig';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Users, Store, Settings, AlertTriangle, Ticket, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

type Tab = 'overview' | 'vendors' | 'clients' | 'reports' | 'requestsTab' | 'settings';

export default function AdminDashboard() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const { user, logout } = useAuthStore();
  const { config } = useAppConfig();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [vendors, setVendors] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [allRequests, setAllRequests] = useState<any[]>([]);

  const [requestFilter, setRequestFilter] = useState<'all' | 'live' | 'completed' | 'expired'>('all');

  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [promptDialog, setPromptDialog] = useState<{isOpen: boolean, message: string, value: string, onConfirm: (val: string) => void} | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          name: data.fullName || data.name || '',
          type: data.role || data.type || null
        } as UserProfile;
      });
      setVendors(allUsers.filter(u => u.type === 'vendor'));
      setClients(allUsers.filter(u => u.type === 'client'));
    });

    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRequests = onSnapshot(collection(db, 'requests'), (snap) => {
      setAllRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubUsers();
      unsubReports();
      unsubRequests();
    };
  }, []);

  const isViewer = user?.type === 'viewer';

  const handleActivateSubscription = async (vendor: UserProfile) => {
    if (isViewer) return alert(language === 'ar' ? 'غير مسموح في وضع العرض' : 'Action restricted for viewer role.');
    let monthsToAdd = 1;
    let pkgDetails = '';
    
    if (vendor.subscriptionRequest?.packageId) {
       const pkg = config.subscriptionPackages?.find((p: any) => p.id === vendor.subscriptionRequest?.packageId);
       if (pkg) {
         monthsToAdd = pkg.durationMonths;
         pkgDetails = language === 'ar' ? ` - باقة ${pkg.nameAr}` : ` - ${pkg.nameEn} Package`;
       }
    }

    setConfirmDialog({
      isOpen: true,
      message: language === 'ar' ? `هل أنت متأكد من تفعيل الاشتراك لمدة ${monthsToAdd} شهر؟${pkgDetails}` : `Are you sure you want to activate subscription for ${monthsToAdd} month(s)?${pkgDetails}`,
      onConfirm: async () => {
        const msToAdd = monthsToAdd * 30 * 24 * 60 * 60 * 1000;
        const currentEndsAt = vendor.subscription?.endsAt;
        const newEndsAt = (currentEndsAt && currentEndsAt > Date.now()) ? currentEndsAt + msToAdd : Date.now() + msToAdd;
        try {
          await updateDoc(doc(db, 'users', vendor.id), {
            'isVerified': true,
            'subscription.status': 'active',
            'subscription.endsAt': newEndsAt,
            'subscriptionRequest': null
          });
        } catch(err) { console.error(err); }
      }
    });
  };

  const handleApproveVendor = async (vendorId: string) => {
    if (isViewer) return alert(language === 'ar' ? 'غير مسموح في وضع العرض' : 'Action restricted for viewer role.');
    setConfirmDialog({
      isOpen: true,
      message: language === 'ar' ? 'هل أنت متأكد من قبول المزود وبدء الفترة التجريبية (شهر واحد)؟' : 'Are you sure you want to approve this vendor and start their 1-month free trial?',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', vendorId), {
            isVerified: true,
            'subscription.status': 'trial',
            'subscription.endsAt': Date.now() + 30 * 24 * 60 * 60 * 1000
          });
        } catch (err) { console.error(err); }
      }
    });
  };

  const handleRejectSubscription = async (vendorId: string) => {
    if (isViewer) return alert(language === 'ar' ? 'غير مسموح في وضع العرض' : 'Action restricted for viewer role.');
    setConfirmDialog({
      isOpen: true,
      message: language === 'ar' ? 'هل أنت متأكد من رفض طلب الاشتراك وحذف الإيصال؟' : 'Are you sure you want to reject the subscription request and delete the receipt?',
      onConfirm: async () => {
        try { await updateDoc(doc(db, 'users', vendorId), { 'subscriptionRequest': null }); } catch(err) { console.error(err); }
      }
    });
  };

  const handleDeactivateSubscription = async (vendorId: string) => {
    if (isViewer) return alert(language === 'ar' ? 'غير مسموح في وضع العرض' : 'Action restricted for viewer role.');
    setConfirmDialog({
      isOpen: true,
      message: language === 'ar' ? 'هل أنت متأكد من إيقاف الاشتراك؟ (سيتم تصفير المدة المتبقية)' : 'Are you sure you want to deactivate subscription? (Remaining time will be reset)',
      onConfirm: async () => {
        try { await updateDoc(doc(db, 'users', vendorId), { 'subscription.status': 'expired', 'subscription.endsAt': Date.now() }); } catch(err) { console.error(err); }
      }
    });
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    if (isViewer) return alert(language === 'ar' ? 'غير مسموح في وضع العرض' : 'Action restricted for viewer role.');
    setConfirmDialog({
      isOpen: true,
      message: language === 'ar' ? `هل أنت متأكد من ${isBanned ? 'حظر' : 'رفع الحظر عن'} هذا المستخدم؟` : `Are you sure you want to ${isBanned ? 'ban' : 'unban'} this user?`,
      onConfirm: async () => {
        try { await updateDoc(doc(db, 'users', userId), { isBanned }); } catch(err) { console.error(err); }
      }
    });
  };

  const handleDeleteReport = async (reportId: string) => {
    if (isViewer) return alert(language === 'ar' ? 'غير مسموح في وضع العرض' : 'Action restricted for viewer role.');
    setConfirmDialog({
      isOpen: true,
      message: language === 'ar' ? 'هل متأكد من مسح البلاغ؟' : 'Are you sure you want to dismiss the report?',
      onConfirm: async () => {
        try { await deleteDoc(doc(db, 'reports', reportId)); } catch(err) { console.error(err); }
      }
    });
  };

  const handleDeleteAdminRequest = async (reqId: string) => {
    if (isViewer) return alert(language === 'ar' ? 'غير مسموح في وضع العرض' : 'Action restricted for viewer role.');
    setConfirmDialog({
      isOpen: true,
      message: language === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟' : 'Are you sure you want to delete this request?',
      onConfirm: async () => {
        try { await deleteDoc(doc(db, 'requests', reqId)); } catch(err) { console.error(err); }
      }
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    logout();
  };

  // Optimization: Memoize the filtered requests array so we don't recalculate thousands of elements on unrelated renders
  const filteredRequests = useMemo(() => {
    return allRequests
      .filter(req => {
        const isExpired = Date.now() - req.createdAt > (config.requestLifespanMinutes || 18) * 60 * 1000;
        if (requestFilter === 'all') return true;
        if (requestFilter === 'completed') return req.status === 'completed';
        if (requestFilter === 'expired') return isExpired && req.status !== 'completed';
        if (requestFilter === 'live') return !isExpired && req.status !== 'completed';
        return true;
      })
      .sort((a,b) => b.createdAt - a.createdAt);
  }, [allRequests, requestFilter, config.requestLifespanMinutes]);

  const tabs = [
    { id: 'overview', label: language === 'ar' ? 'اللوحة الرئيسية' : 'Overview', icon: Shield },
    { id: 'vendors', label: language === 'ar' ? 'المزودين والاشتراكات' : 'Vendors & Subs', icon: Store },
    { id: 'clients', label: language === 'ar' ? 'العملاء' : 'Clients', icon: Users },
    { id: 'reports', label: language === 'ar' ? 'البلاغات' : 'Reports', icon: AlertTriangle },
    { id: 'requestsTab', label: language === 'ar' ? 'الطلبات' : 'Requests', icon: Ticket },
    { id: 'settings', label: language === 'ar' ? 'الإعدادات' : 'Settings', icon: Settings },
  ] as const;

  if (!user || (user.type !== 'admin' && user.type !== 'viewer' && user.type !== 'editor')) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-32 md:pb-12">
      <div className="flex items-center justify-between xl:mb-12 mb-8 bg-neutral-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Shield className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shrink-0">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black">{language === 'ar' ? 'لوحة تحكم الإدارة' : 'Admin Dashboard'}</h1>
            <p className="text-neutral-400 font-medium text-sm mt-1">{language === 'ar' ? 'تحكم كامل بالمنصة' : 'Full Platform Control'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="relative z-10 p-4 sm:px-6 sm:py-3 text-sm font-bold text-white hover:text-error hover:bg-white/10 rounded-xl transition-all flex items-center gap-2 border border-white/10 backdrop-blur-md">
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">{language === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
        </button>
      </div>

      <div className="flex gap-3 mb-8 overflow-x-auto pb-4 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all rounded-xl whitespace-nowrap ${
              activeTab === t.id ? 'bg-primary-500 text-white shadow-md ring-1 ring-primary-500/50' : 'bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:border-neutral-300 shadow-sm'
            }`}
          >
            <t.icon className="w-4 h-4 shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-2xl border border-neutral-200/60 shadow-sm flex flex-col items-start relative overflow-hidden group hover:shadow-md transition-all">
                <Store className="w-10 h-10 text-primary-500 mb-6" />
                <h3 className="text-4xl font-black text-neutral-900 mb-1">{vendors.length}</h3>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{language === 'ar' ? 'المزودين' : 'Vendors'}</p>
              </div>
              <div className="bg-white p-8 rounded-2xl border border-neutral-200/60 shadow-sm flex flex-col items-start relative overflow-hidden group hover:shadow-md transition-all">
                <Users className="w-10 h-10 text-primary-500 mb-6" />
                <h3 className="text-4xl font-black text-neutral-900 mb-1">{clients.length}</h3>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{language === 'ar' ? 'العملاء' : 'Clients'}</p>
              </div>
              <div className="bg-white p-8 rounded-2xl border border-neutral-200/60 shadow-sm flex flex-col items-start relative overflow-hidden group hover:shadow-md transition-all">
                <Ticket className="w-10 h-10 text-primary-500 mb-6" />
                <h3 className="text-4xl font-black text-neutral-900 mb-1">{allRequests.length}</h3>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{language === 'ar' ? 'الطلبات الكلية' : 'Total Requests'}</p>
              </div>
              <div className="bg-white p-8 rounded-2xl border border-error/20 shadow-sm flex flex-col items-start relative overflow-hidden group hover:shadow-md transition-all">
                <AlertTriangle className="w-10 h-10 text-error mb-6" />
                <h3 className="text-4xl font-black text-error mb-1">{reports.length}</h3>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{language === 'ar' ? 'بلاغات نشطة' : 'Active Reports'}</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'vendors' && (
             <motion.div key="vendors" className="space-y-6">
                <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-6 overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase text-xs">
                          <th className="pb-3 px-2">Name / CR</th>
                          <th className="pb-3 px-2">Contact</th>
                          <th className="pb-3 px-2">Status</th>
                          <th className="pb-3 px-2">Subscription Ends</th>
                          <th className="pb-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {vendors.map(v => (
                          <tr key={v.id} className="border-b border-neutral-100 font-medium">
                            <td className="py-4 px-2">
                              <div>{v.name}</div><div className="text-xs text-neutral-400">CR: {v.crNumber}</div>
                            </td>
                            <td className="py-4 px-2 text-neutral-600">
                              <div>{v.phone}</div>{v.email && <div className="text-xs">{v.email}</div>}
                            </td>
                            <td className="py-4 px-2">
                              {v.subscription ? (
                                <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase ${v.subscription.status === 'active' ? 'bg-success/10 text-success' : v.subscription.status === 'trial' ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'}`}>
                                  {v.subscription.status}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-4 px-2 text-neutral-600">
                              {v.subscription?.endsAt ? new Date(v.subscription.endsAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-4 px-2">
                               <div className="flex flex-col gap-2">
                                 {v.subscriptionRequest && (
                                   <div className="p-2 bg-primary-50 border border-primary-100 rounded-sm mb-2 text-xs">
                                     <div className="font-bold text-primary-700 mb-1 flex items-center justify-between">
                                       <span>{language === 'ar' ? 'طلب اشتراك جديد' : 'New Sub Request'}</span>
                                       {config.subscriptionPackages?.find((p: any) => p.id === v.subscriptionRequest?.packageId)?.price} {t.sar}
                                     </div>
                                     <div className="flex gap-2">
                                       {v.subscriptionRequest.receiptBase64 && (
                                         <button onClick={() => setReceiptPreview(v.subscriptionRequest?.receiptBase64 || null)} className="px-2 py-1 bg-white border border-primary-200 text-primary-600 rounded flex-1 hover:bg-primary-50 font-bold">
                                           {language === 'ar' ? 'عرض الإيصال' : 'View'}
                                         </button>
                                       )}
                                       <button onClick={() => handleActivateSubscription(v)} className="px-2 py-1 bg-success text-white rounded flex-1 hover:bg-success/90 font-bold">
                                         {language === 'ar' ? 'قبول' : 'Accept'}
                                       </button>
                                       <button onClick={() => handleRejectSubscription(v.id)} className="px-2 py-1 bg-error text-white rounded flex-1 hover:bg-error/90 font-bold">
                                         {language === 'ar' ? 'رفض' : 'Reject'}
                                       </button>
                                     </div>
                                   </div>
                                 )}
                                 <div className="flex flex-wrap gap-2">
                                   {!v.isVerified ? (
                                     <button onClick={() => handleApproveVendor(v.id)} className="px-3 py-1.5 bg-success text-white rounded-sm hover:bg-success/90 font-bold text-xs whitespace-nowrap">
                                       {language === 'ar' ? 'قبول وبدء التجربة' : 'Start Trial'}
                                     </button>
                                   ) : (
                                     <>
                                       <button onClick={() => handleActivateSubscription(v)} className="px-3 py-1.5 bg-success/10 text-success rounded-sm hover:bg-success/20 font-bold text-xs whitespace-nowrap">
                                         {language === 'ar' ? 'تفعيل' : 'Activate'}
                                       </button>
                                       <button onClick={() => handleDeactivateSubscription(v.id)} className="px-3 py-1.5 bg-warning/10 text-warning rounded-sm hover:bg-warning/20 font-bold text-xs whitespace-nowrap">
                                         {language === 'ar' ? 'إيقاف' : 'Deactivate'}
                                       </button>
                                     </>
                                   )}
                                   <button onClick={() => handleBanUser(v.id, !v.isBanned)} className={`px-3 py-1.5 rounded-sm font-bold text-xs whitespace-nowrap ${v.isBanned ? 'bg-neutral-800 text-white' : 'bg-error/10 text-error hover:bg-error/20'}`}>
                                     {v.isBanned ? (language === 'ar' ? 'رفع الحظر' : 'Unban') : (language === 'ar' ? 'حظر' : 'Ban')}
                                   </button>
                                 </div>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </motion.div>
          )}

          {activeTab === 'clients' && (
            <motion.div key="clients" className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-6 overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase text-xs">
                      <th className="pb-3 px-2">Name</th>
                      <th className="pb-3 px-2">Contact</th>
                      <th className="pb-3 px-2">City</th>
                      <th className="pb-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {clients.map(c => (
                      <tr key={c.id} className="border-b border-neutral-100 font-medium">
                        <td className="py-4 px-2">{c.name}</td>
                        <td className="py-4 px-2 text-neutral-600"><div>{c.phone}</div>{c.email && <div className="text-xs">{c.email}</div>}</td>
                        <td className="py-4 px-2 text-neutral-600">{c.city}</td>
                        <td className="py-4 px-2">
                          <button onClick={() => handleBanUser(c.id, !c.isBanned)} className={`px-3 py-1.5 rounded-sm font-bold text-xs ${c.isBanned ? 'bg-success text-white' : 'bg-error/10 text-error hover:bg-error/20'}`}>
                             {c.isBanned ? 'Unban' : 'Ban'}
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </motion.div>
          )}

          {activeTab === 'reports' && (
             <motion.div key="reports" className="space-y-4">
               {reports.length === 0 ? (
                 <div className="text-center p-12 bg-white rounded-base border border-neutral-200 text-neutral-400 font-bold uppercase">No active reports.</div>
               ) : reports.map(r => (
                 <div key={r.id} className="bg-white p-6 rounded-2xl border border-neutral-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div>
                     <p className="text-sm font-bold text-neutral-800 mb-1">Reason: <span className="font-normal text-neutral-600">{r.reason}</span></p>
                     <p className="text-xs text-neutral-500">Reporter ID: {r.reporterId} <br/> Vendor ID: {r.reportedVendorId}</p>
                   </div>
                   <div className="flex items-center gap-2">
                     <button onClick={() => handleDeleteReport(r.id)} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-sm font-bold text-xs">Dismiss</button>
                     <button onClick={() => handleBanUser(r.reportedVendorId, true)} className="px-4 py-2 bg-error text-white hover:bg-error/90 rounded-sm font-bold text-xs">Ban Vendor</button>
                   </div>
                 </div>
               ))}
             </motion.div>
          )}

          {activeTab === 'requestsTab' && (
             <motion.div key="requestsTab" className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-6 overflow-x-auto space-y-4">
               <div className="flex gap-2 border-b border-neutral-100 pb-4 mb-4">
                 {(['all', 'live', 'completed', 'expired'] as const).map(f => (
                   <button key={f} onClick={() => setRequestFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${requestFilter === f ? 'bg-primary-500 text-white shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                     {f}
                   </button>
                 ))}
               </div>
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase text-xs">
                     <th className="pb-3 px-2">Type</th><th className="pb-3 px-2">Status</th><th className="pb-3 px-2">Client ID</th><th className="pb-3 px-2">City</th><th className="pb-3 px-2">Created At</th><th className="pb-3 px-2">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm">
                   {filteredRequests.map(req => {
                         const isExpired = Date.now() - req.createdAt > (config.requestLifespanMinutes || 18) * 60 * 1000;
                         let statusBadge = req.status === 'completed' ? <span className="px-2 py-1 bg-success/10 text-success rounded-sm text-[10px] font-bold uppercase">Completed</span> : isExpired ? <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded-sm text-[10px] font-bold uppercase">Expired</span> : <span className="px-2 py-1 bg-warning/10 text-warning rounded-sm text-[10px] font-bold uppercase">Live</span>;
                         return (
                           <tr key={req.id} className="border-b border-neutral-100 font-medium">
                             <td className="py-4 px-2">
                               <div className="capitalize font-bold text-neutral-800">{req.type || req.eventType} <span className="text-neutral-400 font-normal">/ {req.service === 'other' ? '' : req.service || req.serviceId}</span></div>
                               <div className="text-xs text-neutral-500 max-w-[200px] truncate" title={req.title || req.titleEn || req.details}>{req.title || req.titleEn || req.details}</div>
                             </td>
                             <td className="py-4 px-2">{statusBadge}</td>
                             <td className="py-4 px-2 text-neutral-600 text-xs font-mono">{req.clientId}</td>
                             <td className="py-4 px-2 text-neutral-600 text-xs">{req.city}</td>
                             <td className="py-4 px-2 text-neutral-500 text-xs">{req.createdAt ? new Date(req.createdAt).toLocaleString() : '-'}</td>
                             <td className="py-4 px-2">
                               <div className="flex gap-2">
                                 <button onClick={() => {
                                     setPromptDialog({ isOpen: true, message: 'Enter new status (live or completed):', value: req.status, onConfirm: async (val) => { if (val === 'live' || val === 'completed') { try { await updateDoc(doc(db, 'requests', req.id), { status: val }); } catch(e) { console.error(e); } } } });
                                   }} className="px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-sm hover:bg-neutral-200 font-bold text-xs" >Edit</button>
                                 <button onClick={() => handleDeleteAdminRequest(req.id)} className="px-3 py-1.5 bg-error/10 text-error rounded-sm hover:bg-error/20 font-bold text-xs" >Delete</button>
                               </div>
                             </td>
                           </tr>
                         );
                       })}
                 </tbody>
               </table>
               {filteredRequests.length === 0 && <div className="text-center p-12 text-neutral-400 font-bold uppercase text-sm">No requests found.</div>}
             </motion.div>
          )}

          {activeTab === 'settings' && <AdminSettingsTab config={config} isViewer={isViewer} language={language} />}

        </AnimatePresence>
      </div>

      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-base max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">{language === 'ar' ? 'تأكيد' : 'Confirm'}</h3>
            <p className="text-neutral-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-sm font-bold">Cancel</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-4 py-2 bg-error text-white rounded-sm font-bold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {promptDialog?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-base max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">{promptDialog.message}</h3>
            <input type="text" value={promptDialog.value} onChange={(e) => setPromptDialog(prev => prev ? {...prev, value: e.target.value} : prev)} className="w-full h-12 px-4 rounded-sm border border-neutral-300 focus:border-primary-500 outline-none" />
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setPromptDialog(null)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-sm font-bold">Cancel</button>
              <button onClick={() => { promptDialog.onConfirm(promptDialog.value); setPromptDialog(null); }} className="px-4 py-2 bg-primary-500 text-white rounded-sm font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {receiptPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4" onClick={() => setReceiptPreview(null)}>
          <div className="relative max-w-3xl w-full max-h-[90vh] flex justify-center" onClick={e => e.stopPropagation()}>
            <img src={receiptPreview} alt="Receipt" className="max-w-full max-h-[90vh] object-contain rounded-sm" />
            <button onClick={() => setReceiptPreview(null)} className="absolute -top-4 -right-4 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">✕</button>
          </div>
        </div>
      )}

    </div>
  );
}

// -------------------------------------------------------------
// Component Optimization: Extracting Settings to prevent parent re-renders
// -------------------------------------------------------------

function AdminSettingsTab({ config, isViewer, language }: { config: any; isViewer: boolean; language: string }) {
  const [settingsForm, setSettingsForm] = useState({
    requestLifespanMinutes: config.requestLifespanMinutes || 18,
    citiesString: config.cities?.join('\n') || '',
    servicesString: config.services?.join('\n') || '',
    contactInfo: config.contactInfo || { phone: '0553017955', whatsapp: '0553017955', tiktok: '', snapchat: '', youtube: '', x: '', instagram: '' }
  });
  const [packages, setPackages] = useState<any[]>(config.subscriptionPackages || []);
  const [banks, setBanks] = useState<any[]>(config.bankAccounts || []);

  useEffect(() => {
    setSettingsForm({
      requestLifespanMinutes: config.requestLifespanMinutes || 18,
      citiesString: config.cities?.join('\n') || '',
      servicesString: config.services?.join('\n') || '',
      contactInfo: config.contactInfo || { phone: '0553017955', whatsapp: '0553017955', tiktok: '', snapchat: '', youtube: '', x: '', instagram: '' }
    });
    setPackages(config.subscriptionPackages || []);
    setBanks(config.bankAccounts || []);
  }, [config]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) { return alert(language === 'ar' ? 'وضع العرض فقط: لا يمكنك الحفظ.' : 'Viewer mode: You cannot save changes.'); }
    try {
      const cities = settingsForm.citiesString.split('\n').map(s => s.trim()).filter(Boolean);
      const services = settingsForm.servicesString.split('\n').map(s => s.trim()).filter(Boolean);
      await setDoc(doc(db, 'settings', 'app'), {
        requestLifespanMinutes: Number(settingsForm.requestLifespanMinutes),
        cities, services,
        subscriptionPackages: packages,
        bankAccounts: banks,
        contactInfo: settingsForm.contactInfo
      }, { merge: true });
      alert(language === 'ar' ? 'تم الحفظ بنجاح!' : 'Settings saved successfully!');
    } catch (err: any) { alert(err.message); }
  };

  return (
    <motion.div key="settings" className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-neutral-200/60 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-800 mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-500"/> System Settings
        </h2>
        <form onSubmit={handleUpdateSettings} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-2">Request Lifecycle (in Minutes)</label>
               <input type="number" value={settingsForm.requestLifespanMinutes} onChange={(e) => setSettingsForm(prev => ({...prev, requestLifespanMinutes: Number(e.target.value)}))} className="w-full h-12 px-4 rounded-sm border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-neutral-50" />
             </div>
             <div>
               <label className="block text-sm font-bold text-neutral-700 mb-2">Cities (One per line)</label>
               <textarea value={settingsForm.citiesString} onChange={(e) => setSettingsForm(prev => ({...prev, citiesString: e.target.value}))} className="w-full h-32 p-4 rounded-sm border border-neutral-300 bg-neutral-50" />
             </div>
             <div className="md:col-span-2">
               <label className="block text-sm font-bold text-neutral-700 mb-2">Services / Event Types (One per line)</label>
               <textarea value={settingsForm.servicesString} onChange={(e) => setSettingsForm(prev => ({...prev, servicesString: e.target.value}))} className="w-full h-32 p-4 rounded-sm border border-neutral-300 bg-neutral-50" />
             </div>
           </div>

           <hr className="border-neutral-200" />
           <div className="flex items-center justify-between">
             <h3 className="text-md font-bold text-neutral-800">Bank Accounts</h3>
             <button type="button" onClick={() => setBanks([...banks, { id: Date.now().toString() }])} className="px-3 py-1.5 bg-neutral-100 font-bold text-sm rounded-sm">Add Bank</button>
           </div>
           {banks.map((b, i) => (
             <div key={b.id || `bank-${i}`} className="p-4 border border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-4 relative">
               <button type="button" onClick={() => setBanks(banks.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-error text-xs font-bold bg-error/10 px-2 py-1">Remove</button>
               <input placeholder="Bank Name (AR)" value={b.bankNameAr} onChange={(e) => { const newB = [...banks]; newB[i].bankNameAr = e.target.value; setBanks(newB); }} className="h-10 px-3 border border-neutral-300" />
               <input placeholder="Bank Name (EN)" value={b.bankNameEn} onChange={(e) => { const newB = [...banks]; newB[i].bankNameEn = e.target.value; setBanks(newB); }} className="h-10 px-3 border border-neutral-300" />
               <input placeholder="Account Name" value={b.accountName} onChange={(e) => { const newB = [...banks]; newB[i].accountName = e.target.value; setBanks(newB); }} className="h-10 px-3 border border-neutral-300 md:col-span-2" />
               <input placeholder="Account/IBAN..." value={b.iban} onChange={(e) => { const newB = [...banks]; newB[i].iban = e.target.value; setBanks(newB); }} className="h-10 px-3 border border-neutral-300 md:col-span-2 font-mono" />
             </div>
           ))}

           <hr className="border-neutral-200" />
           <div className="flex items-center justify-between">
             <h3 className="text-md font-bold text-neutral-800">Subscription Packages</h3>
             <button type="button" onClick={() => setPackages([...packages, { id: Date.now().toString(), durationMonths: 1, price: 0 }])} className="px-3 py-1.5 bg-neutral-100 font-bold text-sm rounded-sm">Add Package</button>
           </div>
           {packages.map((p, i) => (
             <div key={p.id || `pkg-${i}`} className="p-4 border border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-4 relative">
               <button type="button" onClick={() => setPackages(packages.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-error text-xs font-bold bg-error/10 px-2 py-1">Remove</button>
               <input placeholder="Name (AR)" value={p.nameAr} onChange={(e) => { const newP = [...packages]; newP[i].nameAr = e.target.value; setPackages(newP); }} className="h-10 px-3 border border-neutral-300" />
               <input placeholder="Name (EN)" value={p.nameEn} onChange={(e) => { const newP = [...packages]; newP[i].nameEn = e.target.value; setPackages(newP); }} className="h-10 px-3 border border-neutral-300" />
               <input type="number" placeholder="Months" value={p.durationMonths} onChange={(e) => { const newP = [...packages]; newP[i].durationMonths = Number(e.target.value); setPackages(newP); }} className="h-10 px-3 border border-neutral-300 font-mono" />
               <input type="number" placeholder="Price" value={p.price} onChange={(e) => { const newP = [...packages]; newP[i].price = Number(e.target.value); setPackages(newP); }} className="h-10 px-3 border border-neutral-300 font-mono" />
             </div>
           ))}

           <hr className="border-neutral-200" />
           <h3 className="text-md font-bold text-neutral-800 mb-4">Contact Information (For Policies Page)</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {['phone', 'whatsapp', 'tiktok', 'snapchat', 'youtube', 'x', 'instagram'].map(key => (
                 <div key={key}>
                   <label className="block text-xs font-bold text-neutral-500 mb-1 capitalize">{key}</label>
                   <input type="text" value={(settingsForm.contactInfo as any)[key] || ''} onChange={(e) => setSettingsForm(prev => ({...prev, contactInfo: {...prev.contactInfo, [key]: e.target.value}}))} className="w-full h-10 px-3 border border-neutral-300 rounded-sm text-sm" />
                 </div>
               ))}
           </div>
           
           <hr className="border-neutral-200" />
           <button type="submit" className="w-full h-12 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-sm shadow-base">
             Save All Settings
           </button>
        </form>
      </div>
    </motion.div>
  );
}
