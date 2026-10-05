import React, { useState, useRef, useEffect } from 'react';
import { useLanguageStore } from '../store/useLanguageStore';
import { SAUDI_CITIES } from '../lib/cities';
import { Search, MapPin, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface CitySelectProps {
  value: string;
  onChange: (cityId: string) => void;
  error?: boolean;
  variant?: 'default' | 'auth' | 'filter';
  allowAll?: boolean;
}

export default function CitySelect({ value, onChange, error, variant = 'default', allowAll = false }: CitySelectProps) {
  const { language } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSelectedLabel = () => {
    if (value === 'all') return language === 'ar' ? 'جميع المدن' : 'All Cities';
    const selectedCity = SAUDI_CITIES.find(c => c.id === value);
    return selectedCity ? (language === 'ar' ? selectedCity.ar : selectedCity.en) : '';
  };

  const selectedLabel = getSelectedLabel();

  const filteredCities = SAUDI_CITIES.filter(city => {
    const term = searchTerm.toLowerCase();
    return city.ar.toLowerCase().includes(term) || city.en.toLowerCase().includes(term);
  });

  return (
    <div className="relative" ref={wrapperRef}>
      <MapPin className={cn(
        "absolute top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none z-10",
        (variant === 'auth' || variant === 'filter') ? (language === 'ar' ? "w-4 h-4 right-3" : "w-4 h-4 left-3") : "w-5 h-5 left-4 text-primary-400"
      )} />
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center text-left transition-all outline-none font-medium text-sm",
          variant === 'filter' ? [
            "h-10 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 shadow-sm",
            language === 'ar' ? "pr-10 pl-4" : "pl-10 pr-4"
          ] : variant === 'auth' ? [
            "h-11 border border-neutral-300 rounded-sm focus:border-primary-500 bg-white",
            language === 'ar' ? "pr-10 pl-4" : "pl-10 pr-4"
          ] : [
            "h-14 pl-12 pr-12 bg-neutral-50 border rounded-xl",
            error ? "border-error focus:ring-2 focus:ring-error/20" : "border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20",
            isOpen ? "bg-white border-primary-500 ring-2 ring-primary-500/20" : "hover:bg-neutral-100"
          ]
        )}
      >
        <span className={value ? 'text-neutral-800' : 'text-neutral-400'}>
          {value ? selectedLabel : (language === 'ar' ? 'اختر المدينة...' : 'Select City...')}
        </span>
        <ChevronDown className={cn(
          "absolute top-1/2 -translate-y-1/2 transition-transform",
          (variant === 'auth' || variant === 'filter') ? (language === 'ar' ? "left-3 w-4 h-4 text-neutral-400" : "right-3 w-4 h-4 text-neutral-400") : "right-4 w-5 h-5 text-neutral-400",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-neutral-100 relative shrink-0">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              autoFocus
              placeholder={language === 'ar' ? 'ابحث عن مدينة...' : 'Search city...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 bg-neutral-50 border border-neutral-200 rounded-lg pr-10 pl-4 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow"
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin">
            {allowAll && (!searchTerm || (language === 'ar' ? 'جميع المدن'.includes(searchTerm) : 'all cities'.includes(searchTerm.toLowerCase()))) && (
              <button
                type="button"
                onClick={() => {
                  onChange('all');
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between mb-1",
                  value === 'all' ? "bg-primary-50 text-primary-600" : "hover:bg-neutral-50 text-neutral-700"
                )}
              >
                {language === 'ar' ? 'جميع المدن' : 'All Cities'}
                {value === 'all' && <Check className="w-4 h-4 text-primary-500" />}
              </button>
            )}
            
            {filteredCities.length > 0 ? (
              filteredCities.map(city => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => {
                    onChange(city.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
                    value === city.id ? "bg-primary-50 text-primary-600" : "hover:bg-neutral-50 text-neutral-700"
                  )}
                >
                  {language === 'ar' ? city.ar : city.en}
                  {value === city.id && <Check className="w-4 h-4 text-primary-500" />}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-neutral-500">
                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
