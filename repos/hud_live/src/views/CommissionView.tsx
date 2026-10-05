import React from 'react';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAppConfig } from '../store/useAppConfig';
import { motion } from 'motion/react';
import { ShieldCheck, Landmark } from 'lucide-react';
import { translations } from '../lib/translations';

export default function CommissionView() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const { config } = useAppConfig();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 pb-32 md:pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden"
      >
        <div className="bg-primary-500 text-white p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShieldCheck className="w-48 h-48" />
          </div>
          <div className="relative z-10 hidden sm:flex items-center justify-center mb-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <Landmark className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-4 relative z-10">{t.platformCommission}</h1>
          <p className="text-lg relative z-10 max-w-2xl mx-auto leading-relaxed font-medium">
            {t.commissionDesc}
          </p>
        </div>

        <div className="p-8 sm:p-12">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-neutral-800 mb-6 flex items-center gap-3">
              <Landmark className="w-6 h-6 text-primary-500" />
              {t.bankAccounts}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {config.bankAccounts?.map((bank, i) => (
                <div key={bank.id || `bank-${i}`} className="p-6 bg-neutral-50 border border-neutral-200 rounded-lg shadow-sm hover:border-primary-300 transition-colors">
                  <h4 className="font-black text-xl text-primary-700 mb-4 pb-3 border-b border-neutral-200">
                    {language === 'ar' ? bank.bankNameAr : bank.bankNameEn}
                  </h4>
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-1">
                        {language === 'ar' ? 'اسم الحساب' : 'Account Name'}
                      </span>
                      <span className="text-neutral-900 font-medium">{bank.accountName}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-1">
                        {language === 'ar' ? 'رقم الحساب' : 'Account Number'}
                      </span>
                      <span className="text-neutral-900 font-mono font-medium">{bank.accountNumber}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-widest text-neutral-500 font-bold mb-1">
                        {language === 'ar' ? 'الآيبان (IBAN)' : 'IBAN'}
                      </span>
                      <span className="text-neutral-900 font-mono font-medium">{bank.iban}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!config.bankAccounts?.length && (
                <div className="col-span-full p-8 text-center text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg">
                  {language === 'ar' ? 'لا توجد حسابات بنكية مضافة حالياً.' : 'No bank accounts added yet.'}
                </div>
              )}
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 flex gap-4">
            <ShieldCheck className="w-6 h-6 text-warning shrink-0" />
            <div>
              <h3 className="font-bold text-neutral-800 mb-2">
                {language === 'ar' ? 'إبراء الذمة' : 'Honoring the Pledge'}
              </h3>
              <p className="text-neutral-600 text-sm leading-relaxed">
                {language === 'ar' 
                  ? 'نشكر لك ثقتك بمنصتنا واستخدامك لها للوصول إلى أفضل مزودي الخدمات. تحويلك للعمولة فور الاتفاق يساعدنا على الاستمرار في تقديم خدمة مميزة وتحسين المنصة بشكل مستمر.' 
                  : 'Thank you for trusting our platform to find the best service providers. Transferring the commission upon agreement helps us continue providing excellent service and improving our platform.'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
