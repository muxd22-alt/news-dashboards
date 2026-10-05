import { create } from 'zustand';

type Language = 'ar' | 'en';

interface LanguageState {
  language: Language;
  direction: 'rtl' | 'ltr';
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'ar',
  direction: 'rtl',
  setLanguage: (lang) => set({ 
    language: lang, 
    direction: lang === 'ar' ? 'rtl' : 'ltr' 
  }),
  toggleLanguage: () => set((state) => {
    const nextLang = state.language === 'ar' ? 'en' : 'ar';
    return {
      language: nextLang,
      direction: nextLang === 'ar' ? 'rtl' : 'ltr'
    };
  }),
}));
