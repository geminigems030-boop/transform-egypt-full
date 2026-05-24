import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Link } from 'wouter';
import { Clock, ChevronDown, ChevronUp, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackViewContent } from '@/lib/analytics';

import serviceHair from '@assets/SERVICE_Hair_Extensions__1774666489143.JPG';
import serviceLash from '@assets/SERVICE_Lash_Extensions__1774666489142.JPG';
import serviceBrows from '@assets/SERVICE_Brow_Extensions_Microblading_1774666489143.JPG';
import serviceSkin from '@assets/IMG_3578_1774668525770.jpeg';
import serviceMakeup from '@assets/IMG_4549_1774668422662.jpeg';
import serviceNails from '@assets/Nails__1774666730979.JPG';
import serviceWigs from '@assets/Wigs_1774666730978.jpg';
import serviceTreatment from '@assets/Hair_treatments__1774666730979.JPG';

const serviceImageMap: Record<string, string> = {
  hair: serviceHair,
  lash: serviceLash,
  brows: serviceBrows,
  skin: serviceSkin,
  nails: serviceNails,
  wigs: serviceWigs,
  treatment: serviceTreatment,
  makeup: serviceMakeup,
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

const serviceCategories = [
  {
    id: 'hair',
    badge: 'MOST POPULAR',
    nameEn: 'Hair Extensions', nameAr: 'اكستنشن الشعر',
    taglineEn: 'Volume, length & confidence — all in one session',
    taglineAr: 'حجم وطول وثقة — في جلسة واحدة',
    descEn: 'Our signature service uses only 100% human hair — Indian, Russian, Brazilian & Turkish — ethically sourced for the most natural look and feel. Choose from tape-in, keratin bond, or micro-ring methods.',
    descAr: 'خدمتنا المميزة تستخدم شعر طبيعي 100٪ — هندي، روسي، برازيلي وتركي — بطرق لاصقة، كيراتين، أو ميكرو رينج.',
    featuresEn: ['Indian Extensions — from EGP 11,000 (per 100g, 60cm)', 'Russian Extensions — from EGP 13,000', 'Brazilian Extensions — from EGP 15,000', 'Turkish Extensions — from EGP 20,000', 'Tape-In Extensions — EGP 10,000 to 30,000', 'Invisible Double Face OFFER — EGP 20,000', 'Curly/Blonde — +EGP 2,000', 'Installation Only — EGP 4,000'],
    featuresAr: ['اكستنشن هندي — تبدأ من 11,000 جنيه (لكل 100 جرام، 60 سم)', 'اكستنشن روسي — تبدأ من 13,000 جنيه', 'اكستنشن برازيلي — تبدأ من 15,000 جنيه', 'اكستنشن تركي — تبدأ من 20,000 جنيه', 'اكستنشن تيب إن (لاصق) — 10,000 لـ 30,000 جنيه', 'عرض Invisible Double Face — 20,000 جنيه', 'كيرلي/أشقر — +2,000 جنيه', 'تركيب فقط — 4,000 جنيه'],
    durationEn: '2–5 hours', durationAr: '2–5 ساعات',
    priceEn: 'From EGP 10,000', priceAr: 'تبدأ من 10,000 جنيه',
  },
  {
    id: 'lash',
    nameEn: 'Lash Extensions', nameAr: 'اكستنشن رموش (لاش)',
    taglineEn: 'Effortlessly stunning eyes — wake up ready',
    taglineAr: 'عيون ساحرة بدون مجهود',
    descEn: 'From subtle enhancement to dramatic volume, our certified lash artists create the perfect look using premium silk and mink lashes.',
    descAr: 'من التعزيز الطبيعي إلى الحجم الدرامي، فنانات الرموش المعتمدات يصنعن الإطلالة المثالية.',
    featuresEn: ['Classic — EGP 1,050', '2D — EGP 1,300', '3D — EGP 1,500', 'Volume — EGP 1,800', 'Mega Volume — EGP 2,100', 'Fox Lashes — EGP 3,000'],
    featuresAr: ['كلاسيك — 1,050 جنيه', 'هايبرد 2D — 1,300 جنيه', '3D — 1,500 جنيه', 'فوليوم — 1,800 جنيه', 'ميجا فوليوم — 2,100 جنيه', 'فوكس لاش — 3,000 جنيه'],
    durationEn: '1.5–2.5 hours', durationAr: '1.5–2.5 ساعة',
    priceEn: 'From EGP 1,050', priceAr: 'تبدأ من 1,050 جنيه',
  },
  {
    id: 'brows',
    nameEn: 'Microblading & Brows', nameAr: 'مايكروبليدنج وحواجب',
    taglineEn: 'Perfect brows — semi-permanent, flawless results',
    taglineAr: 'حواجب مثالية — نتائج شبه دائمة',
    descEn: 'Precision microblading and brow extensions by world-certified artists. Create natural, full brows that last.',
    descAr: 'مايكروبليدنج دقيق واكستنشن حواجب من آرتيستات معتمدات دولياً.',
    featuresEn: ['Microblading OFFER — EGP 1,900', 'Microblading Touch-up — EGP 1,150', 'Brow Extensions — EGP 1,450', 'Lip Blushing OFFER — EGP 2,700', 'Lip Blushing Touch-up — EGP 1,400', 'Micropigmentation — EGP 3,800 per area'],
    featuresAr: ['عرض مايكروبليدنج — 1,900 جنيه', 'تتش أب مايكروبليدنج — 1,150 جنيه', 'اكستنشن حواجب — 1,450 جنيه', 'عرض ليب بلاشينج (توريد شفايف) — 2,700 جنيه', 'تتش أب ليب بلاشينج — 1,400 جنيه', 'مايكروبيجمنتيشن — 3,800 جنيه لكل منطقة'],
    durationEn: '1–2 hours', durationAr: '1–2 ساعة',
    priceEn: 'From EGP 1,150', priceAr: 'تبدأ من 1,150 جنيه',
  },
  {
    id: 'skin',
    nameEn: 'Skin Care & Facials', nameAr: 'سكين كير وفيشيال',
    taglineEn: 'Glow from within — expert treatments for radiant skin',
    taglineAr: 'توهجي من الداخل — علاجات خبيرة لبشرة مشرقة',
    descEn: 'Advanced skin treatments from deep cleansing to dermapen and diamond crystal facials. Rejuvenate and reveal your best skin.',
    descAr: 'علاجات بشرة متقدمة من التنظيف العميق إلى الديرمابن والكريستال الدايموند.',
    featuresEn: ['Skin Cleansing — starts at EGP 1,500', 'Dermapen — EGP 2,000', 'Lifting Face Massage — EGP 1,000', 'Dermaplaning — EGP 500', 'Diamond Crystal — EGP 2,000', 'Face Wax — EGP 600', '✦ OFFER: Skin Booster — EGP 1,500', '✦ OFFER: Glutathione — EGP 1,500', '✦ OFFER: All Three for — EGP 4,000'],
    featuresAr: ['تنظيف بشرة — تبدأ من 1,500 جنيه', 'ديرمابن — 2,000 جنيه', 'مساج شد للوجه — 1,000 جنيه', 'ديرمابلانينج — 500 جنيه', 'كريستال دايموند — 2,000 جنيه', 'واكس وجه — 600 جنيه', '✦ عرض: سكن بوستر — 1,500 جنيه', '✦ عرض: جلوتاثيون — 1,500 جنيه', '✦ عرض: الثلاثة معاً — 4,000 جنيه'],
    durationEn: '30 min – 1.5 hours', durationAr: '30 دقيقة – 1.5 ساعة',
    priceEn: 'From EGP 500', priceAr: 'تبدأ من 500 جنيه',
  },
  {
    id: 'nails',
    nameEn: 'Nails & Beauty', nameAr: 'نيلز وبيوتي',
    taglineEn: 'Flawless nails — gel, acrylic & nail art',
    taglineAr: 'أظافر مثالية — جل، أكريليك وتصميم',
    descEn: 'From hard gel and acrylic extensions to nail art and classic manicure/pedicure — complete nail care.',
    descAr: 'من الهارد جل والأكريليك إلى تصميم الأظافر والمانيكير الكلاسيكي.',
    featuresEn: ['Hard Gel & Acrylic — EGP 1,500', 'Nail Extensions — +EGP 1,500', 'Nail Treatment — EGP 300', 'Gel Color — EGP 350', 'Gel Color Removal — EGP 250', 'Nail Design — EGP 200', 'Artificial Nails — from EGP 450', 'Hand Manicure — EGP 300', 'Foot Pedicure — EGP 350', 'Regular Polish — EGP 150', 'French Polish — EGP 200'],
    featuresAr: ['هارد جل وأكريليك — 1,500 جنيه', 'تركيب أظافر — +1,500 جنيه', 'علاج أظافر — 300 جنيه', 'لون جل — 350 جنيه', 'إزالة لون جل — 250 جنيه', 'ديزاين أظافر — 200 جنيه', 'أظافر صناعية — تبدأ من 450 جنيه', 'مانيكير يد — 300 جنيه', 'بديكير رجل — 350 جنيه', 'مانيكير عادي — 150 جنيه', 'فرنش — 200 جنيه'],
    durationEn: '30 min – 2 hours', durationAr: '30 دقيقة – ساعتين',
    priceEn: 'From EGP 150', priceAr: 'تبدأ من 150 جنيه',
  },
  {
    id: 'wigs',
    nameEn: 'Wigs', nameAr: 'بواريك',
    taglineEn: 'Luxury custom wigs — 100% human hair',
    taglineAr: 'بواريك فاخرة — شعر طبيعي 100٪',
    descEn: 'Premium custom-made wigs crafted from the finest human hair. Perfect fit, natural look, complete confidence.',
    descAr: 'بواريك فاخرة مصنوعة من أجود أنواع الشعر الطبيعي.',
    featuresEn: ['Custom Wig — starts at EGP 25,000', 'Styling & fitting included', '100% human hair', 'Multiple lengths & textures'],
    featuresAr: ['بواريك — تبدأ من 25,000 جنيه', 'التصفيف والتركيب مشمول', 'شعر طبيعي 100٪', 'أطوال وتكسچرات متعددة'],
    durationEn: '1–2 hours', durationAr: '1–2 ساعة',
    priceEn: 'From EGP 25,000', priceAr: 'تبدأ من 25,000 جنيه',
  },
  {
    id: 'treatment',
    nameEn: 'Hair Treatments', nameAr: 'علاجات الشعر',
    taglineEn: 'Restore, repair & revitalize your hair',
    taglineAr: 'استعيدي، أصلحي وأعيدي الحيوية لشعرك',
    descEn: 'Professional hair treatments to repair damage, restore shine, and strengthen your hair from root to tip.',
    descAr: 'علاجات شعر احترافية لإصلاح التلف واستعادة اللمعان والقوة.',
    featuresEn: ['Hair Treatment — starts at EGP 2,000', 'Deep conditioning', 'Damage repair', 'Shine restoration'],
    featuresAr: ['علاج شعر — تبدأ من 2,000 جنيه', 'ترطيب عميق', 'إصلاح التلف', 'استعادة اللمعان'],
    durationEn: '1–1.5 hours', durationAr: '1–1.5 ساعة',
    priceEn: 'From EGP 2,000', priceAr: 'تبدأ من 2,000 جنيه',
  },
];

function PriceAccordion({ service, lang }: { service: typeof serviceCategories[0]; lang: 'en' | 'ar' }) {
  const [open, setOpen] = useState(false);
  const features = lang === 'ar' ? service.featuresAr : service.featuresEn;

  return (
    <div className="border border-taupe rounded-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 bg-ivory hover:bg-taupe/30 transition-colors">
        <span className="font-medium text-black">{lang === 'ar' ? 'عرض الأسعار' : 'View Full Price List'}</span>
        {open ? <ChevronUp className="w-5 h-5 text-gold" /> : <ChevronDown className="w-5 h-5 text-gold" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="p-4 bg-white">
              <ul className="space-y-2">
                {features.map((f, i) => (
                  <li key={i} className={cn("flex items-start gap-2 text-sm", f.startsWith('✦') ? 'text-gold font-semibold' : 'text-gray-700')}>
                    {f.startsWith('✦') ? <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-gold" /> : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-gold/60" />}
                    {f.replace('✦ ', '')}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Services() {
  const { t, lang } = useTranslation();

  // Meta Pixel ViewContent — fires once on mount so /services contributes to
  // category-level retargeting audiences alongside the SPA PageView.
  useEffect(() => {
    trackViewContent({ contentName: 'Services', contentCategory: 'service' });
  }, []);

  return (
    <div className="min-h-screen bg-ivory">
      {/* Hero — extra top padding to clear fixed header (item #6) */}
      <section className="relative pt-40 pb-28 md:pt-48 md:pb-32 bg-black text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-black"></div>
        <div className="relative container mx-auto px-4 text-center">
          <p className="text-gold uppercase tracking-[0.25em] text-xs font-bold mb-4">TransforM Egypt</p>
          <h1 className="font-serif text-5xl md:text-6xl mb-4">{lang === 'ar' ? 'خدماتنا المميزة' : 'Signature Services'}</h1>
          <p className="text-gray-300 text-lg">{lang === 'ar' ? 'جمال على مستوى المشاهير، مصمم لك' : 'Celebrity-level beauty, tailored to you'}</p>
          {/* Italic accent +30% (item #14) */}
          <p className="text-gold font-serif italic text-2xl md:text-3xl mt-5">{lang === 'ar' ? 'أنتِ جديدة، اليوم!' : 'A new you, Today!'}</p>
        </div>
      </section>

      {/* Services List */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-24">
            {serviceCategories.map((service, index) => (
              <motion.div key={service.id} id={service.id} variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
                className={cn("flex flex-col gap-12 scroll-mt-32", index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse")}
              >
                {/* Image */}
                <div className="w-full lg:w-1/2 relative overflow-hidden rounded-sm">
                  {service.badge && (
                    /* Refined editorial badge — cream bg, deep gold border, serif italic (item #11) */
                    <div className="absolute top-4 left-4 z-10 bg-ivory text-black border border-[#B89968] font-serif italic text-xs tracking-[0.2em] py-1.5 px-4 shadow-sm">
                      {service.badge}
                    </div>
                  )}
                  <img
                    src={serviceImageMap[service.id] || serviceHair}
                    alt={service.nameEn}
                    className={cn(
                      "w-full h-full object-cover aspect-[4/3] shadow-lg",
                      /* Ken-Burns subtle breathing on the signature Hair Extensions hero shot (item B3) */
                      service.id === 'hair' && "animate-ken-burns"
                    )}
                  />
                </div>

                {/* Content */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center">
                  <h2 className="font-serif text-4xl md:text-5xl mb-2 text-black">{lang === 'ar' ? service.nameAr : service.nameEn}</h2>
                  {/* Italic tagline +30% (item #14) */}
                  <p className="text-gold italic text-xl md:text-2xl mb-6 font-serif">{lang === 'ar' ? service.taglineAr : service.taglineEn}</p>
                  <p className="text-gray-600 font-light leading-relaxed mb-6">{lang === 'ar' ? service.descAr : service.descEn}</p>

                  <div className="flex items-center gap-6 mb-6 text-sm text-gray-500">
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gold" />{lang === 'ar' ? service.durationAr : service.durationEn}</span>
                    <span className="text-gold font-semibold text-base">{lang === 'ar' ? service.priceAr : service.priceEn}</span>
                  </div>

                  <PriceAccordion service={service} lang={lang} />

                  <div className="mt-8">
                    <Link href="/book">
                      <Button variant="shop" className="uppercase tracking-widest text-xs">
                        {lang === 'ar' ? 'احجزي الآن' : 'Book Now'} <ArrowRight className={cn("w-4 h-4", lang === 'ar' ? 'mr-2' : 'ml-2')} />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA — duplicate "A new you, Today!" tagline removed (item #10);
          tagline already shown in the hero above this page. */}
      <section className="py-20 bg-black text-center">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-4xl md:text-5xl text-white mb-6">{lang === 'ar' ? 'استشارة مجانية' : 'FREE Consultation'}</h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">{lang === 'ar' ? 'زوري أي فرع من فروعنا للحصول على استشارة مجانية شخصية من خبراء التجميل لدينا.' : 'Visit any of our branches for a FREE personalized consultation with our beauty experts.'}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/book"><Button variant="shop" size="lg">{lang === 'ar' ? 'احجزي الآن' : 'Book Now'}</Button></Link>
            <a href="https://wa.me/201009780008" target="_blank" rel="noreferrer"><Button variant="secondary" size="lg">{lang === 'ar' ? 'واتساب' : 'WhatsApp'}</Button></a>
          </div>
        </div>
      </section>
    </div>
  );
}
