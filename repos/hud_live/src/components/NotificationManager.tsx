import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X } from 'lucide-react';

export default function NotificationManager() {
  const { user, isAuthenticated } = useAuthStore();
  const requestsLoaded = useRef(false);
  const bidsLoaded = useRef(false);
  
  // Load persisted notified IDs from localStorage to handle app reloads/PWA offline capability
  const getPersistedSet = (key: string) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  };

  const savePersistedSet = (key: string, set: Set<string>) => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {
      // Ignore write errors
    }
  };

  const unreadBidsNotified = useRef(getPersistedSet('notified_bids'));
  const notifiedRequests = useRef(getPersistedSet('notified_requests'));
  
  const [activeToasts, setActiveToasts] = useState<{id: string, title: string, body: string}[]>([]);

  const showNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg' });
    }
    
    const id = Math.random().toString(36).substring(7);
    setActiveToasts(prev => [...prev, { id, title, body }]);
    
    setTimeout(() => {
      setActiveToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let unsubRequests: () => void;
    let unsubBids: () => void;

    // A helper to avoid notifying for very old requests on new devices (e.g. 24 hours)
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (user.type === 'vendor' && user.serviceCategories && user.serviceCategories.length > 0) {
      const q = query(
        collection(db, 'requests'),
        where('status', '==', 'live'),
        orderBy('createdAt', 'desc'),
        limit(20) // Increase limit to catch changes missed while app was closed
      );

      unsubRequests = onSnapshot(q, (snapshot) => {
        let hasNew = false;
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const reqId = doc.id;
          
          if (!notifiedRequests.current.has(reqId)) {
            notifiedRequests.current.add(reqId);
            hasNew = true;

            const categoryMatch = user.serviceCategories?.includes(data.type);
            const cityMatch = !user.city || user.city === 'all' || data.location === user.city;
            
            // Only notify if within last 24h to avoid spam on new devices
            const createdAtMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
            const isRecent = (Date.now() - createdAtMs) < ONE_DAY_MS;

            // Wait until after first load to notify, UNLESS it's a completely new unseen request from when app was closed
            // Since we loaded from localStorage, if it's not in localStorage and it's recent, we notify!
            if (categoryMatch && cityMatch && isRecent) {
              showNotification('طلب جديد', `تمت إضافة طلب جديد في تخصص: ${data.type}`);
            }
          }
        });

        if (hasNew) {
           savePersistedSet('notified_requests', notifiedRequests.current);
        }
        requestsLoaded.current = true;
      }, (error) => {
         console.error('Request notification err:', error);
      });
    }

    if (user.type === 'client') {
      const q = query(
        collection(db, 'requests'),
        where('clientId', '==', user.id),
        where('hasUnreadBids', '==', true)
      );

      unsubBids = onSnapshot(q, (snapshot) => {
        let hasNew = false;

        snapshot.docs.forEach(doc => {
          const reqId = doc.id;
          const data = doc.data();
          
          if (data.hasUnreadBids && !unreadBidsNotified.current.has(reqId)) {
            unreadBidsNotified.current.add(reqId);
            hasNew = true;
            showNotification('عرض جديد', `تلقيت عرضاً جديداً على طلبك: ${data.title}`);
          } else if (!data.hasUnreadBids && unreadBidsNotified.current.has(reqId)) {
            unreadBidsNotified.current.delete(reqId);
            hasNew = true;
          }
        });

        if (hasNew) {
          savePersistedSet('notified_bids', unreadBidsNotified.current);
        }
        bidsLoaded.current = true;
      }, (error) => {
         console.error('Bids notification err:', error);
      });
    }

    return () => {
      if (unsubRequests) unsubRequests();
      if (unsubBids) unsubBids();
    };
  }, [user, isAuthenticated]);

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {activeToasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="bg-white border-l-4 border-primary-500 rounded-md shadow-lg p-4 w-80 pointer-events-auto flex items-start gap-4"
          >
            <div className="bg-primary-50 p-2 rounded-full text-primary-500 shrink-0">
               <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-neutral-800">{toast.title}</h4>
              <p className="text-xs text-neutral-500 mt-1">{toast.body}</p>
            </div>
            <button 
              onClick={() => setActiveToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
