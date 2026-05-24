import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  Upload, Wand2, Camera, ArrowRight, Sparkles,
  Loader2, X, Check, ImagePlus, BookOpen,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackViewContent } from '@/lib/analytics';

interface TryOnOption {
  id: string;
  labelEn: string;
  labelAr: string;
  icon: React.ReactNode;
  promptKey: string;
}

const treatments: TryOnOption[] = [
  { id: 'hair_extensions', labelEn: 'Hair Extensions', labelAr: 'اكستنشن شعر', icon: <Sparkles className="w-5 h-5" />, promptKey: 'hair_extensions' },
  { id: 'volume', labelEn: 'Volume Boost', labelAr: 'زيادة الكثافة', icon: <Sparkles className="w-5 h-5" />, promptKey: 'volume' },
  { id: 'color_change', labelEn: 'Color Change', labelAr: 'تغيير اللون', icon: <Sparkles className="w-5 h-5" />, promptKey: 'color_change' },
  { id: 'lash', labelEn: 'Lash Extensions', labelAr: 'اكستنشن رموش', icon: <Sparkles className="w-5 h-5" />, promptKey: 'lash' },
  { id: 'microblading', labelEn: 'Microblading', labelAr: 'مايكروبليدنج', icon: <Sparkles className="w-5 h-5" />, promptKey: 'microblading' },
];

const hairColors = [
  { id: 'honey_blonde', labelEn: 'Honey Blonde', labelAr: 'أشقر عسلي' },
  { id: 'jet_black', labelEn: 'Jet Black', labelAr: 'أسود غامق' },
  { id: 'chestnut', labelEn: 'Chestnut Brown', labelAr: 'بني كستنائي' },
  { id: 'burgundy', labelEn: 'Burgundy', labelAr: 'بورجوندي' },
  { id: 'platinum', labelEn: 'Platinum', labelAr: 'بلاتيني' },
  { id: 'copper', labelEn: 'Copper Red', labelAr: 'نحاسي أحمر' },
];

const hairLengths = [
  { id: 'short', labelEn: 'Short', labelAr: 'قصير' },
  { id: 'medium', labelEn: 'Medium', labelAr: 'متوسط' },
  { id: 'long', labelEn: 'Long', labelAr: 'طويل' },
  { id: 'extra_long', labelEn: 'Extra Long', labelAr: 'طويل جداً' },
];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function TryOnPage() {
  const { t, lang } = useTranslation();
  const [, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'options' | 'generating' | 'result' | 'error'>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [treatment, setTreatment] = useState<string>('hair_extensions');
  const [color, setColor] = useState<string>('honey_blonde');
  const [hairLength, setHairLength] = useState<string>('long');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    trackViewContent({ contentName: 'Try-On Page', contentCategory: 'page' });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target?.result as string);
      setStep('options');
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const generate = useCallback(async () => {
    if (!imageUrl) return;
    setStep('generating');
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/try-on`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          treatment,
          color,
          hair_length: hairLength,
          style: treatment === 'hair_extensions' ? 'tape-in' : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.image_url) {
        setResultImage(data.image_url);
        setStep('result');
      } else {
        setErrorMsg(data.error || 'Generation failed');
        setStep('error');
      }
    } catch {
      setErrorMsg('Network error');
      setStep('error');
    }
  }, [imageUrl, treatment, color, hairLength]);

  const reset = () => {
    setImageUrl(null);
    setResultImage(null);
    setErrorMsg(null);
    setStep('upload');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HERO */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-black/80" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="text-center max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 rounded-full bg-gold/20 text-gold text-sm font-medium tracking-wider mb-6">
              {lang === 'ar' ? 'مدعوم بـ AI' : 'AI-POWERED'}
            </span>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-tight mb-6">
              {lang === 'ar' ? 'شوفي شكلك قبل ما تحجزي' : 'See Your Look Before You Book'}
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
              {lang === 'ar'
                ? 'ارفعي صورة وشوفي معاينة AI لترانسفورميشن شعرك — اكستنشن، لون، كثافة، رموش، ومايكروبليدنج'
                : 'Upload a photo and see an AI preview of your hair transformation — extensions, color, volume, lashes, and microblading'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* MAIN WORKFLOW */}
      <section className="pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <AnimatePresence mode="wait">
            {/* STEP 1: UPLOAD */}
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div
                  className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center hover:border-gold/50 transition-colors cursor-pointer bg-white/5"
                  onClick={() => fileRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="w-20 h-20 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-6">
                    <Upload className="w-10 h-10 text-gold" />
                  </div>
                  <h3 className="font-serif text-2xl mb-3">
                    {lang === 'ar' ? 'ارفعي صورتك' : 'Upload Your Photo'}
                  </h3>
                  <p className="text-gray-400 mb-6">
                    {lang === 'ar' ? 'اسحبي الصورة هنا أو اضغطي لتحميل' : 'Drag & drop here or click to upload'}
                  </p>
                  <Button variant="shop" className="gap-2">
                    <Camera className="w-4 h-4" />
                    {lang === 'ar' ? 'اختري صورة' : 'Choose Photo'}
                  </Button>
                  <p className="text-gray-500 text-sm mt-4">
                    {lang === 'ar' ? 'PNG, JPG — حتى 5 ميجا' : 'PNG, JPG — up to 5MB'}
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </motion.div>
            )}

            {/* STEP 2: OPTIONS */}
            {step === 'options' && (
              <motion.div key="options" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                {/* Preview */}
                {imageUrl && (
                  <div className="relative rounded-xl overflow-hidden max-w-sm mx-auto">
                    <img src={imageUrl} alt="Preview" className="w-full h-64 object-cover rounded-xl" />
                    <button onClick={reset} className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}

                {/* Treatment */}
                <div>
                  <h3 className="font-serif text-xl mb-4">{lang === 'ar' ? 'اختري الترانسفورميشن' : 'Choose Transformation'}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {treatments.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setTreatment(opt.id)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left',
                          treatment === opt.id ? 'border-gold bg-gold/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                        )}
                      >
                        {treatment === opt.id ? <Check className="w-5 h-5 text-gold shrink-0" /> : <span className="text-gold shrink-0">{opt.icon}</span>}
                        <span className="text-sm font-medium">{lang === 'ar' ? opt.labelAr : opt.labelEn}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <h3 className="font-serif text-xl mb-4">{lang === 'ar' ? 'اختري اللون' : 'Choose Color'}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {hairColors.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setColor(c.id)}
                        className={cn(
                          'px-4 py-3 rounded-xl border transition-all text-sm',
                          color === c.id ? 'border-gold bg-gold/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                        )}
                      >
                        {lang === 'ar' ? c.labelAr : c.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length */}
                <div>
                  <h3 className="font-serif text-xl mb-4">{lang === 'ar' ? 'الطول المفضل' : 'Preferred Length'}</h3>
                  <div className="flex flex-wrap gap-3">
                    {hairLengths.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setHairLength(l.id)}
                        className={cn(
                          'px-5 py-2.5 rounded-xl border transition-all text-sm',
                          hairLength === l.id ? 'border-gold bg-gold/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                        )}
                      >
                        {lang === 'ar' ? l.labelAr : l.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                <Button variant="shop" className="w-full h-14 text-lg gap-2" onClick={generate}>
                  <Wand2 className="w-5 h-5" />
                  {lang === 'ar' ? 'ولّعي السحر ✨' : 'Generate Magic ✨'}
                </Button>
              </motion.div>
            )}

            {/* STEP 3: GENERATING */}
            {step === 'generating' && (
              <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-24">
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-gold/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent animate-spin" />
                  <Wand2 className="absolute inset-0 m-auto w-10 h-10 text-gold" />
                </div>
                <h3 className="font-serif text-2xl mb-3">
                  {lang === 'ar' ? 'الـ AI شغّال على ترانسفورميشنك...' : 'AI is crafting your transformation...'}
                </h3>
                <p className="text-gray-400">{lang === 'ar' ? 'ثواني بس وهتشوفي النتيجة' : 'Just a few seconds'}</p>
              </motion.div>
            )}

            {/* STEP 4: RESULT */}
            {step === 'result' && resultImage && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <div className="text-center">
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/20 text-green-400 text-sm font-medium mb-6">
                    <Check className="w-4 h-4" />
                    {lang === 'ar' ? 'الترانسفورميشن جاهز!' : 'Your transformation is ready!'}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {imageUrl && (
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <img src={imageUrl} alt="Before" className="w-full h-80 object-cover" />
                      <div className="p-3 bg-black/60 text-center text-sm text-gray-400">{lang === 'ar' ? 'قبل' : 'Before'}</div>
                    </div>
                  )}
                  <div className="rounded-xl overflow-hidden border border-gold/30">
                    <img src={resultImage} alt="After" className="w-full h-80 object-cover" />
                    <div className="p-3 bg-black/60 text-center text-sm text-gold">{lang === 'ar' ? 'بعد' : 'After'}</div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/book">
                    <Button variant="shop" className="w-full sm:w-auto h-14 text-lg gap-2">
                      <BookOpen className="w-5 h-5" />
                      {lang === 'ar' ? 'احجزي ده بالظبط' : 'Book This Exact Look'}
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full sm:w-auto h-14 gap-2 border-white/20" onClick={reset}>
                    <ImagePlus className="w-5 h-5" />
                    {lang === 'ar' ? 'جربي صورة تانية' : 'Try Another Photo'}
                  </Button>
                </div>
                <p className="text-center text-gray-500 text-sm">
                  {lang === 'ar'
                    ? 'النتيجة توضيحية. الترانسفورميشن الحقيقي يعتمد على نوع شعرك ونوع الاكستنشن اللي هتختاريه.'
                    : 'Result is illustrative. Your actual transformation depends on your hair type and the extensions chosen.'}
                </p>
              </motion.div>
            )}

            {/* ERROR */}
            {step === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="font-serif text-2xl mb-3">{lang === 'ar' ? 'حصل خطأ' : 'Something went wrong'}</h3>
                <p className="text-gray-400 mb-6">{errorMsg || (lang === 'ar' ? 'حاولي تاني' : 'Please try again')}</p>
                <Button variant="shop" onClick={() => setStep('options')}>{lang === 'ar' ? 'رجعي و حاولي تاني' : 'Go Back & Retry'}</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 border-t border-white/10 bg-black/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <h2 className="font-serif text-3xl text-center mb-12">
            {lang === 'ar' ? 'إزاي بتشتغل' : 'How It Works'}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '01', titleEn: 'Upload', titleAr: 'ارفعي', descEn: 'Take a clear front-facing photo and upload it', descAr: 'صورة واضحة من قدام وارفعيها' },
              { num: '02', titleEn: 'Customize', titleAr: 'خصّصي', descEn: 'Pick treatment, color, and length', descAr: 'اختاري الترانسفورميشن واللون والطول' },
              { num: '03', titleEn: 'See It', titleAr: 'شوفي', descEn: 'AI generates your preview in seconds', descAr: 'الـ AI يولّع النتيجة في ثواني' },
            ].map((s) => (
              <div key={s.num} className="text-center">
                <span className="text-4xl font-serif text-gold/30">{s.num}</span>
                <h3 className="font-serif text-xl mt-3 mb-2">{lang === 'ar' ? s.titleAr : s.titleEn}</h3>
                <p className="text-gray-400">{lang === 'ar' ? s.descAr : s.descEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl mb-4">
            {lang === 'ar' ? 'جاهزة للترانسفورميشن الحقيقي؟' : 'Ready for the real transformation?'}
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            {lang === 'ar'
              ? 'احجزي كونسلتيشن مجانية وخبيراتنا يساعدوكي تختاري الـ look المثالي'
              : 'Book a free consultation and our experts will help you choose the perfect look'}
          </p>
          <Link href="/book">
            <Button variant="shop" className="h-14 text-lg gap-2">
              {lang === 'ar' ? 'احجزي دلوقتي' : 'Book Now'}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
