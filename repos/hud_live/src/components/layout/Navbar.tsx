import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { translations } from '../../lib/translations';
import { cn } from '../../lib/utils';
import { Globe, User, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';

export default function Navbar() {
  const { language, toggleLanguage } = useLanguageStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const t = translations[language];
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm h-16 border-b border-neutral-300">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-[#1e3a8a] rounded-sm flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <span className="font-bold text-xl text-primary-500">
            {language === 'ar' ? 'هدهد لايف' : 'Hudhud Live'}
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          <Link 
            to="/" 
            className={cn(
              "font-medium transition-colors py-1",
              isActive('/') ? "text-primary-500 border-b-2 border-primary-500" : "text-neutral-500 hover:text-primary-500"
            )}
          >
            {t.home}
          </Link>
          <Link 
            to="/dashboard" 
            className={cn(
              "font-medium transition-colors py-1",
              isActive('/dashboard') ? "text-primary-500 border-b-2 border-primary-500" : "text-neutral-500 hover:text-primary-500"
            )}
          >
            {user?.type === 'admin' ? (language === 'ar' ? 'الإدارة' : 'Dashboard') : (user?.type === 'client' ? t.myRequests : t.myBids)}
          </Link>
          {user?.type === 'client' && (
            <Link 
              to="/post" 
              className={cn(
                "font-medium transition-colors py-1",
                isActive('/post') ? "text-primary-500 border-b-2 border-primary-500" : "text-neutral-500 hover:text-primary-500"
              )}
            >
              {t.postRequest}
            </Link>
          )}
          <Link 
            to="/terms" 
            className={cn(
              "font-medium transition-colors py-1",
              isActive('/terms') ? "text-primary-500 border-b-2 border-primary-500" : "text-neutral-500 hover:text-primary-500"
            )}
          >
            {language === 'ar' ? 'السياسات' : 'Policies'}
          </Link>
          {user?.type !== 'vendor' && (
            <Link 
              to="/commission" 
              className={cn(
                "font-medium transition-colors py-1 flex items-center gap-1",
                isActive('/commission') ? "text-primary-500 border-b-2 border-primary-500" : "text-neutral-500 hover:text-primary-500"
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              {t.platformCommission}
            </Link>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-primary-500 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          <div className="h-6 w-px bg-neutral-300 hidden sm:block" />

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-100 overflow-hidden">
                {user?.photoURL ? (
                   <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                   <User className="w-5 h-5 text-primary-500" />
                )}
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-error"
                title={language === 'ar' ? 'خروج' : 'Logout'}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <Link 
              to="/auth" 
              className="px-6 py-2 bg-primary-500 text-white rounded-sm font-bold text-sm hover:bg-primary-600 transition-colors"
            >
              {t.login}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
