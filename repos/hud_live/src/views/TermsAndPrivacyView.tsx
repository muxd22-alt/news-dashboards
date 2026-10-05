import React, { useState } from 'react';
import { useLanguageStore } from '../store/useLanguageStore';
import { Shield, BookOpen, ChevronRight, ChevronLeft, Phone, MessageCircle, Twitter, Instagram, Youtube, Ghost, Music, Link as LinkIcon, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppConfig } from '../store/useAppConfig';

export default function TermsAndPrivacyView() {
  const { language } = useLanguageStore();
  const { config } = useAppConfig();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  return (
    <div className="bg-neutral-50 p-4 md:p-8 pt-8 pb-32 md:pb-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4 border border-primary-100">
            <Shield className="w-8 h-8 text-primary-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-neutral-900 mb-2">
            {language === 'ar' ? 'الشروط والخصوصية' : 'Terms & Privacy Policy'}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex mb-8 bg-white rounded-lg p-1 border border-neutral-200 w-full sm:w-auto overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'terms' ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'privacy' ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl p-6 sm:p-10 border border-neutral-200 shadow-base leading-relaxed content-visibility-auto">
          {activeTab === 'terms' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '1. مقدمة' : '1. Introduction'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'أهلاً بك في منصة "هدهد لايف" (Hudhud Live). تسري هذه الشروط والأحكام على جميع المستخدمين (عملاء وموردين). باستخدامك للمنصة، فإنك توافق على الالتزام بهذه الشروط.'
                    : 'Welcome to the "Hudhud Live" platform. These terms and conditions apply to all users (clients and vendors). By using the platform, you agree to be bound by these terms.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '2. طبيعة عمل المنصة' : '2. Nature of the Platform'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'تعمل منصة هدهد كوسيط إلكتروني يجمع بين طالبي الخدمات (العملاء) ومقدميها (الموردين). المنصة لا تقدم الخدمات بشكل مباشر، ولا تتحمل مسؤولية جودة العمل المقدم من المورد، وإنما توفر بيئة تواصل آمنة।'
                    : 'Hudhud operates as an electronic intermediary connecting service requesters (clients) and providers (vendors). The platform does not provide services directly and is not responsible for the quality of work provided by the vendor, but rather provides a secure communication environment.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '3. العمولة ونظام الدفع' : '3. Commission and Payment System'}
                </h2>
                <ul className="list-disc list-inside text-neutral-700 font-medium text-sm leading-8 space-y-2">
                  <li>
                    {language === 'ar' 
                      ? 'يلتزم العميل بدفع عمولة المنصة المتفق عليها (مثال: 10 ريال) عند الاتفاق مع أي مورد عن طريق المنصة.' 
                      : 'The client is obligated to pay the agreed platform commission (e.g., 10 SAR) upon reaching an agreement with any vendor through the platform.'}
                  </li>
                  <li>
                    {language === 'ar' 
                      ? 'يلتزم المورد بدفع رسوم الاشتراك الدورية أو الباقات المعروضة للتمكن من تقديم العروض.' 
                      : 'The vendor is obligated to pay periodic subscription fees or offered packages to be able to submit bids.'}
                  </li>
                  <li>
                    {language === 'ar' 
                      ? 'لا ترد العمولة بعد إتمام الاتفاق بين الطرفين للجهد المبذول من المنصة.' 
                      : 'The commission is non-refundable after the agreement between the two parties is concluded.'}
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '4. مسؤولية المستخدم' : '4. User Responsibility'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'يلتزم جميع المستخدمين بتقديم معلومات صحيحة ودقيقة (رقم الجوال، السجل التجاري، تفاصيل الطلب). يُمنع منعاً باتاً نشر محتوى مسيء، غير قانوني، أو مشاركة تفاصيل التواصل خارج النطاق المسموح به داخل المنصة للتهرب من العمولة.'
                    : 'All users are obligated to provide correct and accurate information (mobile number, commercial register, request details). It is strictly prohibited to publish offensive or illegal content, or share contact details outside the permitted scope within the platform to evade commission.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '5. إخلاء المسؤولية' : '5. Disclaimer'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'منصة هدهد تخلي مسؤوليتها القانونية عن أي نزاع مالي أو تعاقدي ينشأ بين العميل والمورد. يتم حل النزاعات بين الطرفين خارج المنصة. كما تخلي المنصة مسؤوليتها عن أي أضرار ناتجة عن استخدام الخدمة.'
                    : 'Hudhud platform disclaims legal liability for any financial or contractual dispute arising between the client and the vendor. Disputes between the two parties are resolved off-platform. The platform also disclaims liability for any damages resulting from using the service.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '6. إنهاء الحساب' : '6. Account Termination'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'تحتفظ المنصة بالحق في تعليق أو إلغاء حساب أي مستخدم يخالف هذه الشروط، أو يقوم بالتحايل، أو يتلقى شكاوى وبلاغات متكررة بانخفاض جودة عمله.'
                    : 'The platform reserves the right to suspend or cancel the account of any user who violates these terms, commits fraud, or receives repeated complaints about the low quality of their work.'}
                </p>
              </section>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '1. جمع البيانات' : '1. Data Collection'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'نقوم بجمع بعض المعلومات الأساسية عند التسجيل واستخدام منصة هدهد، مثل رقم الجوال، الاسم، سجل النشاط للموردين، والموقع الجغرافي للمناسبات لتخصيص الخدمة وتحسينها.'
                    : 'We collect basic information when you register and use the Hudhud platform, such as mobile number, name, commercial register for vendors, and the event location to customize and improve the service.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '2. استخدام البيانات' : '2. Use of Data'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'تُستخدم بياناتك لتمكين الوصول للخدمات، ربط العملاء بالموردين المناسبين، إرسال إشعارات وتنبيهات حول العروض، والامتثال للمتطلبات القانونية. نحن لا نبيع بياناتك لأطراف خارجية.'
                    : 'Your data is used to enable access to services, connect clients with suitable vendors, send notifications and alerts about offers, and comply with legal requirements. We do not sell your data to third parties.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '3. حماية البيانات' : '3. Data Protection'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'نطبق تدابير أمنية تقنية لحماية بياناتك من الوصول غير المصرح به أو التغيير أو الإفصاح أو الإتلاف. كافة عمليات التواصل تتم من خلال بروتوكولات آمنة.'
                    : 'We apply technical security measures to protect your data from unauthorized access, alteration, disclosure, or destruction. All communications occur through secure protocols.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '4. الرقابة على المحتوى' : '4. Content Moderation'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'تستخدم منصة هدهد أنظمة ذكاء اصطناعي وأدوات فلترة لضمان خلو الطلبات والعروض من المحتوى المخالف للآداب العامة، أو نشر وسائل التواصل المباشرة لتخطي المنصة.'
                    : 'The Hudhud platform uses AI systems and filtering tools to ensure requests and bids are free of content that violates public morals, or the posting of direct contact info to bypass the platform.'}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-primary-600 mb-4 pb-2 border-b border-neutral-100">
                  {language === 'ar' ? '5. حذف الحساب' : '5. Account Deletion'}
                </h2>
                <p className="text-neutral-700 font-medium text-sm leading-8">
                  {language === 'ar' 
                    ? 'يحق لك في أي وقت طلب حذف حسابك وبياناتك المرتبطة به. سيتم مسح معلوماتك الشخصية مع الاحتفاظ بنسخ لغرض الامتثال القانوني وتسوية المنازعات إن وجدت.'
                    : 'You have the right at any time to request the deletion of your account and associated data. Your personal info will be deleted while retaining copies for legal compliance and dispute resolution if necessary.'}
                </p>
              </section>
            </motion.div>
          )}
        </div>

        {/* Contact info section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-neutral-200/60 p-6 md:p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
             <MessageCircle className="w-5 h-5 text-primary-500" />
             {language === 'ar' ? 'التواصل معنا' : 'Contact Us'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.contactInfo?.phone && (
              <a href={`tel:${config.contactInfo.phone}`} className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-primary-100 bg-neutral-50 hover:bg-primary-50 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-primary-500">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="font-medium text-neutral-800 dir-ltr">{config.contactInfo.phone}</div>
              </a>
            )}
            {config.contactInfo?.whatsapp && (
              <a href={`https://wa.me/${config.contactInfo.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-success/20 bg-neutral-50 hover:bg-success/5 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-success">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="font-medium text-neutral-800 dir-ltr">{config.contactInfo.whatsapp}</div>
              </a>
            )}
            {config.contactInfo?.x && (
              <a href={config.contactInfo.x} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-neutral-800">
                  <Twitter className="w-5 h-5" />
                </div>
                <div className="font-medium text-neutral-800">X (Twitter)</div>
              </a>
            )}
            {config.contactInfo?.instagram && (
              <a href={config.contactInfo.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-pink-200 bg-neutral-50 hover:bg-pink-50 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-pink-500">
                  <Instagram className="w-5 h-5" />
                </div>
                <div className="font-medium text-neutral-800">Instagram</div>
              </a>
            )}
            {config.contactInfo?.tiktok && (
              <a href={config.contactInfo.tiktok} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-neutral-800">
                  <Music className="w-5 h-5" />
                </div>
                <div className="font-medium text-neutral-800">TikTok</div>
              </a>
            )}
            {config.contactInfo?.snapchat && (
              <a href={config.contactInfo.snapchat} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-yellow-200 bg-neutral-50 hover:bg-yellow-50 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#FFFC00]">
                  <Ghost className="w-5 h-5" style={{ color: '#000', fill: '#FFFC00' }} />
                </div>
                <div className="font-medium text-neutral-800">Snapchat</div>
              </a>
            )}
            {config.contactInfo?.youtube && (
              <a href={config.contactInfo.youtube} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-red-200 bg-neutral-50 hover:bg-red-50 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-red-500">
                  <Youtube className="w-5 h-5" />
                </div>
                <div className="font-medium text-neutral-800">YouTube</div>
              </a>
            )}
          </div>
        </div>
        
        <div className="mt-8 pb-16 flex justify-center text-center">
            <p className="text-xs text-neutral-400">
                {language === 'ar' ? 'آخر تحديث: أبريل 2026' : 'Last Updated: April 2026'} <br/>
                {language === 'ar' 
                ? 'يخضع هذا المستند للتعديل من قبل مالك المنصة.' 
                : 'This document is subject to modification by the platform owner.'}
            </p>
        </div>
      </div>
    </div>
  );
}
