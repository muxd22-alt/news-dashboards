import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAppConfig } from '../store/useAppConfig';
import { translations } from '../lib/translations';
import { motion } from 'motion/react';
import { MapPin, Calendar, Loader2, Heart, Briefcase, Gift, GraduationCap, Building, Package, Users, DollarSign, Send, PartyPopper, Palmtree, Home, UtensilsCrossed, Utensils, CookingPot, Coffee, Shield, Truck, Music, FileText, Scissors, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { EVENT_TYPES } from '../lib/constants';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { checkContentForContactInfo, ModerationResult } from '../services/moderationService';
import CitySelect from '../components/CitySelect';

const ICON_MAP: Record<string, any> = {
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

export default function PostRequestView() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const { user } = useAuthStore();
  const { config } = useAppConfig();
  const navigate = useNavigate();
  
  const [isBusy, setIsBusy] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [moderationError, setModerationError] = useState<ModerationResult | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    titleEn: '',
    type: 'wedding',
    location: '',
    date: '',
    guests: '',
    budget: '',
    service: 'other' // Default service since we removed the step
  });

  const [pledgeChecked, setPledgeChecked] = useState(false);

  const isFormValid = formData.title.trim() !== '' && formData.location !== '' && formData.date !== '' && pledgeChecked;

  const handleSubmit = async () => {
    if (!user || !isFormValid) return;
    setIsBusy(true);
    setIsModerating(true);
    setModerationError(null);

    try {
      // AI Moderation Check
      const modResult = await checkContentForContactInfo(formData.title);
      if (!modResult.isSafe) {
        setModerationError(modResult);
        setIsBusy(false);
        setIsModerating(false);
        return;
      }
      setIsModerating(false);

      const requestDurationMs = (config.requestLifespanMinutes || 18) * 60 * 1000;
      const expirationDate = new Timestamp(Math.floor((Date.now() + requestDurationMs) / 1000), 0);
      
      const requestData = {
        clientId: user.id,
        clientName: user.name,
        title: formData.title,
        titleEn: formData.titleEn || formData.title,
        type: formData.type,
        location: formData.location,
        date: formData.date,
        guests: formData.guests || '0',
        budget: formData.budget || 'open',
        service: formData.service,
        status: 'live',
        createdAt: serverTimestamp(),
        expiresAt: expirationDate,
        vendorCount: 0
      };

      await addDoc(collection(db, 'requests'), requestData);
      
      navigate('/');
    } catch (error) {
      console.error("Error adding document: ", error);
      alert(language === 'ar' ? 'فشل في نشر الطلب. يرجى المحاولة مرة أخرى.' : 'Failed to post request. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const typeOptions = EVENT_TYPES;
  const cityOptions = ['riyadh', 'jeddah', 'mecca', 'medina', 'dammam', 'khobar', 'al_ahsa', 'tabuk', 'abha', 'taif'];
  const budgetOptions = ['0 - 5,000', '5,000 - 10,000', '10,000 - 20,000', '20,000 - 50,000', '50,000 - 100,000', '100,000+'];
  const guestsOptions = ['50', '100', '200', '500', '1000', '2000+'];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-32 md:pb-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-primary-500 mb-2">{t.postRequest}</h1>
        <p className="text-neutral-500 font-medium">
          {language === 'ar' ? 'قم بتعبئة تفاصيل طلبك ليتمكن الموردون من تقديم عروضهم' : 'Fill in your request details so vendors can submit their bids'}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-neutral-200 rounded-xl p-6 sm:p-8 shadow-sm flex flex-col gap-8"
      >
        {/* Event Type */}
        <div>
          <label className="block text-sm font-bold text-neutral-800 mb-4">{t.event} <span className="text-error">*</span></label>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {typeOptions.map(type => (
              <button
                key={type}
                onClick={() => setFormData({...formData, type})}
                className={cn(
                  "p-4 border rounded-xl flex flex-col items-center gap-2 transition-all",
                  formData.type === type ? "border-primary-500 bg-primary-50 text-primary-600 shadow-sm ring-2 ring-primary-500/20" : "border-neutral-200 text-neutral-500 hover:border-primary-300 hover:bg-neutral-50"
                )}
              >
                {(() => {
                  const Icon = ICON_MAP[type] || Package;
                  return <Icon className="w-6 h-6" />;
                })()}
                <span className="font-bold text-[10px] uppercase tracking-wider text-center">{t[type as keyof typeof t] || type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Request Description */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-bold text-neutral-800">{t.requestDescription} <span className="text-error">*</span></label>
            <span className={cn("text-[11px] font-bold", formData.title.length >= 140 ? "text-error" : "text-neutral-400")}>
              {formData.title.length} / 140
            </span>
          </div>
          <textarea 
            placeholder={language === 'ar' ? 'اشرح تفاصيل طلبك هنا (بحد أقصى 140 حرف)...' : 'Explain your request details here (max 140 chars)...'}
            className={cn(
              "w-full h-24 p-4 bg-neutral-50 border rounded-xl focus:bg-white outline-none resize-none transition-all text-sm font-medium",
              moderationError ? "border-error focus:border-error focus:ring-error/20" : "border-neutral-200 focus:border-primary-500 focus:ring-primary-500/20"
            )}
            value={formData.title}
            maxLength={140}
            onChange={(e) => {
              setFormData({...formData, title: e.target.value.slice(0, 140)});
              setModerationError(null);
            }}
          />
          {moderationError && (
              <div className="mt-2 p-3 bg-error/10 border border-error/20 rounded-lg text-xs font-bold text-error flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0" />
                <p>
                  {language === 'ar' 
                    ? 'عذراً، لا يُسمح بمشاركة معلومات الاتصال أو نشر أي محتوى يخص الممنوعات والمخالفات في وصف الطلب.' 
                    : 'Sorry, sharing contact information or prohibited/illegal content is not allowed in the request description.'}
                  <span className="block mt-1 opacity-70">
                    {language === 'ar' ? `تم اكتشاف: ${moderationError.detectedItems.join(', ')}` : `Detected: ${moderationError.detectedItems.join(', ')}`}
                  </span>
                </p>
              </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Location */}
          <div>
            <label className="block text-sm font-bold text-neutral-800 mb-2">{t.location} <span className="text-error">*</span></label>
            <CitySelect
              value={formData.location}
              onChange={(city) => setFormData({...formData, location: city})}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-bold text-neutral-800 mb-2">{t.date} <span className="text-error">*</span></label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
              <input 
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="w-full h-14 pl-12 pr-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none font-medium text-sm transition-all text-neutral-700"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
          </div>

          {/* Guests (Optional) */}
          <div>
            <label className="block text-sm font-bold text-neutral-800 mb-2">
              {t.guests} <span className="text-neutral-400 text-xs font-normal">({language === 'ar' ? 'اختياري' : 'Optional'})</span>
            </label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              <select 
                className="w-full h-14 pl-12 pr-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none appearance-none font-medium text-sm transition-all text-neutral-700"
                value={formData.guests}
                onChange={(e) => setFormData({...formData, guests: e.target.value})}
              >
                <option value="">{language === 'ar' ? 'غير محدد' : 'Not specified'}</option>
                {guestsOptions.map(g => (
                  <option key={g} value={g}>{g} {t.guests}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Budget (Optional) */}
          <div>
            <label className="block text-sm font-bold text-neutral-800 mb-2">
              {t.budget} ({t.sar}) <span className="text-neutral-400 text-xs font-normal">({language === 'ar' ? 'اختياري' : 'Optional'})</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              <select 
                className="w-full h-14 pl-12 pr-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none appearance-none font-medium text-sm transition-all text-neutral-700"
                value={formData.budget}
                onChange={(e) => setFormData({...formData, budget: e.target.value})}
              >
                <option value="">{language === 'ar' ? 'ميزانية مفتوحة (غير محدد)' : 'Open budget (Not specified)'}</option>
                {budgetOptions.map(b => (
                  <option key={b} value={b} dir="ltr">{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-8 border-t border-neutral-100 flex flex-col gap-6">
          <div className="flex items-start gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-sm">
            <input 
              type="checkbox" 
              id="pledge" 
              checked={pledgeChecked}
              onChange={(e) => setPledgeChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded-sm border-neutral-300 text-primary-500 focus:ring-primary-500 cursor-pointer"
            />
            <label htmlFor="pledge" className="text-sm text-neutral-700 leading-relaxed cursor-pointer font-medium select-none">
              {t.commissionPledge || (language === 'ar' 
                ? 'أتعهد بدفع عمولة المنصة مبلغ 10 ريال لكل طلب في حال تم الإتفاق مع مزود الخدمة (في ذمتي)'
                : 'I pledge to pay the platform commission of 10 SAR for every request if an agreement is reached with a vendor (on my honor)')}
            </label>
          </div>

          <div className="flex justify-end">
            <button 
              onClick={handleSubmit}
              disabled={!isFormValid || isBusy}
              className="w-full sm:w-auto h-14 px-10 bg-success text-white rounded-sm font-bold flex items-center justify-center gap-2 hover:bg-success/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isModerating ? (language === 'ar' ? 'جاري الفحص...' : 'Checking...') : (language === 'ar' ? 'جاري النشر...' : 'Publishing...')}</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {language === 'ar' ? 'انشر الطلب' : 'Publish Request'}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
