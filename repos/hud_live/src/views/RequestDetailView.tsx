import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguageStore } from '../store/useLanguageStore';
import { translations } from '../lib/translations';
import { useAuthStore } from '../store/useAuthStore';
import { Request, Bid } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, MapPin, Calendar, Users, Star, CheckCircle, ChevronLeft, ChevronRight, DollarSign, Loader2, Globe, Image as ImageIcon, ExternalLink, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, increment, updateDoc, Timestamp } from 'firebase/firestore';
import { checkContentForContactInfo, ModerationResult } from '../services/moderationService';
import { getCityName } from '../lib/cities';
import { Shield, MessageCircle, AlertTriangle } from 'lucide-react';

export default function RequestDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const t = translations[language];
  const { user } = useAuthStore();
  
  const [request, setRequest] = useState<Request | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidPrice, setBidPrice] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [moderationError, setModerationError] = useState<ModerationResult | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedBidId, setExpandedBidId] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [bidToAccept, setBidToAccept] = useState<string | null>(null);
  const [bidToReject, setBidToReject] = useState<string | null>(null);
  const [reportingBidId, setReportingBidId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

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

  // Check if the current vendor has already placed a bid
  const hasVendorBid = user?.type === 'vendor' && bids.some(bid => bid.vendorId === user.id);

  useEffect(() => {
    if (!id) return;

    // Single fetch for request details
    const fetchRequest = async () => {
      try {
        const docRef = doc(db, 'requests', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const reqData = docSnap.data() as Request;
          setRequest({ id: docSnap.id, ...reqData });
          
          // Clear notification flag if the owner views it
          if (user?.id === reqData.clientId && reqData.hasUnreadBids) {
            await updateDoc(docRef, { hasUnreadBids: false });
          }
        } else {
          console.error("No such request!");
        }
      } catch (error) {
        console.error("Error fetching request:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequest();

    // Real-time listener for bids
    const bidsQuery = query(
      collection(db, 'requests', id, 'bids'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(bidsQuery, (snapshot) => {
      const bidsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bid[];
      setBids(bidsData);
    }, (error) => {
      console.error("Request Detail Bids Fetch Error:", error);
    });

    return () => unsubscribe();
  }, [id]);

  const handlePlaceBid = async () => {
    setModerationError(null);
    if (remarks.trim()) {
      setIsModerating(true);
      try {
        const modResult = await checkContentForContactInfo(remarks);
        if (!modResult.isSafe) {
          setModerationError(modResult);
          return;
        }
      } catch (e) {
        console.error("Mod Check Error:", e);
      } finally {
        setIsModerating(false);
      }
    }
    setIsConfirmingSubmit(true);
  };

  const handlePlaceBidReal = async () => {
    if (!user || !id || !request) return;
    setIsSubmitting(true);
    
    try {
      // 1. Add the bid to the subcollection
      await addDoc(collection(db, 'requests', id, 'bids'), {
        vendorId: user.id,
        clientId: request.clientId,
        vendorName: user.name,
        vendorRating: 4.8, 
        vendorWebsite: user.website || '',
        vendorPortfolio: user.portfolio || [],
        amount: parseInt(bidPrice),
        remarks: remarks.trim(),
        requestId: id,
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      // 2. Increment vendor count and set notification state on the request
      await updateDoc(doc(db, 'requests', id), {
        vendorCount: increment(1),
        hasUnreadBids: true
      });

      setIsBidding(false);
      setIsConfirmingSubmit(false);
      setBidPrice('');
      setRemarks('');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);
    } catch (error) {
      console.error("Error placing bid:", error);
      alert(language === 'ar' ? 'فشل في تقديم العرض.' : 'Failed to place bid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBidStatus = async (bidId: string, status: 'accepted' | 'rejected') => {
    if (!id) return;
    try {
      const bidRef = doc(db, 'requests', id, 'bids', bidId);
      await updateDoc(bidRef, { 
        status,
        isReadByVendor: false
      });
      
      if (status === 'accepted') {
        const requestRef = doc(db, 'requests', id);
        await updateDoc(requestRef, { status: 'confirmed' });
      }
    } catch (error) {
      console.error("Update Status Error:", error);
    }
  };

  if (!request) return <div className="p-12 text-center text-neutral-300">Loading...</div>;

  const isExpired = Math.max(0, request.expiresAt - Date.now()) === 0 && request.status !== 'completed' && request.status !== 'confirmed';

  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-32">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-neutral-500 font-bold mb-6 hover:text-primary-500 transition-all"
      >
        {language === 'ar' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        {language === 'ar' ? 'العودة' : 'Back'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Request Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-neutral-300 rounded-base p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-xs font-bold text-accent-500 uppercase tracking-widest block mb-2">
                  {t[request.type as keyof typeof t] || request.type}
                </span>
                <p className="text-lg text-primary-500 leading-relaxed font-medium">
                  {language === 'ar' ? request.title : request.titleEn}
                </p>
              </div>
              <div className="bg-primary-50 text-primary-500 px-4 py-2 rounded-sm font-bold text-sm">
                {request.budget} {t.sar}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8 text-neutral-500">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-neutral-300" />
                <div>
                  <span className="text-xs block text-neutral-300">{t.location}</span>
                  <span className="text-sm font-medium">{getCityName(request.location, language)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-neutral-300" />
                <div>
                  <span className="text-xs block text-neutral-300">{t.date}</span>
                  <span className="text-sm font-medium">{request.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-neutral-300" />
                <div>
                  <span className="text-xs block text-neutral-300">{t.guests}</span>
                  <span className="text-sm font-medium">{request.guests}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-neutral-100 text-neutral-500 text-xs font-bold rounded-sm uppercase">
                {t[request.type.toLowerCase() as keyof typeof t] || request.type}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="w-px flex-1 h-px bg-neutral-300" />
             <span className="text-xs font-bold text-neutral-300 uppercase">{t.bids} ({bids.length})</span>
             <div className="w-px flex-1 h-px bg-neutral-300" />
          </div>

          {/* Bids List */}
          <div className="space-y-4">
            <AnimatePresence>
              {bids.map(bid => (
                <div key={bid.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-neutral-300 rounded-base p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-neutral-100 rounded-sm flex items-center justify-center overflow-hidden border border-neutral-200">
                        {bid.vendorPortfolio && bid.vendorPortfolio.length > 0 ? (
                          <img src={bid.vendorPortfolio[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Users className="w-6 h-6 text-neutral-300" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-primary-500">{bid.vendorName}</h4>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-accent-500 fill-accent-500" />
                            <span className="text-xs font-bold text-neutral-500">{bid.vendorRating || 4.8}</span>
                          </div>
                          {bid.vendorWebsite && (
                            <a 
                              href={bid.vendorWebsite} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-primary-500 hover:underline font-bold"
                            >
                              <Globe className="w-3 h-3" />
                              {language === 'ar' ? 'الموقع' : 'Website'}
                            </a>
                          )}
                          {bid.vendorPortfolio && bid.vendorPortfolio.length > 0 && (
                            <button 
                              onClick={() => setExpandedBidId(expandedBidId === bid.id ? null : bid.id)}
                              className="text-[10px] font-bold text-accent-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                              {t.viewPortfolio}
                              <ChevronRight className={cn("w-3 h-3 transition-transform", expandedBidId === bid.id ? "rotate-90" : "")} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">
                      {bid.vendorPortfolio?.slice(0, 3).map((img: string, idx: number) => (
                        <div key={idx} className="w-10 h-10 rounded-xs border border-neutral-200 overflow-hidden shrink-0 grayscale hover:grayscale-0 transition-all cursor-pointer" onClick={() => setExpandedBidId(bid.id)}>
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {bid.vendorPortfolio && bid.vendorPortfolio.length > 3 && (
                        <div className="w-10 h-10 rounded-xs bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-400 border border-neutral-200">
                          +{bid.vendorPortfolio.length - 3}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-8">
                      <div className="text-end">
                        <span className="text-xs text-neutral-300 block">{t.budget}</span>
                        <span className="text-lg font-bold text-primary-500">{bid.amount} {t.sar}</span>
                      </div>
                      {user?.type === 'client' && user.id === request.clientId && bid.status === 'pending' && !isExpired && (
                        <div className="flex gap-2">
                           <button 
                             onClick={() => setBidToAccept(bid.id)}
                             className="h-10 px-6 bg-primary-500 text-white rounded-sm font-bold text-sm shadow-sm hover:bg-primary-600 transition-colors"
                           >
                             {t.select}
                           </button>
                           <button 
                             onClick={() => setBidToReject(bid.id)}
                             className="h-10 px-4 bg-neutral-100 text-neutral-400 rounded-sm font-bold text-xs hover:bg-neutral-200 transition-colors"
                           >
                             {language === 'ar' ? 'رفض' : 'Reject'}
                           </button>
                           <button 
                             onClick={() => setReportingBidId(bid.id)}
                             className="h-10 px-4 bg-error hover:bg-error/90 text-white rounded-sm transition-colors text-xs font-bold flex items-center gap-1.5"
                           >
                             <AlertTriangle className="w-4 h-4" /> {language === 'ar' ? 'إبلاغ' : 'Report'}
                           </button>
                        </div>
                      )}
                      {bid.status === 'pending' && isExpired && (
                         <div className="px-4 py-1.5 rounded-sm text-xs font-bold uppercase border bg-neutral-100 border-neutral-300 text-neutral-500">
                           {language === 'ar' ? 'منتهي الصلاحية' : 'Expired'}
                         </div>
                      )}
                      {bid.status !== 'pending' && (
                         <div className={cn("px-4 py-1.5 rounded-sm text-xs font-bold uppercase border", 
                            bid.status === 'accepted' ? 'bg-success/10 border-success text-success' : 'bg-error/10 border-error text-error'
                         )}>
                            {t[bid.status as keyof typeof t] || bid.status}
                         </div>
                      )}

                      {/* Report Overlay */}
                      <AnimatePresence>
                        {reportingBidId === bid.id && (
                          <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/95 backdrop-blur-sm p-6 flex flex-col z-20 rounded-base"
                          >
                            <div className="flex justify-between items-center mb-4">
                              <h5 className="text-sm font-bold text-error uppercase flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> {language === 'ar' ? 'إبلاغ عن مخالفة' : 'Report Violation'}
                              </h5>
                              <button onClick={() => setReportingBidId(null)} className="text-neutral-400 hover:text-neutral-600">
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                            <textarea 
                              value={reportReason}
                              onChange={(e) => setReportReason(e.target.value)}
                              placeholder={language === 'ar' ? 'سبب الإبلاغ...' : 'Reason for reporting...'}
                              className="flex-1 w-full border border-neutral-300 rounded-sm p-3 text-sm outline-none focus:border-error focus:ring-1 focus:ring-error resize-none bg-neutral-50 mb-4"
                            />
                            <button 
                              onClick={() => handleSubmitReport(bid.vendorId)}
                              className="bg-error hover:bg-error/90 text-white h-11 rounded-sm text-sm font-bold uppercase transition-colors"
                            >
                              {language === 'ar' ? 'إرسال البلاغ' : 'Submit Report'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {bidToAccept === bid.id && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 bg-white/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center z-20 rounded-base"
                          >
                            <CheckCircle className="w-12 h-12 text-success mb-3 animate-bounce" />
                            <p className="text-sm font-black text-neutral-800 mb-1.5 uppercase">
                              {language === 'ar' ? 'هل أنت متأكد من قبول هذا العرض؟' : 'Are you sure you want to accept this bid?'}
                            </p>
                            <p className="text-xs text-neutral-500 mb-6 font-bold">
                              {language === 'ar' ? 'سيتم اعتماد هذا العرض للمناسبة.' : 'This bid will be selected for your event.'}
                            </p>
                            <div className="flex gap-3 w-full max-w-xs">
                              <button 
                                onClick={() => setBidToAccept(null)}
                                className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 h-11 rounded-sm text-xs font-bold uppercase transition-colors"
                              >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                              </button>
                              <button 
                                onClick={() => {
                                  handleUpdateBidStatus(bid.id, 'accepted');
                                  setBidToAccept(null);
                                }}
                                className="flex-1 bg-success hover:bg-success/90 text-white h-11 rounded-sm text-xs font-bold uppercase transition-colors"
                              >
                                {language === 'ar' ? 'تأكيد' : 'Confirm'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                        {bidToReject === bid.id && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 bg-white/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center z-20 rounded-base"
                          >
                            <motion.div initial={{ rotate: 0 }} animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                               <X className="w-12 h-12 text-error mb-3" />
                            </motion.div>
                            <p className="text-sm font-black text-neutral-800 mb-1.5 uppercase">
                              {language === 'ar' ? 'هل أنت متأكد من رفض هذا العرض؟' : 'Are you sure you want to reject this bid?'}
                            </p>
                            <div className="flex gap-3 w-full max-w-xs pt-4">
                              <button 
                                onClick={() => setBidToReject(null)}
                                className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 h-11 rounded-sm text-xs font-bold uppercase transition-colors"
                              >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                              </button>
                              <button 
                                onClick={() => {
                                  handleUpdateBidStatus(bid.id, 'rejected');
                                  setBidToReject(null);
                                }}
                                className="flex-1 bg-error hover:bg-error/90 text-white h-11 rounded-sm text-xs font-bold uppercase transition-colors"
                              >
                                {language === 'ar' ? 'تأكيد الرفض' : 'Confirm Reject'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>

                  {/* Expanded Portfolio Section */}
                  <AnimatePresence>
                    {expandedBidId === bid.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-neutral-50/50 border-x border-b border-neutral-300 -mt-4 mb-4 rounded-b-base p-6 pt-10"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                             <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                               <ImageIcon className="w-4 h-4" />
                               {t.workGallery}
                             </h5>
                             <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                {bid.vendorPortfolio?.map((img: string, idx: number) => (
                                  <motion.div 
                                    key={idx} 
                                    whileHover={{ scale: 1.05 }}
                                    onClick={() => setSelectedImage(img)}
                                    className="aspect-square rounded-sm border border-neutral-300 overflow-hidden shadow-sm cursor-zoom-in bg-white"
                                  >
                                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </motion.div>
                                ))}
                             </div>
                          </div>
                          
                          {bid.remarks && (
                            <div>
                              <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">{t.remarks}</h5>
                              <div className="bg-white p-4 rounded-sm border border-neutral-200 italic text-neutral-600 text-sm leading-relaxed">
                                "{bid.remarks}"
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {user?.type === 'vendor' && bid.vendorId === user?.id && bid.status === 'accepted' && (
                     <div className="mt-3 bg-success/10 border border-success/30 text-success-800 p-4 rounded-xl text-center flex flex-col items-center gap-2 shadow-sm relative z-10 w-full mb-4">
                       <CheckCircle className="w-5 h-5 text-success" />
                       <p className="text-sm font-bold leading-relaxed text-success">
                         {language === 'ar' 
                           ? 'مبروك العميل قبل عرضك، إنتظر تواصل العميل معك' 
                           : 'Congratulations! The client accepted your offer. Please wait for them to contact you.'}
                       </p>
                     </div>
                  )}
                </div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-neutral-300 rounded-base p-6 shadow-sm sticky top-24">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-error animate-pulse" />
              <div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase block">{t.timeRemaining}</span>
                <span className="text-xl font-bold text-error">12:34</span>
              </div>
            </div>

            {user?.type === 'vendor' && !isBidding && (
              <>
                {hasVendorBid ? (
                  <div className="bg-success/5 p-4 rounded-sm border border-success/20 flex flex-col items-center justify-center text-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-success" />
                    <span className="text-sm font-bold text-success uppercase tracking-wider">
                      {language === 'ar' ? 'تم تقديم العرض بنجاح' : 'Bid Submitted'}
                    </span>
                    <p className="text-xs text-neutral-500 max-w-[200px]">
                      {language === 'ar' 
                        ? 'لقد قمت بتقديم العرض بنجاح. العرض قيد المراجعة الان.' 
                        : 'You have successfully submitted your bid for this request.'}
                    </p>
                  </div>
                ) : (!user.isVerified || user.subscription?.status === 'pending_approval') ? (
                  <div className="bg-warning/5 p-4 rounded-sm border border-warning/20 flex flex-col items-center justify-center text-center space-y-2">
                    <AlertTriangle className="w-6 h-6 text-warning" />
                    <span className="text-sm font-bold text-warning leading-relaxed">
                      {language === 'ar' 
                        ? 'حسابك بانتظار موافقة الإدارة. ستتمكن من تقديم العروض بعد تفعيل الحساب' 
                        : 'Your profile is awaiting admin approval. You will be able to bid once approved.'}
                    </span>
                  </div>
                ) : (!['active', 'trial'].includes(user.subscription?.status || '') || (user.subscription?.endsAt || 0) < Date.now()) ? (
                  <div className="bg-error/5 p-4 rounded-sm border border-error/20 flex flex-col items-center justify-center text-center space-y-2">
                    <AlertTriangle className="w-6 h-6 text-error" />
                    <span className="text-sm font-bold text-error leading-relaxed">
                      {language === 'ar' 
                        ? 'اشتراكك غير فعال أو منتهي. يرجى تجديد الاشتراك لتتمكن من تقديم العروض.' 
                        : 'Your subscription is inactive or expired. Please renew to bid.'}
                    </span>
                    <Link to="/vendor-dashboard" className="h-10 px-6 bg-error hover:bg-error/90 text-white rounded-sm font-bold text-xs transition-colors mt-2 flex items-center justify-center whitespace-nowrap">
                      {language === 'ar' ? 'تجديد الاشتراك' : 'Renew Subscription'}
                    </Link>
                  </div>
                ) : user.serviceCategories?.includes(request.type) ? (
                  <button 
                    onClick={() => setIsBidding(true)}
                    className="w-full h-12 bg-primary-500 text-white rounded-sm font-bold shadow-md hover:bg-primary-600 transition-colors"
                  >
                    {t.bid}
                  </button>
                ) : (
                  <div className="bg-warning/5 p-4 rounded-sm border border-warning/20">
                    <p className="text-xs text-warning font-bold leading-relaxed">
                      {language === 'ar' 
                        ? 'هذا الطلب خارج تخصصاتك المسجلة. يمكنك المزايدة فقط على الأنواع التي اخترتها عند التسجيل.' 
                        : 'This request is outside your registered specialties. You can only bid on types selected during registration.'}
                    </p>
                  </div>
                )}
              </>
            )}

            {isBidding && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <label className="block text-[11px] font-bold text-primary-600 uppercase mb-2 px-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success"></span>
                    {t.price || 'Price'}
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      inputMode="numeric"
                      value={bidPrice}
                      disabled={isConfirmingSubmit || isSubmitting || isModerating}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setBidPrice(val.slice(0, 6));
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
                  <label className="block text-[11px] font-bold text-primary-600 uppercase mb-2 px-1 flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3" />
                    {language === 'ar' ? 'ملاحظات إضافية' : 'Additional Remarks'}
                    <span className="text-neutral-400 text-[10px] font-normal lowercase">({language === 'ar' ? 'اختياري' : 'optional'})</span>
                  </label>
                  <textarea 
                    value={remarks}
                    disabled={isConfirmingSubmit || isSubmitting || isModerating}
                    onChange={(e) => {
                        setRemarks(e.target.value);
                        setModerationError(null);
                    }}
                    placeholder={language === 'ar' ? 'أضف ملاحظاتك أو توضيحات حول عرضك هنا...' : 'Add your notes or clarifications about your bid here...'}
                    className={cn(
                      "w-full h-24 p-4 bg-white border-2 rounded-xl text-sm font-medium outline-none transition-all resize-none disabled:opacity-50 disabled:bg-neutral-100",
                      moderationError ? "border-error focus:ring-error/20" : "border-neutral-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    )}
                  />
                  {moderationError && (
                    <div className="mt-2 p-3 bg-error/10 border border-error/20 rounded-lg text-[10px] font-bold text-error flex items-center gap-2">
                      <Shield className="w-3 h-3 shrink-0" />
                      <p>
                        {language === 'ar' 
                          ? 'لا يُسمح بمشاركة معلومات الاتصال أو نشر أي محتوى يخص الممنوعات والمخالفات في الملاحظات.' 
                          : 'Sharing contact info or prohibited/illegal content is not allowed in remarks.'}
                        <span className="block mt-0.5 opacity-70">
                          {language === 'ar' ? `تم اكتشاف: ${moderationError.detectedItems.join(', ')}` : `Detected: ${moderationError.detectedItems.join(', ')}`}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                        setIsBidding(false);
                        setIsConfirmingSubmit(false);
                    }}
                    className="flex-1 h-12 bg-neutral-100 text-neutral-500 rounded-sm font-bold"
                  >
                     {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button 
                    disabled={!bidPrice || isSubmitting || isConfirmingSubmit || isModerating}
                    onClick={handlePlaceBid}
                    className="flex-1 h-12 bg-primary-500 text-white rounded-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isModerating ? <Loader2 className="w-5 h-5 animate-spin" /> : t.verify}
                  </button>
                </div>

                <AnimatePresence>
                  {isConfirmingSubmit && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute inset-0 bg-white/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center z-20 rounded-b-base"
                    >
                      <CheckCircle className="w-10 h-10 text-primary-500 mb-3 animate-pulse" />
                      <p className="text-sm font-black text-neutral-800 mb-1.5 uppercase">
                        {language === 'ar' ? 'تأكيد إرسال العرض؟' : 'Confirm Bid Submission?'}
                      </p>
                      <p className="text-xs text-neutral-500 mb-6 font-bold">
                        {language === 'ar' ? 'مبلغ العرض:' : 'Bid Amount:'} <span className="text-success font-black mx-1">{bidPrice}</span> {t.sar}
                      </p>
                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => setIsConfirmingSubmit(false)}
                          className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 h-12 rounded-sm text-[11px] font-bold uppercase transition-colors"
                        >
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button 
                          onClick={handlePlaceBidReal}
                          disabled={isSubmitting}
                          className="flex-1 bg-primary-500 hover:bg-primary-600 text-white h-12 rounded-sm text-[11px] font-bold uppercase transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              {isModerating ? (language === 'ar' ? 'جاري الفحص...' : 'Checking...') : (language === 'ar' ? 'جاري الإرسال...' : 'Sending...')}
                            </>
                          ) : (language === 'ar' ? 'تأكيد' : 'Confirm')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {user?.type !== 'vendor' && (
              <div className="bg-neutral-50 p-4 rounded-sm border border-neutral-200">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {language === 'ar' 
                    ? 'هذا الطلب متاح حالياً للمزايدة من قبل المزودين المعتمدين.' 
                    : 'This request is currently open for bidding by verified vendors.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Image Zoom */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-primary-500/95 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setSelectedImage(null)}
          >
            <motion.button 
              className="absolute top-8 right-8 text-white hover:scale-110 transition-transform p-2 bg-black/20 rounded-full"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-8 h-8" />
            </motion.button>
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-4xl w-full h-[80vh] bg-white rounded-base overflow-hidden shadow-2xl relative cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <img src={selectedImage} alt="Portfolio Detail" className="w-full h-full object-contain bg-neutral-900" referrerPolicy="no-referrer" />
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                 <p className="text-white font-bold text-sm uppercase tracking-widest">{t.workGallery}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] bg-success text-white px-6 py-4 rounded-md shadow-2xl flex items-center gap-3 font-bold"
          >
            <CheckCircle className="w-6 h-6 flex-shrink-0" />
            <p>{language === 'ar' ? 'تم إرسال العرض بنجاح! حظاً موفقاً.' : 'Bid successfully submitted! Good luck.'}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
