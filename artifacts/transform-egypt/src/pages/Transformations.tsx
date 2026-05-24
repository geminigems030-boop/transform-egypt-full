import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import beforeA from '@assets/TRANSFORM_(Before_+_After_pairs)_Before_A__1774666489142.JPG';
import afterA from '@assets/TRANSFORM_(Before_+_After_pairs)_After_A__1774666489143.JPG';
import beforeB from '@assets/TRANSFORM_(Before_+_After_pairs)_Before_B__1774666934040.jpg';
import afterB from '@assets/TRANSFORM_(Before_+_After_pairs)_After_B__1774666934040.jpg';
import beforeC from '@assets/TRANSFORM_(Before_+_After_pairs)_Before_C__1774666489143.jpg';
import afterC from '@assets/TRANSFORM_(Before_+_After_pairs)_After_C__1774666489143.jpg';
import beforeD from '@assets/TRANSFORM_(Before_+_After_pairs)_Before_D__1774666489143.jpg';
import afterD from '@assets/TRANSFORM_(Before_+_After_pairs)_After_D__1774666489143.jpg';
import beforeE from '@assets/TRANSFORM_1-6_(Before_+_After_pairs)_Before_E_1774666730978.jpg';
import afterE from '@assets/TRANSFORM_1-6_(Before_+_After_pairs)_After_E_1774666730978.jpg';
import serviceHair from '@assets/SERVICE_Hair_Extensions__1774666489143.JPG';
import serviceLash from '@assets/SERVICE_Lash_Extensions__1774666489142.JPG';
import serviceBrows from '@assets/SERVICE_Brow_Extensions_Microblading_1774666489143.JPG';
/* TransforM Celebrity Chair Series — also featured on the home page */
import entesarBefore from '@assets/9AEC0655-1BBE-4DE5-A816-6A2098A68A96_1777894504392.png';
import entesarAfter from '@assets/8FD0845C-1FF7-4E9B-8F9F-C4035BBEBACE_1777894504392.png';
import dinaBefore from '@assets/IMG_9770_1777894643110.jpeg';
import dinaAfter from '@assets/IMG_9776_1777894643110.jpeg';
import houriyaAfter from '@assets/3864064F-DD33-4074-AD3C-895E167A6C8E_1777894727981.jpeg';
const houriyaBefore = '/transformations/houriya-before.jpeg';

const categories = [
  { id: 'all', labelEn: 'All', labelAr: 'الكل' },
  { id: 'hair', labelEn: 'Hair Extensions', labelAr: 'اكستنشن الشعر' },
  { id: 'color', labelEn: 'Hair Color', labelAr: 'صباغة الشعر' },
  { id: 'lash', labelEn: 'Lash Extensions', labelAr: 'اكستنشن رموش (لاش)' },
  { id: 'brows', labelEn: 'Brows & Microblading', labelAr: 'الحواجب' },
  { id: 'bridal', labelEn: 'Bridal', labelAr: 'العرائس' },
];

const transformations = [
  /* TransforM Celebrity Chair Series — newest featured. Composites with embedded
     gold typography use the slider's hideLabels prop to avoid label collisions. */
  {
    id: 101, category: 'hair', hideLabels: true,
    before: entesarBefore, after: entesarAfter,
    service: 'TransforM Celebrity Chair', serviceAr: 'كرسي المشاهير',
    client: 'Entesar', clientAr: 'انتصار', date: 'May 2026',
    testimonial: 'A new me, today. Beauty, confidence, transformation.',
    testimonialAr: 'أنا جديدة، اليوم. جمال، ثقة، تحول.',
  },
  {
    id: 102, category: 'hair',
    before: dinaBefore, after: dinaAfter,
    service: 'TransforM Celebrity Chair', serviceAr: 'كرسي المشاهير',
    client: 'Dina', clientAr: 'دينا', date: 'May 2026',
    testimonial: 'I walked out feeling like the most confident version of myself.',
    testimonialAr: 'خرجت من ترانسفورم وأنا أشعر أنني أفضل نسخة من نفسي.',
  },
  {
    id: 103, category: 'hair', hideLabels: true,
    before: houriyaBefore, after: houriyaAfter,
    service: 'TransforM Celebrity Chair', serviceAr: 'كرسي المشاهير',
    client: 'Houriya Farghaly', clientAr: 'حورية فرغلي', date: 'May 2026',
    testimonial: 'A new you, today — exclusive beauty, confidence, transformation.',
    testimonialAr: 'أنتِ جديدة، اليوم — جمال حصري، ثقة، تحول.',
  },
  {
    id: 1, category: 'hair',
    before: beforeA, after: afterA,
    service: 'Tape-In Hair Extensions', serviceAr: 'اكستنشن تيب إن',
    client: 'Nour H.', date: 'March 2025',
    testimonial: 'Absolutely love my new hair! Mervat is a genius.',
    testimonialAr: 'أحب شعري الجديد جداً! ميرفت عبقرية.',
  },
  {
    id: 2, category: 'hair',
    before: beforeC, after: afterC,
    service: 'Hair Extensions', serviceAr: 'اكستنشن الشعر',
    client: 'Sara M.', date: 'March 2025',
    testimonial: 'The transformation is unreal. Everyone asks me where I go!',
    testimonialAr: 'التحول لا يصدق. الكل يسألني أين أذهب!',
  },
  {
    id: 3, category: 'hair',
    before: beforeD, after: afterD,
    service: 'Keratin Smoothing Treatment', serviceAr: 'علاج كيراتين',
    client: 'Mariam K.', date: 'February 2025',
    testimonial: 'From frizzy to silky smooth — I can\'t believe this is my hair!',
    testimonialAr: 'من مجعد إلى ناعم كالحرير — لا أصدق أن هذا شعري!',
  },
  {
    id: 4, category: 'brows',
    before: beforeB, after: afterB,
    service: 'Microblading', serviceAr: 'مايكروبليدنج',
    client: 'Samira T.', date: 'January 2025',
    testimonial: 'I never thought I could have perfect brows at my age. Absolutely life-changing!',
    testimonialAr: 'لم أكن أتخيل أن يكون لدي حواجب مثالية في هذا العمر. تغيير حياة حقيقي!',
  },
  {
    id: 5, category: 'hair',
    before: beforeE, after: afterE,
    service: 'Hair Topper / Volume Extensions', serviceAr: 'تكثيف الشعر',
    client: 'Nadia S.', date: 'March 2025',
    testimonial: 'My hair was so thin on top — TransforM gave me my confidence back completely.',
    testimonialAr: 'كان شعري خفيفاً جداً — ترانسفورم أعادت ثقتي بنفسي تماماً.',
  },
  {
    id: 6, category: 'lash',
    before: serviceLash, after: serviceLash,
    service: 'Volume Lash Extensions', serviceAr: 'رموش فوليوم',
    client: 'Farah R.', date: 'February 2025',
    testimonial: 'Best lashes in Cairo — period.',
    testimonialAr: 'أفضل رموش في القاهرة — بلا منازع.',
  },
];

function BeforeAfterSlider({ before, after, slotLabel, hideLabels = false }: { before: string; after: string; slotLabel?: string; hideLabels?: boolean }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const hasImages = before && after;

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100);
    setSliderPos(pct);
  };

  if (!hasImages) {
    return (
      <div className="relative w-full aspect-square overflow-hidden bg-neutral-900 flex items-center justify-center border-2 border-dashed border-gold/30">
        <div className="text-center px-4">
          <div className="text-gold text-4xl mb-3">⟺</div>
          <p className="text-gold text-xs font-bold uppercase tracking-widest mb-1">{slotLabel || 'Before / After'}</p>
          <p className="text-gray-500 text-[10px]">Send BEFORE + AFTER images</p>
        </div>
        <span className="absolute top-3 left-3 bg-black/70 text-white text-[10px] uppercase tracking-widest px-2 py-1 font-bold">Before</span>
        <span className="absolute top-3 right-3 bg-gold text-black text-[10px] uppercase tracking-widest px-2 py-1 font-bold">After</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square overflow-hidden cursor-ew-resize select-none"
      onMouseDown={() => { dragging.current = true; }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onMouseMove={(e) => dragging.current && handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
    >
      <img src={after} alt="After" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
        <img src={before} alt="Before" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-y-0" style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}>
        <div className="h-full w-0.5 bg-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gold border-2 border-white flex items-center justify-center shadow-lg z-10">
          <span className="text-black text-xs font-bold select-none">⟺</span>
        </div>
      </div>
      {!hideLabels && (
        <>
          <span className="absolute top-3 left-3 bg-black/80 text-white text-[10px] uppercase tracking-widest px-2 py-1 font-bold">Before</span>
          <span className="absolute top-3 right-3 bg-gold text-black text-[10px] uppercase tracking-widest px-2 py-1 font-bold">After</span>
        </>
      )}
    </div>
  );
}

export default function Transformations() {
  const { lang } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered = activeCategory === 'all'
    ? transformations
    : transformations.filter(t => t.category === activeCategory);

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);
  const prevLightbox = () => setLightboxIndex(prev => prev !== null ? (prev - 1 + filtered.length) % filtered.length : null);
  const nextLightbox = () => setLightboxIndex(prev => prev !== null ? (prev + 1) % filtered.length : null);

  const lightboxItem = lightboxIndex !== null ? filtered[lightboxIndex] : null;

  return (
    <div className="min-h-screen bg-black pt-24">
      {/* Hero */}
      <div className="bg-black py-20 text-center border-b border-white/10">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-5xl md:text-6xl text-gold mb-4">
          {lang === 'ar' ? 'تحولات حقيقية' : 'Real Transformations'}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-300 text-xl max-w-2xl mx-auto">
          {lang === 'ar' ? 'نتائج حقيقية. عميلات حقيقيات. فرق لا يصدق.' : 'Real results. Real clients. Unbelievable transformations.'}
        </motion.p>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-[72px] z-30 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-4 overflow-x-auto scrollbar-hide [-webkit-mask-image:linear-gradient(to_right,black_88%,transparent_100%)] [mask-image:linear-gradient(to_right,black_88%,transparent_100%)] rtl:[-webkit-mask-image:linear-gradient(to_left,black_88%,transparent_100%)] rtl:[mask-image:linear-gradient(to_left,black_88%,transparent_100%)] md:[mask-image:none] md:[-webkit-mask-image:none]">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-5 py-2 text-sm uppercase tracking-widest whitespace-nowrap transition-all font-medium rounded-sm",
                  activeCategory === cat.id
                    ? "bg-gold text-black"
                    : "text-gray-400 hover:text-white border border-white/20 hover:border-white/40"
                )}
              >
                {lang === 'ar' ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative bg-[#111] rounded-sm overflow-hidden border border-white/5 hover:border-gold/30 transition-colors"
              >
                <BeforeAfterSlider before={item.before} after={item.after} slotLabel={(item as any).slotLabel} hideLabels={(item as any).hideLabels} />
                <div className="p-5">
                  <p className="text-gold text-sm font-semibold uppercase tracking-wider mb-1">
                    {lang === 'ar' ? item.serviceAr : item.service}
                  </p>
                  <p className="text-gray-400 text-sm italic mb-3">"{lang === 'ar' ? item.testimonialAr : item.testimonial}"</p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">{item.client} · {item.date}</span>
                    <button
                      onClick={() => openLightbox(i)}
                      className="text-gray-500 hover:text-gold transition-colors"
                      aria-label="View fullscreen"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <button className="absolute top-6 right-6 text-white hover:text-gold transition-colors" aria-label="Close">
              <X className="w-8 h-8" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); prevLightbox(); }} className="absolute left-4 text-white hover:text-gold" aria-label="Previous">
              <ChevronLeft className="w-10 h-10" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); nextLightbox(); }} className="absolute right-4 text-white hover:text-gold" aria-label="Next">
              <ChevronRight className="w-10 h-10" />
            </button>

            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <BeforeAfterSlider before={lightboxItem.before} after={lightboxItem.after} hideLabels={(lightboxItem as any).hideLabels} />
              <div className="mt-4 text-center">
                <p className="text-gold font-serif text-xl">{lang === 'ar' ? lightboxItem.serviceAr : lightboxItem.service}</p>
                <p className="text-gray-400 text-sm mt-1">"{lang === 'ar' ? lightboxItem.testimonialAr : lightboxItem.testimonial}"</p>
                <p className="text-gray-500 text-xs mt-2">— {lightboxItem.client}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <section className="py-20 bg-[#0a0a0a] text-center border-t border-white/10">
        <h2 className="font-serif text-4xl text-gold mb-4">
          {lang === 'ar' ? 'هل أنتِ مستعدة لتحولك؟' : 'Ready for Your Transformation?'}
        </h2>
        <p className="text-gray-400 mb-8">{lang === 'ar' ? 'احجزي موعدك اليوم' : 'Book your appointment today'}</p>
        <Link href="/book">
          <Button variant="shop" size="lg">{lang === 'ar' ? 'احجزي الآن' : 'Book Appointment'}</Button>
        </Link>
      </section>
    </div>
  );
}
