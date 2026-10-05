import React, { useEffect, useState, FC } from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';
import { translations } from '../../lib/translations';
import { motion, AnimatePresence } from 'motion/react';
import { Request, Bid } from '../../types';
import { ChevronDown, ChevronUp, Search, Clock, Users, Heart, Briefcase, Gift, MapPin, Flame, GraduationCap, Building, Phone, Send, CheckCircle, XCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MENU_CATEGORIES, EVENT_TYPES } from '../../lib/constants';
import { collection, query, where, orderBy, onSnapshot, Timestamp, limit, addDoc, doc, updateDoc, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppConfig } from '../../store/useAppConfig';
import { checkContentForContactInfo, ModerationResult } from '../../services/moderationService';
import { getCityName } from '../../lib/cities';
import CitySelect from '../CitySelect';

const EVENT_TYPE_COLORS: Record<string, string> = {
  wedding: '#1F3A70',      // Deep Blue
  corporate: '#27AE60',    // Green
  birthday: '#E67E22',     // Orange
  graduation: '#8E44AD',   // Purple
  exhibition: '#2980B9',   // Light Blue
  other: '#95A5A6',        // Gray
};

const EVENT_ICONS: Record<string, any> = {
  wedding: Heart,
  corporate: Briefcase,
  birthday: Gift,
  graduation: GraduationCap,
  exhibition: Building,
  other: Clock
};

interface TickerRowProps {
  request: Request & { isNew?: boolean };
  t: any;
  language: string;
}

const TickerRow: FC<TickerRowProps> = ({ request, t, language }) => {
  const { user } = useAuthStore();
  const { config } = useAppConfig();
  const [expanded, setExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(Math.max(0, request.expiresAt - Date.now()));
  const [bids, setBids] = useState<Bid[]>([]);
  const [isBidding, setIsBidding] = useState(false);
  const [bidForm, setBidForm] = useState({ amount: '', remarks: '' });
  const [reportingBidId, setReportingBidId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [bidToAccept, setBidToAccept] = useState<string | null>(null);
  const [bidToReject, setBidToReject] = useState<string | null>(null);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [moderationError, setModerationError] = useState<ModerationResult | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isClient = user?.type === 'client';
  const isVendor = user?.type === 'vendor';
  const isOwner = user?.id === request.clientId;
  const hasVendorBid = isVendor && bids.some(bid => bid.vendorId === user?.id);

  useEffect(() => {
    setTimeLeft(Math.max(0, request.expiresAt - Date.now()));
    const timer = setInterval(() => {
      const diff = Math.max(0, request.expiresAt - Date.now());
      setTimeLeft(diff);
      if (diff === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [request.expiresAt]);

  // Fetch bids when expanded
  useEffect(() => {
    if (!expanded) return;

    const bidsRef = collection(db, 'requests', request.id, 'bids');
    let q;

    if (isOwner) {
      // Client sees all bids on their request
      q = query(bidsRef, orderBy('createdAt', 'desc'));
    } else if (isVendor) {
      // Vendor only sees THEIR bids
      q = query(bidsRef, where('vendorId', '==', user?.id || ''), orderBy('createdAt', 'desc'));
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bid));
      setBids(docs);
    }, (error) => {
      console.error("LiveFeed Bids Fetch Error:", error);
    });

    return () => unsubscribe();
  }, [expanded, request.id, isOwner, isVendor, user?.id]);

  const handlePlaceBidReal = async () => {
    if (!user || !bidForm.amount) return;
    setIsBidding(true);
    try {
      await addDoc(collection(db, 'requests', request.id, 'bids'), {
        requestId: request.id,
        clientId: request.clientId,
        vendorId: user.id,
        vendorName: user.name,
        vendorPhone: user.phone || '',
        vendorPortfolio: user.portfolio || [],
        vendorWebsite: user.website || '',
        vendorRating: 5.0, // Default for now
        amount: Number(bidForm.amount),
        remarks: bidForm.remarks,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setBidForm({ amount: '', remarks: '' });
      setIsConfirmingSubmit(false);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      
      // Update vendorCount in request
      const requestRef = doc(db, 'requests', request.id);
      const reqSnap = await getDoc(requestRef);
      if (reqSnap.exists()) {
        const currentCount = reqSnap.data().vendorCount || 0;
        await updateDoc(requestRef, { 
          vendorCount: currentCount + 1,
          hasUnreadBids: true 
        });
      }
    } catch (error) {
      console.error("Bid Error:", error);
    } finally {
      setIsBidding(false);
    }
  };

  const handlePlaceBid = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setModerationError(null);
    if (bidForm.remarks.trim()) {
      setIsModerating(true);
      try {
        const modResult = await checkContentForContactInfo(bidForm.remarks);
        if (!modResult.isSafe) {
          setModerationError(modResult);
          return;
        }
      } catch (err) {
        console.error("Mod Check Error:", err);
      } finally {
        setIsModerating(false);
      }
    }
    setIsConfirmingSubmit(true);
  };

  const handleUpdateBidStatus = async (bidId: string, status: 'accepted' | 'rejected') => {
    try {
      const bidRef = doc(db, 'requests', request.id, 'bids', bidId);
      await updateDoc(bidRef, { status });
    } catch (error) {
      console.error("Update Status Error (Bid):", error);
      return; // Stop if bid update fails
    }
    
    if (status === 'accepted') {
      try {
        const requestRef = doc(db, 'requests', request.id);
        await updateDoc(requestRef, { status: 'confirmed' });
      } catch (error) {
        console.error("Update Status Error (Request):", error);
      }
    }
  };

  const handleSubmitReport = async (vendorId: string) => {
    if (!reportReason) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user?.id,
        reportedVendorId: vendorId,
        reason: reportReason,
        createdAt: Timestamp.now()
      });
      setReportingBidId(null);
      setReportReason('');
      alert(language === 'ar' ? 'تم تقديم البلاغ بنجاح' : 'Report submitted successfully');
    } catch (error) {
      console.error("Report Error:", error);
    }
  };

  const isHot = request.vendorCount > 5;
  const eventColor = EVENT_TYPE_COLORS[request.type] || EVENT_TYPE_COLORS.other;
  const IconComponent = EVENT_ICONS[request.type] || EVENT_ICONS.other;

  const isCompleted = request.status === 'completed' || request.status === 'confirmed';
  const isExpired = timeLeft === 0 && !isCompleted;
  const hours = Math.floor(timeLeft / 3600000);
  const minutes = Math.floor((timeLeft % 3600000) / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  
  const totalMs = (config.requestLifespanMinutes || 18) * 60 * 1000;
  const percent = Math.min(100, (timeLeft / totalMs) * 100);

  let leftColor = "";
  let outlineColor = "rgba(229, 231, 235, 1)"; // border-neutral-200
  let bodyBgColor = "#FFFFFF";
  let timeTextColor = "text-success";
  let expandBgColor = "bg-primary-50/20";
  let customTransition: any = { duration: 0.5 };

  if (isCompleted) {
    leftColor = "#22C55E";
    outlineColor = "rgba(34, 197, 94, 0.4)"; // Success green
    bodyBgColor = "#F0FDF4";
    timeTextColor = "text-success";
    expandBgColor = "bg-success/5";
  } else if (isExpired) {
    leftColor = "#9CA3AF"; 
    outlineColor = "rgba(229, 231, 235, 1)"; // Solid neutral-200
    bodyBgColor = "#F9FAFB"; 
    timeTextColor = "text-neutral-500";
    expandBgColor = "bg-neutral-100/50";
  } else if (minutes >= 10) {
    leftColor = "#22C55E";
    outlineColor = "rgba(229, 231, 235, 1)";
    timeTextColor = "text-success";
  } else if (minutes >= 5) {
    leftColor = "#EAB308";
    outlineColor = "rgba(234, 179, 8, 0.4)";
    timeTextColor = "text-warning";
    expandBgColor = "bg-warning/5";
  } else {
    leftColor = "#EF4444";
    outlineColor = "rgba(239, 68, 68, 0.4)";
    bodyBgColor = "#FEF2F2";
    timeTextColor = "text-error";
    expandBgColor = "bg-error/5";
  }

  let animateProps: any = {
    boxShadow: `inset 4px 0 0 0 ${leftColor}`,
    borderColor: outlineColor,
    backgroundColor: bodyBgColor,
    opacity: 1, // Keep fully visible, even if expired
  };

  if (!isCompleted && !isExpired && minutes < 2) {
    animateProps.boxShadow = [
      `inset 4px 0 0 0 ${leftColor}, 0 0 0px rgba(239,68,68,0)`,
      `inset 8px 0 0 0 ${leftColor}, 0 0 10px rgba(239,68,68,0.2)`,
      `inset 4px 0 0 0 ${leftColor}, 0 0 0px rgba(239,68,68,0)`
    ];
    animateProps.borderColor = [outlineColor, leftColor, outlineColor];
    animateProps.backgroundColor = ["#FEF2F2", "#FEE2E2", "#FEF2F2"];
    customTransition = { duration: 1.5, repeat: Infinity };
  } else if (!isCompleted && !isExpired && request.isNew) {
    animateProps.backgroundColor = ["#FEF08A", bodyBgColor];
    customTransition = { duration: 2 };
  }

  return (
    <>
      {/* 1. THE CARDS */}
      <motion.div 
        layout="position"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={animateProps}
        transition={customTransition}
        exit={{ opacity: 0, scale: 0.98 }}
        onClick={() => setExpanded(true)}
        className="w-full bg-white rounded-2xl border overflow-hidden relative group transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer flex flex-row items-stretch p-4 sm:p-5 gap-4"
      >
        {/* Right side (Start side) - Request Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 bg-primary-50 text-primary-600 font-bold text-[10px] uppercase tracking-wider rounded-md border border-primary-100 flex items-center gap-1.5 shadow-sm">
              <IconComponent className="w-3 h-3" style={{ color: eventColor }} />
              {t[request.type.toLowerCase() as keyof typeof t] || request.type}
            </span>
            {isOwner && (
               <span className="px-2.5 py-1 bg-success text-white font-bold text-[10px] uppercase tracking-wider rounded-md shadow-sm">
                 {language === 'ar' ? 'طلبي' : 'My Request'}
               </span>
            )}
          </div>
          
          <h3 className="font-bold text-lg sm:text-xl text-neutral-800 line-clamp-1 mb-3">{request.title || (t[request.type.toLowerCase() as keyof typeof t] || request.type)}</h3>
          
          <div className="flex flex-wrap items-center gap-3 text-neutral-500 text-[10px] sm:text-xs">
            <div className="flex items-center gap-1.5 font-medium"><MapPin className="w-3.5 h-3.5 text-primary-400" /> {getCityName(request.location, language)}</div>
            <div className="flex items-center gap-1.5 font-medium"><Users className="w-3.5 h-3.5 text-primary-400" /> {request.guests} {t.guests}</div>
            <div className="flex items-center gap-1.5 font-medium"><Clock className="w-3.5 h-3.5 text-primary-400" /> {request.date}</div>
            <div className="flex items-center gap-1.5 font-bold text-primary-600 bg-primary-50/50 px-2 py-0.5 rounded-md border border-primary-100/50"><span dir="ltr">{request.budget}</span> <span className="text-[9px]">{t.sar}</span></div>
          </div>
        </div>

        {/* Left side (End side) - Timer & Bids */}
        <div className="flex flex-col items-center justify-center gap-2.5 border-l border-neutral-100 pl-4 sm:pl-6 min-w-[90px]">
           {isCompleted ? (
              <div className="w-16 h-16 rounded-full border-[5px] border-success/30 flex items-center justify-center bg-success/10 text-success font-black text-xs shadow-inner">
                 {language === 'ar' ? 'مكتمل' : 'Done'}
              </div>
           ) : isExpired ? (
              <div className="w-16 h-16 rounded-full border-[5px] border-neutral-200 flex items-center justify-center bg-neutral-50 text-neutral-400 font-black text-xs shadow-inner">
                 {t.expired}
              </div>
           ) : (
              <div className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-inner bg-white/50" style={{ boxShadow: `inset 0 0 0 5px ${outlineColor}` }}>
                  <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="4" className="text-transparent" />
                    <circle 
                      cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="4" 
                      strokeDasharray="100 100" strokeDashoffset={100 - percent} 
                      style={{ stroke: leftColor }}
                      className="transition-all duration-1000"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="flex flex-col items-center justify-center z-10 pt-1">
                     <span className={cn("font-black text-lg leading-none m-0 p-0", timeTextColor)}>
                       {hours > 0 ? hours : minutes}
                     </span>
                     <span className={cn("font-bold text-[9px] uppercase -mt-0.5", timeTextColor)}>
                       {hours > 0 ? (language === 'ar' ? 'ساعة' : 'hr') : (language === 'ar' ? 'دقيقة' : 'min')}
                     </span>
                  </div>
              </div>
           )}
           <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1.5 transition-colors", isHot ? "bg-error text-white" : "bg-neutral-100 border border-neutral-200 text-neutral-600 hover:bg-neutral-200")}>
             {request.vendorCount} {t.bids}
             {isHot && <Flame className="w-3 h-3" />}
           </div>
        </div>
      </motion.div>

      {/* 2. THE SLIDE-OVER DRAWER (Panel) */}
      <AnimatePresence>
        {expanded && (
          <div className="fixed inset-0 z-[100] flex rtl:justify-end ltr:justify-start">
             {/* Backdrop */}
             <motion.div
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setExpanded(false)}
               className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-[100]"
             />
             
             {/* Panel */}
             <motion.div
               initial={{ x: language === 'ar' ? '-100%' : '100%', opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               exit={{ x: language === 'ar' ? '-100%' : '100%', opacity: 0 }}
               transition={{ type: "spring", damping: 25, stiffness: 200 }}
               className={cn("fixed inset-y-0 z-[101] w-full max-w-md bg-neutral-50 shadow-2xl flex flex-col pointer-events-auto", language === 'ar' ? 'left-0' : 'right-0')}
             >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-200 bg-white">
                    <h2 className="font-bold text-base text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary-50 text-primary-600">
                          <IconComponent className="w-4 h-4" />
                       </div>
                       {language === 'ar' ? 'تفاصيل الطلب' : 'Request Details'}
                    </h2>
                    <button 
                       onClick={() => setExpanded(false)} 
                       className="p-2 bg-neutral-50 rounded-full text-neutral-500 hover:text-error hover:bg-error/10 transition-colors border border-neutral-200"
                    >
                       <XCircle className="w-5 h-5 pointer-events-none" />
                    </button>
                </div>

                {/* Body Scrollable */}
                <div className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-6 pb-32">
                   {/* Request Context Card */}
                   <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm mb-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary-50 rounded-full -mr-10 -mt-10 opacity-50 pointer-events-none" />
                      <div className="relative z-10 flex flex-col gap-4">
                         <div>
                            <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">{t[request.type.toLowerCase() as keyof typeof t] || request.type}</span>
                            <h3 className="text-neutral-800 font-bold text-lg leading-snug">"{request.title}"</h3>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                               <span className="text-[9px] text-neutral-400 uppercase font-bold">{t.budget}</span>
                               <span className="text-primary-600 font-bold text-sm" dir="ltr">{request.budget} <span className="text-[9px] uppercase">{t.sar}</span></span>
                            </div>
                            <div className="flex flex-col gap-1">
                               <span className="text-[9px] text-neutral-400 uppercase font-bold">{t.date}</span>
                               <span className="text-neutral-800 font-bold text-xs">{request.date}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                               <span className="text-[9px] text-neutral-400 uppercase font-bold">{t.guests}</span>
                               <span className="text-neutral-800 font-bold text-xs">{request.guests}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                               <span className="text-[9px] text-neutral-400 uppercase font-bold">{language === 'ar' ? 'المدينة' : 'City'}</span>
                               <span className="text-neutral-800 font-bold text-xs">{getCityName(request.location, language)}</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* ACTION AREA - CLIENT VIEW (Bid Management) */}
                   {isOwner && (
                     <div className="space-y-4">
                       <div className="flex items-center justify-between border-b border-primary-200 pb-2">
                         <h4 className="text-xs font-bold text-primary-600 uppercase tracking-widest flex items-center gap-2">
                           <MessageSquare className="w-3.5 h-3.5" /> {t.vendorOffers}
                         </h4>
                         <span className="text-[10px] font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full uppercase">
                           {bids.length} {t.bids}
                         </span>
                       </div>
     
                       {bids.length === 0 ? (
                         <div className="py-10 text-center text-neutral-400 bg-white rounded-xl border border-neutral-100 border-dashed">
                           <p className="text-[11px] font-bold uppercase italic">{t.noBidsYet}</p>
                         </div>
                       ) : (
                         <div className="flex flex-col gap-3 pb-2">
                           {bids.map(bid => (
                             <div key={bid.id} className={cn("p-4 border rounded-xl flex flex-col gap-3 relative overflow-hidden transition-all shadow-sm", 
                               bid.status === 'accepted' ? 'bg-success/5 border-success shadow-md ring-1 ring-success' : 'bg-white border-neutral-200 hover:border-primary-300'
                             )}>
                               <div className="flex justify-between items-start">
                                 <div className="flex items-center gap-2">
                                   {bid.vendorPortfolio && bid.vendorPortfolio.length > 0 ? (
                                     <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-200 shrink-0">
                                       <img src={bid.vendorPortfolio[0]} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                     </div>
                                   ) : (
                                     <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center font-bold text-neutral-500 text-xs shrink-0">
                                       {bid.vendorName.charAt(0)}
                                     </div>
                                   )}
                                   <div>
                                     <p className="text-xs font-bold text-neutral-800 uppercase line-clamp-1">{bid.vendorName}</p>
                                     <div className="flex items-center gap-1">
                                       <span className="text-[10px] text-warning font-bold">⭐ {bid.vendorRating}</span>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="text-end">
                                   <p className="text-lg font-black text-primary-600" dir="ltr">{bid.amount} <span className="text-[9px] uppercase">{t.sar}</span></p>
                                 </div>
                               </div>
                               
                               <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 min-h-[40px]">
                                 <p className="text-[11px] text-neutral-600 leading-relaxed italic line-clamp-4">"{bid.remarks || '...'}"</p>
                               </div>
     
                               {bid.vendorPortfolio && bid.vendorPortfolio.length > 0 && (
                                 <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 hide-scrollbar">
                                   {bid.vendorPortfolio.slice(0, 4).map((img, idx) => (
                                     <div key={idx} className="w-12 h-12 rounded-lg border border-neutral-200 overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all" onClick={() => setSelectedImage(img)}>
                                       <img src={img} alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100" referrerPolicy="no-referrer" />
                                     </div>
                                   ))}
                                   {bid.vendorPortfolio.length > 4 && (
                                     <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-400 border border-neutral-200 shrink-0">
                                       +{bid.vendorPortfolio.length - 4}
                                     </div>
                                   )}
                                 </div>
                               )}
     
                               <div className="flex items-center justify-between mt-1 pt-3 border-t border-neutral-100">
                                 {bid.status === 'accepted' ? (
                                   <div className="flex gap-2 w-full">
                                     <a href={`tel:${bid.vendorPhone}`} className="flex-1 bg-success hover:bg-success/90 text-white h-10 rounded-lg text-[11px] font-bold uppercase flex items-center justify-center gap-2 transition-colors">
                                       <Phone className="w-4 h-4" /> {t.call}
                                     </a>
                                     <a href={`https://wa.me/${bid.vendorPhone?.replace(/\+/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-neutral-900 hover:bg-black text-white h-10 rounded-lg text-[11px] font-bold uppercase flex items-center justify-center gap-2 transition-colors">
                                       <MessageSquare className="w-4 h-4" /> {t.whatsapp}
                                     </a>
                                   </div>
                                 ) : bid.status === 'rejected' ? (
                                   <div className="w-full text-center py-2 bg-neutral-100 text-neutral-400 rounded-lg text-[10px] font-bold uppercase">
                                     {t.rejected}
                                   </div>
                                 ) : isExpired ? (
                                   <div className="w-full text-center py-2 bg-neutral-100 text-neutral-400 rounded-lg text-[10px] font-bold uppercase">
                                     {language === 'ar' ? 'منتهي الصلاحية' : 'Expired'}
                                   </div>
                                 ) : (
                                   <div className="flex gap-2 w-full">
                                     <button 
                                       onClick={() => setBidToAccept(bid.id)}
                                       className="flex-1 bg-success hover:bg-success/90 text-white h-10 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95"
                                     >
                                       <CheckCircle className="w-4 h-4" /> {language === 'ar' ? 'قبول' : 'Accept'}
                                     </button>
                                     <button 
                                       onClick={() => setBidToReject(bid.id)}
                                       className="px-4 bg-warning hover:bg-warning/90 text-white h-10 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                                     >
                                       <XCircle className="w-4 h-4" /> {language === 'ar' ? 'رفض' : 'Reject'}
                                     </button>
                                     <button 
                                       onClick={() => setReportingBidId(bid.id)}
                                       className="px-4 bg-error hover:bg-error/90 text-white h-10 rounded-lg transition-colors text-[10px] font-bold uppercase flex items-center justify-center gap-1.5"
                                     >
                                       <AlertTriangle className="w-4 h-4" /> {language === 'ar' ? 'إبلاغ' : 'Report'}
                                     </button>
                                   </div>
                                 )}
                               </div>
     
                               {/* Report Overlay */}
                               <AnimatePresence>
                                 {reportingBidId === bid.id && (
                                   <motion.div 
                                     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                     className="absolute inset-0 bg-white/95 backdrop-blur-sm p-5 flex flex-col z-10 rounded-xl"
                                   >
                                     <div className="flex justify-between items-center mb-3">
                                       <h5 className="text-[11px] font-bold text-error uppercase flex items-center gap-2">
                                         <AlertTriangle className="w-4 h-4" /> {t.reporting}
                                       </h5>
                                       <button onClick={() => setReportingBidId(null)} className="text-neutral-400">
                                         <XCircle className="w-4 h-4" />
                                       </button>
                                     </div>
                                     <textarea 
                                       value={reportReason}
                                       onChange={(e) => setReportReason(e.target.value)}
                                       placeholder={t.reportReason}
                                       className="flex-1 w-full border border-neutral-300 rounded-lg p-3 text-[11px] outline-none focus:border-error focus:ring-1 focus:ring-error resize-none bg-neutral-50"
                                     />
                                     <button 
                                       onClick={() => handleSubmitReport(bid.vendorId)}
                                       className="mt-3 bg-error text-white h-10 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                                     >
                                       {t.submitReport}
                                     </button>
                                   </motion.div>
                                 )}
                               </AnimatePresence>
     
                               {/* Confirm Accept Overlay */}
                               <AnimatePresence>
                                 {bidToAccept === bid.id && (
                                   <motion.div 
                                     initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                     className="absolute inset-0 bg-white/95 backdrop-blur-md p-5 flex flex-col items-center justify-center text-center z-10 rounded-xl"
                                   >
                                     <CheckCircle className="w-10 h-10 text-success mb-3 animate-bounce" />
                                     <p className="text-xs font-black text-neutral-800 mb-1.5 uppercase">
                                       {language === 'ar' ? 'هل أنت متأكد من قبول هذا العرض؟' : 'Are you sure you want to accept this bid?'}
                                     </p>
                                     <p className="text-[10px] text-neutral-500 mb-5 font-bold">
                                       {language === 'ar' ? 'هذا الإجراء لا يمكن التراجع عنه.' : 'This action cannot be undone.'}
                                     </p>
                                     <div className="flex gap-2 w-full">
                                       <button 
                                          onClick={() => setBidToAccept(null)}
                                          className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 h-10 rounded-lg text-[11px] font-bold uppercase transition-colors"
                                       >
                                         {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                       </button>
                                       <button 
                                          onClick={() => {
                                            handleUpdateBidStatus(bid.id, 'accepted');
                                            setBidToAccept(null);
                                          }}
                                          className="flex-1 bg-success hover:bg-success/90 text-white h-10 rounded-lg text-[11px] font-bold uppercase transition-colors"
                                       >
                                         {language === 'ar' ? 'تأكيد' : 'Confirm'}
                                       </button>
                                     </div>
                                   </motion.div>
                                 )}
                                 {bidToReject === bid.id && (
                                   <motion.div 
                                     initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                     className="absolute inset-0 bg-white/95 backdrop-blur-md p-5 flex flex-col items-center justify-center text-center z-10 rounded-xl"
                                   >
                                     <AlertTriangle className="w-10 h-10 text-warning mb-3 animate-bounce" />
                                     <p className="text-xs font-black text-neutral-800 mb-1.5 uppercase">
                                       {language === 'ar' ? 'هل أنت متأكد من رفض هذا العرض؟' : 'Are you sure you want to reject this bid?'}
                                     </p>
                                     <p className="text-[10px] text-neutral-500 mb-5 font-bold">
                                       {language === 'ar' ? 'سيتم إخفاء هذا العرض بشكل نهائي.' : 'This bid will be permanently hidden.'}
                                     </p>
                                     <div className="flex gap-2 w-full">
                                       <button 
                                          onClick={() => setBidToReject(null)}
                                          className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 h-10 rounded-lg text-[11px] font-bold uppercase transition-colors"
                                       >
                                         {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                       </button>
                                       <button 
                                          onClick={() => {
                                            handleUpdateBidStatus(bid.id, 'rejected');
                                            setBidToReject(null);
                                          }}
                                          className="flex-1 bg-warning hover:bg-warning/90 text-white h-10 rounded-lg text-[11px] font-bold uppercase transition-colors"
                                       >
                                         {language === 'ar' ? 'تأكيد الرفض' : 'Confirm Reject'}
                                       </button>
                                     </div>
                                   </motion.div>
                                 )}
                               </AnimatePresence>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   )}
     
                   {/* ACTION AREA - VENDOR VIEW (Place Bid) */}
                   {isVendor && !isOwner && !hasVendorBid && (
                     <div className="bg-white p-5 border border-primary-200 shadow-sm relative overflow-hidden rounded-xl mt-4">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none" />
                        
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                              <Briefcase className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-neutral-800 uppercase tracking-widest leading-tight">{t.bidNow}</h4>
                              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wide">{t[request.type.toLowerCase() as keyof typeof t] || request.type}</p>
                            </div>
                          </div>
     
                          {user?.serviceCategories?.includes(request.type) ? (
                            <div className="flex flex-col gap-4">
                              <div>
                                <label className="block text-[11px] font-bold text-primary-600 uppercase mb-2 px-1 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-success"></span>
                                  {t.price}
                                </label>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    disabled={isBidding || isConfirmingSubmit || isModerating}
                                    value={bidForm.amount}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setBidForm({...bidForm, amount: val.slice(0, 6)});
                                    }}
                                    placeholder="0"
                                    dir="ltr"
                                    className="w-full h-14 pl-14 pr-4 bg-white border-2 border-primary-200 rounded-xl font-mono font-black text-xl text-primary-700 placeholder:text-primary-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-left shadow-inner disabled:opacity-50 disabled:bg-neutral-100"
                                  />
                                  <div className="absolute left-2 top-2 bottom-2 flex items-center justify-center px-3 bg-primary-50 rounded-lg border border-primary-100 pointer-events-none">
                                    <span className="text-[11px] font-black text-primary-700 tracking-wider uppercase">{t.sar}</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-neutral-600 uppercase mb-2 px-1">{t.remarks}</label>
                                <textarea 
                                  value={bidForm.remarks}
                                  disabled={isBidding || isConfirmingSubmit || isModerating}
                                  onChange={(e) => {
                                    setBidForm({...bidForm, remarks: e.target.value});
                                    setModerationError(null);
                                  }}
                                  placeholder={t.writeRemarks}
                                  rows={3}
                                  className={cn(
                                    "w-full p-4 bg-neutral-50 border rounded-xl text-xs font-medium focus:bg-white outline-none resize-none transition-all disabled:opacity-50 disabled:bg-neutral-100",
                                    moderationError ? "border-error focus:border-error focus:ring-1 focus:ring-error" : "border-neutral-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                  )}
                                />
                                {moderationError && (
                                  <div className="mt-2 p-3 bg-error/10 border border-error/20 rounded-lg text-xs font-bold text-error flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <p>
                                      {language === 'ar' 
                                        ? 'لا يُسمح بمشاركة معلومات الاتصال أو نشر أي محتوى يخص الممنوعات (المخدرات، الأسلحة، إلخ).' 
                                        : 'Sharing contact information or prohibited/illegal content is not allowed.'}
                                      <span className="block mt-1 opacity-70">
                                        {language === 'ar' ? `تم اكتشاف: ${moderationError.detectedItems.join(', ')}` : `Detected: ${moderationError.detectedItems.join(', ')}`}
                                      </span>
                                    </p>
                                  </div>
                                )}
                              </div>
                              <button 
                               onClick={handlePlaceBid}
                               disabled={isBidding || !bidForm.amount || isConfirmingSubmit || isModerating}
                               className={cn(
                                 "w-full h-12 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-black text-[12px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
                                 isBidding || isModerating ? "animate-pulse" : "mt-2"
                               )}
                              >
                                {isBidding || isModerating ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {isModerating ? (language === 'ar' ? 'جاري الفحص...' : 'Checking...') : t.sendBid}
                              </button>
                            </div>
                          ) : (
                            <div className="py-6 flex flex-col items-center justify-center text-center">
                              <AlertTriangle className="w-10 h-10 text-warning mb-3" />
                              <h5 className="font-bold text-sm text-neutral-800 mb-1">
                                {language === 'ar' ? 'غير مصرح لك بتقديم عرض' : 'Not Authorized to Bid'}
                              </h5>
                              <p className="text-xs text-neutral-500 font-medium max-w-[250px] leading-relaxed">
                                {language === 'ar' 
                                  ? 'هذا الطلب لا يندرج ضمن تخصصاتك المسجلة. يمكنك تعديل تخصصاتك من الملف الشخصي بعد تفعيل اشتراكك.' 
                                  : 'This request type is not in your registered categories. You can update your categories from your profile after activating your subscription.'}
                              </p>
                            </div>
                          )}
                          
                          <AnimatePresence>
                            {isConfirmingSubmit && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur-md p-6 flex flex-col items-center text-center z-20 rounded-b-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
                              >
                                <Send className="w-10 h-10 text-primary-500 mb-3" />
                                <p className="text-sm font-black text-neutral-800 mb-1.5 uppercase">
                                  {language === 'ar' ? 'تأكيد إرسال العرض؟' : 'Confirm Bid Submission?'}
                                </p>
                                <p className="text-[11px] text-neutral-500 mb-6 font-bold">
                                  {language === 'ar' ? 'مبلغ العرض:' : 'Bid Amount:'} <span className="text-success font-black mx-1">{bidForm.amount}</span> {t.sar}
                                </p>
                                <div className="flex gap-2 w-full">
                                  <button 
                                    onClick={() => setIsConfirmingSubmit(false)}
                                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 h-12 rounded-xl text-[11px] font-bold uppercase transition-colors"
                                  >
                                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                  </button>
                                  <button 
                                    onClick={handlePlaceBidReal}
                                    className="flex-1 bg-primary-500 hover:bg-primary-600 text-white h-12 rounded-xl text-[11px] font-bold uppercase transition-colors flex items-center justify-center gap-2 shadow-md"
                                  >
                                    {isBidding ? <Clock className="w-4 h-4 animate-spin" /> : (language === 'ar' ? 'تأكيد' : 'Confirm')}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                            {submitSuccess && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                                className="absolute inset-0 bg-success/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center z-30 rounded-xl text-white"
                              >
                                <CheckCircle className="w-16 h-16 mb-4" />
                                <h3 className="text-xl font-black uppercase mb-2">{language === 'ar' ? 'تم بنجاح!' : 'Success!'}</h3>
                                <p className="text-sm font-bold opacity-90">{language === 'ar' ? 'تم تقديم عرضك للعميل بنجاح' : 'Your bid has been successfully submitted to the client'}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          
                          {/* Vendor Bid Summary block moved outside of placement conditionally */}
                        </div>
                     </div>
                   )}
                   {isVendor && !isOwner && hasVendorBid && (
                     <div className="bg-success/5 p-4 border border-success/20 shadow-sm relative overflow-hidden rounded-xl mt-4 flex items-center justify-between gap-4">
                       <div className="flex items-center gap-3">
                         <CheckCircle className="w-8 h-8 text-success shrink-0" />
                         <div>
                           <h4 className="text-[13px] font-black text-success uppercase leading-tight">{language === 'ar' ? 'تم تقديم عرضك مسبقاً' : 'Bid Already Submitted'}</h4>
                           <p className="text-[10px] text-success/80 font-bold mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{language === 'ar' ? 'يمكنك متابعة حالة العرض' : 'You can track the bid status'}</p>
                         </div>
                       </div>
                       <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-success/10 flex flex-col items-center justify-center shrink-0 min-w-24">
                          <span className="text-[10px] text-neutral-400 font-bold uppercase mb-0.5">{t.amount}</span>
                          <span className="text-sm font-black text-success">{bids.find(b => b.vendorId === user?.id)?.amount || 0} {t.sar}</span>
                          <div className={cn("mt-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase border shadow-sm", 
                               bids.find(b => b.vendorId === user?.id)?.status === 'accepted' ? 'bg-success/10 border-success text-success' : 
                               bids.find(b => b.vendorId === user?.id)?.status === 'rejected' ? 'bg-error/10 border-error text-error' : 
                               'bg-neutral-100 border-neutral-200 text-neutral-500'
                          )}>
                             {t[(bids.find(b => b.vendorId === user?.id)?.status || 'pending') as keyof typeof t] || bids.find(b => b.vendorId === user?.id)?.status}
                          </div>
                       </div>
                     </div>
                   )}
                   
                   {isVendor && !isOwner && bids.find(b => b.vendorId === user?.id)?.status === 'accepted' && (
                     <div className="mt-3 bg-success/10 border border-success/30 text-success-800 p-3 rounded-xl text-center flex flex-col items-center gap-1.5 shadow-sm">
                       <CheckCircle className="w-5 h-5 mx-auto text-success" />
                       <p className="text-xs font-bold leading-relaxed text-success">
                         {language === 'ar' 
                           ? 'مبروك العميل قبل عرضك، إنتظر تواصل العميل معك' 
                           : 'Congratulations! The client accepted your offer. Please wait for them to contact you.'}
                       </p>
                     </div>
                   )}
                   
                   {!user && (
                     <div className="py-12 flex flex-col items-center justify-center bg-white rounded-xl border border-neutral-200 border-dashed mt-4">
                        <Users className="w-8 h-8 text-neutral-300 mb-3" />
                        <p className="text-xs font-bold text-neutral-400 uppercase italic tracking-wider">
                          {language === 'ar' ? 'قم بتسجيل الدخول لتقديم عرض' : 'Please login to place a bid'}
                        </p>
                     </div>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Full-Screen Image Viewer */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md cursor-zoom-out"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 bg-white/10 rounded-full"
              onClick={() => setSelectedImage(null)}
            >
              <XCircle className="w-8 h-8 pointer-events-none" />
            </button>
            <img 
              src={selectedImage} 
              alt="Enlarged portfolio view" 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl drop-shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function LiveFeed() {
  const { user } = useAuthStore();
  const { config } = useAppConfig();
  const { language } = useLanguageStore();
  const t = translations[language];
  const [requests, setRequests] = useState<(Request & { isNew?: boolean })[]>([]);
  const [filter, setFilter] = useState(user?.type === 'vendor' ? 'my_categories' : 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'completed'>('all');
  const [cityFilter, setCityFilter] = useState('all');

  useEffect(() => {
    // Real-time Firestore sync
    const q = query(
      collection(db, 'requests'), 
      where('status', 'in', ['live', 'confirmed', 'completed']),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        let expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : data.expiresAt;
        
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
        const maxDuration = (config.requestLifespanMinutes || 18) * 60 * 1000;
        if (expiresAt - createdAt > maxDuration) {
          expiresAt = createdAt + maxDuration;
        }

        return {
          id: doc.id,
          ...data,
          expiresAt: expiresAt
        } as Request;
      });
      setRequests(docs);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, []);

  const categories = [
    ...(user?.type === 'vendor' ? [{ id: 'my_categories', label: language === 'ar' ? 'تخصصاتي' : 'My Categories' }] : []),
    { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
    ...EVENT_TYPES.map(type => ({
      id: type,
      label: t[type as keyof typeof t] || type
    }))
  ];

  const now = Date.now();
  
  let filteredRequests = filter === 'all' 
    ? requests 
    : filter === 'my_categories' && user?.type === 'vendor'
    ? requests.filter(r => user.serviceCategories?.includes(r.type))
    : requests.filter(r => {
        if (r.type === filter) return true;
        const mappedCat = MENU_CATEGORIES.find(c => c.id === filter);
        if (mappedCat && mappedCat.services.includes(r.service)) return true;
        return false;
      });

  // Exclude expired requests from all views
  filteredRequests = filteredRequests.filter(r => {
    const isCompleted = r.status === 'completed' || r.status === 'confirmed';
    const isExpired = Math.max(0, r.expiresAt - now) === 0 && !isCompleted;
    return !isExpired;
  });

  if (statusFilter !== 'all') {
    filteredRequests = filteredRequests.filter(r => {
      if (statusFilter === 'live') return r.status === 'live';
      if (statusFilter === 'completed') return r.status === 'completed' || r.status === 'confirmed';
      return true;
    });
  }

  if (user?.type === 'vendor' && cityFilter !== 'all') {
    filteredRequests = filteredRequests.filter(r => r.location === cityFilter);
  }

  // Pin current user's active/confirmed requests to the top
  const pinnedRequests = filteredRequests.filter(r => r.clientId === user?.id && (r.status === 'live' || r.status === 'confirmed' || r.status === 'completed'));
  const otherRequests = filteredRequests.filter(r => r.clientId !== user?.id || (r.clientId === user?.id && r.status !== 'live' && r.status !== 'confirmed' && r.status !== 'completed'));

  return (
    <section className="bg-neutral-50 min-h-screen">
      {/* Header Controls */}
      <div className="sticky top-16 z-20 bg-white border-b border-neutral-200 shadow-sm py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between gap-4 w-full">
          {/* Top Row: Title & Status Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-2.5 h-2.5 bg-error rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              <h2 className="text-xl font-bold text-primary-500 uppercase flex items-center gap-2">
                <span className="tracking-widest">{t.live}</span>
                <span className="text-[10px] bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">{filteredRequests.length}</span>
              </h2>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              {user?.type === 'vendor' && (
                <div className="w-full sm:w-48 z-20">
                  <CitySelect
                    value={cityFilter}
                    onChange={setCityFilter}
                    variant="filter"
                    allowAll={true}
                  />
                </div>
              )}
              
              <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 overflow-x-auto scrollbar-none w-full sm:w-auto self-start sm:self-auto">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={cn("flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-bold transition-all uppercase tracking-wider whitespace-nowrap", statusFilter === 'all' ? "bg-white text-neutral-800 shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-700")}
                >
                  {language === 'ar' ? 'جميع الطلبات' : 'All Requests'}
                </button>
                <button
                  onClick={() => setStatusFilter('live')}
                  className={cn("flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-bold transition-all uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-1.5", statusFilter === 'live' ? "bg-white text-error shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-700")}
                >
                  <Flame className="w-3 h-3" />
                  {language === 'ar' ? 'النشطة' : 'Live'}
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={cn("flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-bold transition-all uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-1.5", statusFilter === 'completed' ? "bg-white text-success shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-700")}
                >
                  <CheckCircle className="w-3 h-3" />
                  {language === 'ar' ? 'المكتملة' : 'Completed'}
                </button>
              </div>
            </div>
          </div>

          <div className="w-full h-[1px] bg-neutral-100 hidden md:block"></div>

          {/* Bottom Row: Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-4 py-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap uppercase tracking-wider ${
                  filter === cat.id
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-white text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="max-w-4xl mx-auto pt-6 pb-24 px-4 sm:px-6">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
            <div className="w-16 h-16 mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
               <Search className="w-8 h-8 text-neutral-300" />
            </div>
            <p className="text-base font-bold tracking-wide uppercase">{t.noRequests}</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {/* Pinned Section */}
            {pinnedRequests.length > 0 && (
              <div className="space-y-4 mb-2">
                <div className="px-4 py-2.5 bg-primary-100/50 rounded-lg flex items-center gap-2 border border-primary-200/50">
                   <div className="w-2 h-2 bg-primary-500 rounded-full animate-ping" />
                   <span className="text-xs font-black text-primary-700 uppercase tracking-widest">{language === 'ar' ? 'طلباتك' : 'Your Requests'}</span>
                </div>
                <AnimatePresence initial={false}>
                  {pinnedRequests.map((request) => (
                    <TickerRow key={request.id} request={request} t={t} language={language} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Main Feed Section */}
            <AnimatePresence initial={false}>
              {otherRequests.map((request) => (
                <TickerRow key={request.id} request={request} t={t} language={language} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

