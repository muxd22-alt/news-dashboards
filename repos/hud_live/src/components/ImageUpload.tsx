import { useState, useRef, ChangeEvent } from 'react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { motion } from 'motion/react';
import { Camera, Loader2, UploadCloud, X } from 'lucide-react';
import { useLanguageStore } from '../store/useLanguageStore';
import { translations } from '../lib/translations';

interface ImageUploadProps {
  currentImage?: string;
  onUploadComplete: (url: string) => void;
  folder?: string;
  label?: string;
  className?: string;
  uploadMode?: 'firebase' | 'local'; // Added property to configure upload behavior
}

export default function ImageUpload({ 
  currentImage, 
  onUploadComplete, 
  folder = 'profiles',
  label,
  className,
  uploadMode = 'firebase' // Default to firebase for backwards compatibility
}: ImageUploadProps) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const isValidType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
    if (!isValidType) {
      setError(language === 'ar' ? 'يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)' : 'Please select a valid image (JPG, PNG, WEBP)');
      return;
    }

    const isUnderLimit = file.size <= 5 * 1024 * 1024; // 5MB
    if (!isUnderLimit) {
      setError(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be under 5MB');
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress(0);

    try {
      if (uploadMode === 'local') {
        // Read file locally and compress it using canvas to drastically reduce Base64 string size
        // so it safely fits within Firestore's 1MB limit without needing Firebase Storage.
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const maxDimension = 600; // Aggressive downscale

              if (width > height && width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
              } else if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                // Compress as JPEG with low quality = tiny Base64 string (~30kb - 60kb)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
                onUploadComplete(compressedBase64);
              } else {
                onUploadComplete(reader.result as string); // Fallback if no context
              }
              setIsUploading(false);
            };
            img.onerror = () => {
               setError(language === 'ar' ? 'فشل معالجة الصورة' : 'Failed to process image');
               setIsUploading(false);
            };
            img.src = reader.result;
          } else {
            setError(language === 'ar' ? 'فشل قراءة الملف' : 'Failed to read file');
            setIsUploading(false);
          }
        };
        reader.onerror = () => {
          setError(language === 'ar' ? 'فشل قراءة الملف' : 'Failed to read file');
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } else {
        // Firebase Storage Upload
        const fileExtension = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const storageRef = ref(storage, `${folder}/${fileName}`);

        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(p);
          },
          (error) => {
            console.error("Upload error:", error);
            setError(language === 'ar' ? 'فشل التحميل. يرجى المحاولة مرة أخرى.' : 'Upload failed. Please try again.');
            setIsUploading(false);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            onUploadComplete(downloadURL);
            setIsUploading(false);
          }
        );
      }
    } catch (err) {
      console.error("Upload setup error:", err);
      setError(language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
      setIsUploading(false);
    }
  };

  return (
    <div className={className}>
      {label && <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{label}</label>}
      
      <div className="relative group">
        <div className="w-24 h-24 rounded-sm border-2 border-primary-500 overflow-hidden shadow-md bg-neutral-50 flex items-center justify-center relative">
          {currentImage ? (
            <img 
              src={currentImage} 
              alt="Profile" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <Camera className="w-8 h-8 text-neutral-300" />
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-primary-500/80 flex flex-col items-center justify-center text-white p-2">
              <Loader2 className="w-6 h-6 animate-spin mb-1" />
              <span className="text-[10px] font-bold">{Math.round(progress)}%</span>
            </div>
          )}

          {!isUploading && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              <UploadCloud className="w-6 h-6 text-white" />
            </button>
          )}
        </div>

        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />

        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className="text-[9px] text-error font-bold mt-2 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> {error}
          </motion.p>
        )}

        <p className="text-[10px] text-neutral-400 italic mt-2">
          {language === 'ar' ? 'انقر لتغيير الصورة (JPG/PNG، بحد أقصى 5 ميجابايت)' : 'Click to change photo (JPG/PNG, max 5MB)'}
        </p>
      </div>
    </div>
  );
}
