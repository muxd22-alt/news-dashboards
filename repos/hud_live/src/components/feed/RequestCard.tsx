import React, { useEffect, useState, FC } from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';
import { translations } from '../../lib/translations';
import { getCityName } from '../../lib/cities';
import { motion } from 'motion/react';
import { MapPin, Calendar, Users, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Request } from '../../types';
import { Link } from 'react-router-dom';

interface RequestCardProps {
  request: Request;
}

const RequestCard: FC<RequestCardProps> = ({ request }) => {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, request.expiresAt - now);
      setTimeLeft(diff);
      if (diff === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [request.expiresAt]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isCompleted = request.status === 'completed' || request.status === 'confirmed';
  const isExpired = timeLeft === 0 && !isCompleted;

  const isEndingSoon = timeLeft > 0 && timeLeft < 5 * 60 * 1000 && !isCompleted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="bg-white border border-neutral-300 rounded-base p-6 shadow-sm hover:shadow-md transition-all group overflow-hidden relative"
    >
      <Link to={`/request/${request.id}`} className="absolute inset-0 z-10" />
      
      {/* Time Badge */}
      <div className={cn(
        "absolute top-0 right-0 px-4 py-2 text-xs font-bold uppercase tracking-wider z-20",
        isEndingSoon ? "bg-error text-white animate-pulse" : 
        isCompleted ? "bg-success text-white" : "bg-primary-500 text-white"
      )}>
        {isCompleted ? (
          <span>{(t as any).completed || (language === 'ar' ? 'مكتمل' : 'Completed')}</span>
        ) : isExpired ? (
          <span>{t.expired}</span>
        ) : (
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {request.hasUnreadBids && (
        <div className={cn(
          "absolute top-0 px-4 py-2 text-xs font-bold uppercase tracking-wider z-20 bg-error text-white shadow-sm flex items-center gap-1",
          language === 'ar' ? 'left-0' : 'right-auto left-0'
        )}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {language === 'ar' ? 'عروض جديدة' : 'New Offers'}
        </div>
      )}

      {/* Main Info */}
      <div className="mb-4 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-500 mb-1 block">
          {t[request.type as keyof typeof t] || request.type}
        </span>
        <h3 className="font-bold text-primary-500 mb-2 line-clamp-2 leading-snug">
          {language === 'ar' ? request.title : request.titleEn}
        </h3>
      </div>

      <div className="space-y-2 mb-6 text-sm text-neutral-500">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-neutral-300" />
          <span>{getCityName(request.location, language)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-300" />
          <span>{request.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-300" />
          <span>{request.guests} {t.guests}</span>
        </div>
      </div>

      {/* Service pill */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="px-2 py-1 bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase rounded-sm">
          {t[request.type.toLowerCase() as keyof typeof t] || request.type}
        </span>
      </div>

      <div className="h-px bg-neutral-100 mb-6" />

      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-neutral-500 block mb-1">{t.budget}</span>
          <span className="font-bold text-primary-500 text-sm">
            {request.budget} {t.sar}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-end">
            <span className="text-xs text-neutral-500 block mb-1">{t.bids}</span>
            <span className="font-bold text-neutral-700">{request.vendorCount}</span>
          </div>
          
          <button className="w-10 h-10 rounded-sm bg-primary-100 text-primary-500 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all">
            {language === 'ar' ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default RequestCard;
