import { create } from 'zustand';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export interface SubscriptionPackage {
  id: string;
  nameEn: string;
  nameAr: string;
  durationMonths: number;
  price: number;
  featuresEn: string;
  featuresAr: string;
}

export interface ContactInfo {
  phone: string;
  whatsapp: string;
  tiktok: string;
  snapchat: string;
  youtube: string;
  x: string;
  instagram: string;
}

export interface BankAccount {
  id: string;
  bankNameEn: string;
  bankNameAr: string;
  accountName: string;
  accountNumber: string;
  iban: string;
}

interface AppConfig {
  requestLifespanMinutes: number;
  cities: string[];
  services: string[];
  subscriptionPackages: SubscriptionPackage[];
  bankAccounts: BankAccount[];
  contactInfo: ContactInfo;
}

interface AppConfigState {
  config: AppConfig;
  isLoading: boolean;
  fetchConfig: () => void;
}

export const useAppConfig = create<AppConfigState>((set) => ({
  config: { 
    requestLifespanMinutes: 18, 
    cities: [], 
    services: [], 
    subscriptionPackages: [], 
    bankAccounts: [],
    contactInfo: {
      phone: '0553017955',
      whatsapp: '0553017955',
      tiktok: '',
      snapchat: '',
      youtube: '',
      x: '',
      instagram: ''
    }
  }, // default
  isLoading: true,
  fetchConfig: () => {
    const unsub = onSnapshot(doc(db, 'settings', 'app'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({ 
          config: { 
            requestLifespanMinutes: data.requestLifespanMinutes || 18,
            cities: data.cities || [],
            services: data.services || [],
            subscriptionPackages: data.subscriptionPackages || [],
            bankAccounts: data.bankAccounts || [],
            contactInfo: data.contactInfo || {
              phone: '0553017955',
              whatsapp: '0553017955',
              tiktok: '',
              snapchat: '',
              youtube: '',
              x: '',
              instagram: ''
            }
          }, 
          isLoading: false 
        });
      } else {
        set({ isLoading: false });
      }
    }, (error) => {
      console.error("App Config Fetch Error:", error);
      set({ isLoading: false });
    });
    return unsub;
  }
}));
