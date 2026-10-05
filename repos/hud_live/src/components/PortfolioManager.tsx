import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Plus, Trash2, Loader2, UploadCloud } from 'lucide-react';
import { useLanguageStore } from '../store/useLanguageStore';
import { translations } from '../lib/translations';
import ImageUpload from './ImageUpload';

interface PortfolioManagerProps {
  images: string[];
  onChange: (images: string[]) => void;
}

export default function PortfolioManager({ images, onChange }: PortfolioManagerProps) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [isAdding, setIsAdding] = useState(false);

  const handleDelete = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const handleAdd = (url: string) => {
    onChange([...images, url]);
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary-500" />
          {t.workGallery}
        </h4>
        <span className="text-[10px] font-bold text-neutral-300">{images.length}/10</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <AnimatePresence mode="popLayout">
          {images.map((url, index) => (
            <motion.div
              key={url}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative aspect-square group bg-neutral-100 rounded-sm border border-neutral-200 overflow-hidden"
            >
              <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button
                type="button"
                onClick={() => handleDelete(index)}
                className="absolute top-1 right-1 p-1 bg-error text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </motion.div>
          ))}

          {images.length < 10 && !isAdding && (
            <motion.button
              layout
              onClick={() => setIsAdding(true)}
              className="aspect-square border-2 border-dashed border-neutral-300 rounded-sm flex flex-col items-center justify-center text-neutral-400 hover:border-primary-500 hover:text-primary-500 transition-all bg-white"
            >
              <Plus className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase">{language === 'ar' ? 'إضافة' : 'Add'}</span>
            </motion.button>
          )}

          {isAdding && (
            <motion.div layout className="aspect-square bg-white border-2 border-primary-500 rounded-sm p-2 flex flex-col items-center justify-center">
               <ImageUpload 
                 onUploadComplete={handleAdd}
                 folder="portfolios"
                 className="w-full"
                 uploadMode="local"
               />
               <button 
                 onClick={() => setIsAdding(false)}
                 className="text-[10px] font-bold text-neutral-400 hover:text-error mt-1 uppercase"
               >
                 {t.cancel}
               </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
