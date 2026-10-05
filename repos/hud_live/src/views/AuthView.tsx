import React, { useState } from 'react';
import { useAuthStore, UserType, UserProfile } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { translations } from '../lib/translations';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, CheckCircle2, ChevronRight, ChevronLeft, Building2, User, Mail, MapPin, FileText, Loader2, Heart, Briefcase, Gift, GraduationCap, Building, UtensilsCrossed, Truck, Music, Home, Package, PartyPopper, Palmtree, Utensils, CookingPot, Coffee, Shield, Scissors, Sparkles, Globe, Image as ImageIcon, X, Plus, Key, LogIn, UserPlus } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { EVENT_TYPES } from '../lib/constants';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import PortfolioManager from '../components/PortfolioManager';
import CitySelect from '../components/CitySelect';

const ICON_MAP: Record<string, any> = {
  // ... (keep icon map as is)
  wedding: Heart,
  engagement: PartyPopper,
  corporate: Briefcase,
  birthday: Gift,
  graduation: GraduationCap,
  exhibition: Building,
  c_venues: MapPin,
  rest_houses: Palmtree,
  c_productive_families: Home,
  c_catering_hospitality: UtensilsCrossed,
  buffet: Utensils,
  banquets: CookingPot,
  coffee_servers: Coffee,
  c_equipment_decoration: Package,
  c_logistics_organization: Truck,
  security_guards: Shield,
  c_entertainment: Music,
  c_printing_invitations: FileText,
  dress_design: Scissors,
  hairdressers: Scissors,
  women_salons: Sparkles
};

type AuthMode = 'login' | 'register' | 'forgot_password';

export default function AuthView() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const { setUser } = useAuthStore();
  const navigate = useNavigate();
  
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [step, setStep] = useState(0); // 0 = Selection, 1 = Auth Form, 2 = OTP, 3 = Complete Profile
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [userType, setUserType] = useState<UserType>('client');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const formatPhoneForFirebase = (p: string) => `+966${p}`;
  const formatEmailForAuth = (p: string) => `${p}@auth.hudhudbot.ksa`;

  const handleLogin = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const emailAuth = formatEmailForAuth(phone);
      const userCredential = await signInWithEmailAndPassword(auth, emailAuth, password);
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        const profileData = userDoc.data();
        setUser({
          id: userCredential.user.uid,
          phone: profileData.phone,
          name: profileData.fullName,
          email: profileData.email,
          type: profileData.role,
          city: profileData.city,
          crNumber: profileData.crNumber,
          serviceCategories: profileData.serviceCategories,
          photoURL: profileData.photoURL,
          portfolio: profileData.portfolio,
          isVerified: profileData.isVerified,
          subscription: profileData.subscription,
          isBanned: profileData.isBanned
        } as UserProfile);
        navigate('/');
      } else {
        // This shouldn't happen if they have an auth account but no firestore doc
        setError(t.phoneNotFound);
        await signOut(auth);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setError(t.phoneNotFound);
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(t.invalidPassword);
      } else {
        setError(language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleRegisterStart = async () => {
    setIsBusy(true);
    setError(null);
    try {
      if (!phone.startsWith('5')) {
        throw new Error(language === 'ar' ? 'رقم الجوال يجب أن يبدأ بـ 5' : 'Phone number must start with 5');
      }
      
      const formattedPhone = formatPhoneForFirebase(phone);
      
      // Send OTP via backend
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: formattedPhone,
          checkExists: authMode === 'forgot_password'
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError(language === 'ar' ? 'الرقم غير مسجل' : 'Phone number not registered');
          return;
        }
        const text = await response.text();
        let data: any = {};
        try { data = text ? JSON.parse(text) : {}; } catch (e) {}
        console.error("OTP send failed:", { status: response.status, text, data });
        throw new Error(data.error || (text ? `Server Response: ${text}` : 'Failed to send OTP'));
      }

      setStep(2); // Go to OTP verification
    } catch (err: any) {
      console.error(err);
      // Display the actual error message from the backend if available
      const errMsg = err.message || (language === 'ar' ? 'فشل إرسال الرمز. يرجى التأكد من الرقم والمحاولة مرة أخرى.' : 'Failed to send code. Please check number and try again.');
      setError(`Error: ${errMsg}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const code = otp.join('');
      const formattedPhone = formatPhoneForFirebase(phone);

      if (authMode === 'forgot_password') {
        // Skip Twilio validation here because Twilio only allows completing a verification check ONCE.
        // If we verify it here, the reset-password backend call will fail with a 404.
        // Instead, just move to step 3. The reset-password call will both verify the code and change the password.
        if (code.length === 6) {
          setStep(3);
        } else {
          setError(language === 'ar' ? 'الرمز غير صحيح.' : 'Invalid code.');
        }
        setIsBusy(false);
        return;
      }

      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, code })
      });

      const text = await response.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) {}
      
      if (!response.ok) {
        throw new Error(data.error || text || 'Verification failed');
      }
      if (data.valid) {
        setStep(3); // Go to Profile completion
      } else {
        setError(language === 'ar' ? 'الرمز غير صحيح.' : 'Invalid code.');
      }
    } catch (err: any) {
      console.error(err);
      setError(language === 'ar' ? 'حدث خطأ أثناء التحقق.' : 'Error during verification.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const formattedPhone = formatPhoneForFirebase(phone);
      const code = otp.join('');

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, code, newPassword: password })
      });

      if (!response.ok) {
        const text = await response.text();
        let data: any = {};
        try { data = text ? JSON.parse(text) : {}; } catch (e) {}
        throw new Error(data.error || text || 'Failed to reset password');
      }

      setAuthMode('login');
      setStep(1);
      setPassword('');
      setError(language === 'ar' ? 'تم إعادة تعيين كلمة المرور بنجاح. يرجى تسجيل الدخول.' : 'Password reset successfully. Please login.');
    } catch (err: any) {
      console.error(err);
      setError(`Error: ${err.message || 'Failed to reset password'}`);
      if (err.message && (err.message.toLowerCase().includes('invalid code') || err.message.toLowerCase().includes('not found'))) {
        setStep(2);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleCompleteRegistration = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const emailAuth = formatEmailForAuth(phone);
      
      let uid = '';
      try {
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, emailAuth, password);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            // Recover from partial registration: Auth exists but Firestore profile failed previously
            const loginCredential = await signInWithEmailAndPassword(auth, emailAuth, password);
            uid = loginCredential.user.uid;
          } catch (loginErr) {
            // Fallback to original already-in-use error if password doesn't match
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      const profileData = {
        uid: uid,
        role: userType,
        fullName: name,
        email: email,
        phone: formatPhoneForFirebase(phone),
        city: city,
        createdAt: serverTimestamp(),
        ...(userType === 'vendor' ? {
          crNumber: crNumber,
          website: website,
          portfolio: portfolio, 
          serviceCategories: selectedServices,
          isVerified: false,
          subscription: {
            status: 'pending_approval',
            endsAt: 0
          }
        } : {})
      };

      await setDoc(doc(db, 'users', uid), profileData);
      
      setUser({
        id: uid,
        phone: profileData.phone,
        name: profileData.fullName,
        email: profileData.email,
        type: profileData.role,
        city: profileData.city,
        crNumber: crNumber,
        serviceCategories: selectedServices,
        website: website,
        portfolio: portfolio,
        isVerified: false,
        ...(userType === 'vendor' ? {
          subscription: {
            status: 'pending_approval',
            endsAt: 0
          }
        } : {})
      } as UserProfile);
      
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError(t.phoneAlreadyExists);
      } else {
        setError(`Error: ${err.message || 'Failed to save profile'}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const updateOtp = (val: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  // ... (keep toggleService and handleFileUpload)
  const toggleService = (service: string) => {
    setSelectedServices(prev => {
      if (prev.includes(service)) {
        return prev.filter(s => s !== service);
      } else {
        if (prev.length >= 3) return prev;
        return [...prev, service];
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (portfolio.length + files.length > 5) {
      setError(language === 'ar' ? 'يمكنك رفع 5 صور بحد أقصى' : 'You can upload a maximum of 5 photos');
      return;
    }
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPortfolio(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPortfolio(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex items-center justify-center p-4 pt-12 pb-32 md:pb-12">
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[500px] bg-white border border-neutral-300 rounded-base p-8 shadow-md"
      >
        <div className="flex flex-col items-center mb-8 relative">
          {step > 0 && (
            <button 
              onClick={() => { setStep(0); setAuthMode('login'); setError(null); }} 
              className={cn("absolute top-0 p-2 text-neutral-400 hover:text-neutral-600 transition-colors", language === 'ar' ? "-right-4" : "-left-4")}
              title={language === 'ar' ? 'العودة' : 'Go back'}
            >
              {language === 'ar' ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
            </button>
          )}
          <div className="w-16 h-16 bg-[#1e3a8a] rounded-base flex items-center justify-center mb-4">
            <span className="text-white font-bold text-3xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-500 mb-1">
            {language === 'ar' ? 'هدهد لايف' : 'Hudhud Live'}
          </h1>
          <h2 className="text-lg font-bold text-neutral-500 text-center">
            {step === 0 
              ? (language === 'ar' ? 'مرحباً بك في هدهد، الرجاء تحديد نوع حسابك' : 'Welcome to Hudhud, Please select account type')
              : step === 3 
                ? (authMode === 'forgot_password' ? (language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password') : t.completeProfile) 
                : (authMode === 'login' ? `${userType === 'client' ? t.client : t.vendor} - ${t.login}` 
                  : (authMode === 'register' ? `${userType === 'client' ? t.client : t.vendor} - ${t.register}` : (language === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password')))}
          </h2>
          
          {step === 1 && authMode !== 'forgot_password' && (
            <div className="flex mt-6 w-full gap-2 p-1 bg-neutral-100 rounded-sm">
              <button 
                onClick={() => { setAuthMode('login'); setError(null); }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold uppercase transition-all rounded-sm flex items-center justify-center gap-2",
                  authMode === 'login' ? "bg-white text-primary-500 shadow-sm" : "text-neutral-500 hover:text-primary-500"
                )}
              >
                <LogIn className="w-3.5 h-3.5" />
                {t.login}
              </button>
              <button 
                onClick={() => { setAuthMode('register'); setError(null); }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold uppercase transition-all rounded-sm flex items-center justify-center gap-2",
                  authMode === 'register' ? "bg-white text-primary-500 shadow-sm" : "text-neutral-500 hover:text-primary-500"
                )}
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t.register}
              </button>
            </div>
          )}
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 bg-error/10 border border-error/20 rounded-sm text-error text-sm font-bold text-center"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <button
                onClick={() => { setUserType('client'); setStep(1); }}
                className="w-full bg-white border border-neutral-300 hover:border-primary-500 hover:shadow-sm p-6 rounded-sm text-left flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-sm bg-neutral-100 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <User className="w-6 h-6 text-neutral-500 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900 group-hover:text-primary-500 transition-colors">{t.client}</h3>
                    <p className="text-sm text-neutral-500">{language === 'ar' ? 'أبحث عن خدمات وفعاليات' : 'Looking for services & events'}</p>
                  </div>
                </div>
                {language === 'ar' ? <ChevronLeft className="w-5 h-5 text-neutral-400 group-hover:text-primary-500" /> : <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-primary-500" />}
              </button>

              <button
                onClick={() => { setUserType('vendor'); setStep(1); }}
                className="w-full bg-white border border-neutral-300 hover:border-primary-500 hover:shadow-sm p-6 rounded-sm text-left flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-sm bg-neutral-100 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <Building2 className="w-6 h-6 text-neutral-500 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900 group-hover:text-primary-500 transition-colors">{t.vendor}</h3>
                    <p className="text-sm text-neutral-500">{language === 'ar' ? 'أقدم خدمات للفعاليات' : 'Providing event services'}</p>
                  </div>
                </div>
                {language === 'ar' ? <ChevronLeft className="w-5 h-5 text-neutral-400 group-hover:text-primary-500" /> : <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-primary-500" />}
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">

              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-2 uppercase tracking-widest">{t.phone}</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-neutral-500 text-sm font-medium border-r pr-2 border-neutral-300" dir="ltr">
                    <Phone className="w-4 h-4" />
                    <span>+966</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="5X XXX XXXX"
                    dir="ltr"
                    className={cn(
                      "w-full h-12 border border-neutral-300 rounded-sm focus:border-primary-500 outline-none transition-colors font-mono tracking-widest",
                      language === 'ar' ? "pr-4 pl-24 text-right" : "pl-24 pr-4 text-left"
                    )}
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.startsWith('966')) val = val.substring(3);
                      if (val.startsWith('0')) val = val.substring(1);
                      setPhone(val.substring(0, 9));
                    }}
                  />
                </div>
              </div>

              {authMode === 'login' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-2 uppercase tracking-widest">{t.password}</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Key className="w-4 h-4 text-neutral-300" />
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full h-12 pl-10 pr-4 border border-neutral-300 rounded-sm focus:border-primary-500 outline-none transition-colors"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end mt-2">
                    <button 
                      onClick={() => { setAuthMode('forgot_password'); setError(null); }}
                      className="text-xs text-primary-500 font-bold hover:underline"
                    >
                      {language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                    </button>
                  </div>
                </div>
              )}

              <button
                disabled={phone.length < 9 || (authMode === 'login' && !password) || isBusy}
                onClick={authMode === 'login' ? handleLogin : handleRegisterStart}
                className="w-full h-12 bg-primary-500 text-white rounded-sm font-bold flex items-center justify-center gap-2 disabled:bg-neutral-300 disabled:cursor-not-allowed hover:bg-primary-600 transition-all active:scale-95"
              >
                {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>{authMode === 'login' ? t.loginAction : (authMode === 'register' ? (language === 'ar' ? 'بدء التسجيل' : 'Start Registration') : (language === 'ar' ? 'إرسال الرمز' : 'Send Code'))}</span>
                    {language === 'ar' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </>
                )}
              </button>
              {authMode === 'register' && (
                <p className="mt-4 text-center text-[10px] text-neutral-400 leading-relaxed font-bold">
                  {language === 'ar' ? 'بالضغط على بدء التسجيل، أنت توافق على ' : 'By clicking start registration, you agree to our '}
                  <a href="/terms" target="_blank" className="text-primary-500 hover:underline">{language === 'ar' ? 'الشروط والخصوصية' : 'Terms and Privacy Policy'}</a>
                </p>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-neutral-500 mb-2 font-medium">
                  {language === 'ar' ? 'تم إرسال رمز الأمان إلى' : 'Security code sent to'} <span className="font-bold text-primary-500" dir="ltr">+966 {phone}</span>
                </p>
                <button onClick={() => setStep(1)} className="text-xs text-primary-500 font-bold underline">
                  {language === 'ar' ? 'تعديل الرقم' : 'Edit Number'}
                </button>
              </div>

              <div className="flex justify-between gap-2" dir="ltr">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    maxLength={1}
                    className="w-full h-12 text-center border-b-2 border-neutral-300 focus:border-primary-500 outline-none font-bold text-xl transition-colors bg-neutral-50"
                    value={digit}
                    onChange={(e) => updateOtp(e.target.value, i)}
                  />
                ))}
              </div>

              <button
                disabled={otp.join('').length < 6 || isBusy}
                onClick={handleVerifyOtp}
                className="w-full h-12 bg-primary-500 text-white rounded-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-600 disabled:bg-neutral-300 transition-colors"
              >
                {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {t.verify}
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">{t.setYourPassword} *</label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Key className="w-4 h-4 text-neutral-300" />
                  </div>
                  <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full h-11 pr-10 pl-4 border border-neutral-300 rounded-sm focus:border-primary-500 outline-none font-medium text-sm" placeholder="••••••••" />
                </div>
              </div>

              {/* Common Fields */}
              {authMode !== 'forgot_password' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">{userType === 'client' ? t.fullName : t.companyName} *</label>
                    <div className="relative">
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {userType === 'client' ? <User className="w-4 h-4 text-neutral-300" /> : <Building2 className="w-4 h-4 text-neutral-300" />}
                      </div>
                      <input type="text" value={name} onChange={(e)=>setName(e.target.value)} className="w-full h-11 pr-10 pl-4 border border-neutral-300 rounded-sm focus:border-primary-500 outline-none font-medium text-sm" placeholder={userType === 'client' ? "John Doe" : "Hudhud Events Ltd."} />
                    </div>
                  </div>

                  {/* ... (keep other registration fields from original AuthView) ... */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">{t.email}</label>
                    <div className="relative">
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Mail className="w-4 h-4 text-neutral-300" />
                      </div>
                      <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full h-11 pr-10 pl-4 border border-neutral-300 rounded-sm focus:border-primary-500 outline-none font-medium text-sm" placeholder="contact@example.com" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">{t.city} *</label>
                    <CitySelect
                      value={city}
                      onChange={setCity}
                      variant="auth"
                    />
                  </div>

                  {userType === 'vendor' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">{t.crNumber} *</label>
                        <input type="text" value={crNumber} onChange={(e)=>setCrNumber(e.target.value.replace(/\D/g, '').slice(0,10))} className="w-full h-11 px-4 border border-neutral-300 rounded-sm focus:border-primary-500 outline-none font-medium text-sm text-left tracking-widest" placeholder="1010XXXXXX" dir="ltr" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">{language === 'ar' ? 'تخصصات المناسبات' : 'Event Specialties'} ({language === 'ar' ? '3 كحد أقصى' : 'Max 3'})</label>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-sm font-black uppercase", selectedServices.length === 3 ? "bg-success/10 text-success" : "bg-neutral-100 text-neutral-500")}>
                             {selectedServices.length}/3
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-1 border border-neutral-100 rounded-sm">
                          {EVENT_TYPES.map((type) => (
                            <div 
                              key={type}
                              onClick={() => toggleService(type)}
                              className={cn(
                                "border p-2 rounded-sm flex items-center gap-2 cursor-pointer transition-all text-[9px] font-bold uppercase",
                                selectedServices.includes(type) ? "bg-primary-50 border-primary-500 text-primary-500" : "bg-white border-neutral-200 text-neutral-500"
                              )}
                            >
                              <span className="truncate">{t[type as keyof typeof t] || type}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 mt-2 border-t border-neutral-50">
                        <PortfolioManager images={portfolio} onChange={setPortfolio} />
                      </div>
                    </>
                  )}
                </>
              )}

              <button
                disabled={!password || password.length < 6 || isBusy}
                onClick={authMode === 'forgot_password' ? handleResetPassword : handleCompleteRegistration}
                className="w-full h-12 mt-4 bg-primary-500 text-white rounded-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-600 disabled:bg-neutral-300 transition-colors shadow-base"
              >
                {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {authMode === 'forgot_password' ? (language === 'ar' ? 'حفظ' : 'Save') : t.registerAction}
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {step === 1 && (
          <div className="mt-8 pt-6 border-t border-neutral-100 text-center">
            {authMode === 'forgot_password' ? (
              <button 
                onClick={() => { setAuthMode('login'); setError(null); }}
                className="text-xs font-bold text-neutral-500 hover:text-primary-500 transition-colors uppercase tracking-widest"
              >
                {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
              </button>
            ) : (
              <button 
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(null); }}
                className="text-xs font-bold text-neutral-500 hover:text-primary-500 transition-colors uppercase tracking-widest"
              >
                {authMode === 'login' ? t.notRegistered : t.alreadyRegistered}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
