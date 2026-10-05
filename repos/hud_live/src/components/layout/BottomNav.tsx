import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, PlusCircle, Scale, CreditCard } from 'lucide-react';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { translations } from '../../lib/translations';
import { cn } from '../../lib/utils';

export default function BottomNav() {
  const { language } = useLanguageStore();
  const { user, isAuthenticated } = useAuthStore();
  const t = translations[language];
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  // Don't show bottom nav on auth screens if needed, but App.tsx wraps it globally.
  if (location.pathname === '/auth') return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex items-center justify-around z-50 h-[68px] pb-safe-bottom px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <Link 
        to="/" 
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 cursor-pointer",
          isActive('/') ? "text-primary-500" : "text-neutral-500 hover:text-primary-500"
        )}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-medium">{t.home}</span>
      </Link>

      {isAuthenticated ? (
        <Link 
          to="/dashboard" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 cursor-pointer",
            isActive('/dashboard') ? "text-primary-500" : "text-neutral-500 hover:text-primary-500"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">
            {user?.type === 'admin' ? (language === 'ar' ? 'الإدارة' : 'Dashboard') : (user?.type === 'client' ? t.myRequests : t.myBids)}
          </span>
        </Link>
      ) : (
        <Link 
          to="/auth" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 cursor-pointer",
            isActive('/auth') ? "text-primary-500" : "text-neutral-500 hover:text-primary-500"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t.login}</span>
        </Link>
      )}

      {user?.type === 'client' && (
        <Link 
          to="/post" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 cursor-pointer relative -top-3"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow",
            isActive('/post') ? "bg-primary-600 text-white" : "bg-primary-500 text-white hover:bg-primary-600"
          )}>
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className={cn(
            "text-[10px] font-medium mt-1",
            isActive('/post') ? "text-primary-600" : "text-neutral-600"
          )}>{t.postRequest}</span>
        </Link>
      )}

      {user?.type !== 'vendor' && (
        <Link 
          to="/commission" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 cursor-pointer",
            isActive('/commission') ? "text-primary-500" : "text-neutral-500 hover:text-primary-500"
          )}
        >
          <div className="relative">
            <CreditCard className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
          </div>
          <span className="text-[10px] font-medium">{t.platformCommission}</span>
        </Link>
      )}

      <Link 
        to="/terms" 
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 cursor-pointer",
          isActive('/terms') ? "text-primary-500" : "text-neutral-500 hover:text-primary-500"
        )}
      >
        <Scale className="w-5 h-5" />
        <span className="text-[10px] font-medium">{language === 'ar' ? 'السياسات' : 'Policies'}</span>
      </Link>
    </div>
  );
}
