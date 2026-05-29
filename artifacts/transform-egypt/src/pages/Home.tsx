import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, type Variants } from 'framer-motion';
import gsap from 'gsap';
import { Link } from 'wouter';
import {
  ChevronDown, Star, Sparkles, MapPin, Crown, Award, ArrowRight,
  ChevronLeft, ChevronRight, Quote, Phone, Clock, Users, Instagram
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LazyImage from '@/components/LazyImage';
import Faq from '@/components/sections/Faq';
import Press from '@/components/sections/Press';
import { InstagramFeed } from '@/components/InstagramFeed';
import { useListServices, useListReviews } from '@workspace/api-client-react';
import { trackContact } from '@/lib/analytics';

import heroImage from '@assets/CTA_luxury_salon_interior__1774666489143.jpg';
import heroVideo from '@assets/hero_video.mp4';
import founderImage from '@assets/Founder_Mervat_Atalla__1774666489143.PNG';
/* TransforM Celebrity Chair — Featured Transformation Series.
   The previous A/D/E pairs remain in the full /transformations gallery. */
import entesarBefore from '@assets/9AEC0655-1BBE-4DE5-A816-6A2098A68A96_1777894504392.png';
import entesarAfter from '@assets/8FD0845C-1FF7-4E9B-8F9F-C4035BBEBACE_1777894504392.png';
import dinaBefore from '@assets/IMG_9770_1777894643110.jpeg';
import dinaAfter from '@assets/IMG_9776_1777894643110.jpeg';
import houriyaAfter from '@assets/3864064F-DD33-4074-AD3C-895E167A6C8E_1777894727981.jpeg';
/* Houriya "before" = left half of the pre-made split image (cropped to /public/transformations) */
const houriyaBefore = '/transformations/houriya-before.jpeg';
import serviceHair from '@assets/SERVICE_Hair_Extensions__1774666489143.JPG';
import serviceLash from '@assets/SERVICE_Lash_Extensions__1774666489142.JPG';
import serviceBrows from '@assets/SERVICE_Brow_Extensions_Microblading_1774666489143.JPG';
import serviceSkin from '@assets/IMG_3578_1774668525770.jpeg';
import serviceMakeup from '@assets/IMG_4549_1774668422662.jpeg';
import serviceNails from '@assets/SERVICE_Nails__1774666489143.jpg';
import serviceWigs from '@assets/SERVICE_Wigs_1774666489143.jpg';
import celebHorreya from '@assets/Celebrity_Horreya_Farghally__1774666730978.jpg';
import celebCamila from '@assets/Celebrity_Camella_Cabello__1774666730978.JPEG';
import hairColoring from '@assets/Hair_coloring__1774666730978.jpg';
import hairColoring2 from '@assets/Hair_coloring_2_1774666730978.jpg';
import hairExtDisplay from '@assets/Hair_extensions_Display__1774666730978.PNG';
import clientsConsult from '@assets/Clients_Checking_Various_Hair_Extensions_options__1774666730978.jpg';

const serviceImageMap: Record<string, string> = {
  'Luxury Hair Extensions': serviceHair,
  'Hair Extensions': serviceHair,
  'Lash Extensions': serviceLash,
  'Microblading & Brows': serviceBrows,
  'Microblading': serviceBrows,
  'Skin Care & Facials': serviceSkin,
  'Facials & Skin Treatments': serviceSkin,
  'Facials': serviceSkin,
  'Professional Makeup': serviceMakeup,
  'Makeup': serviceMakeup,
  'Nails & Beauty': serviceNails,
  'Nails': serviceNails,
  'Wigs': serviceWigs,
  'Hair Treatments': serviceHair,
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

const WHATSAPP_NUM = '201009780008';
const PHONE_1 = '01009780008';
const PHONE_2 = '01004545700';

const branches = [
  { nameEn: 'City Stars Mall', nameAr: 'سيتي ستارز مول', detailEn: 'Ground floor, Gate 7 (next to Cafe Supreme)', detailAr: 'الدور الأرضي، بوابة 7 (بجانب كافيه سوبريم)', mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+City+Stars+Mall+Cairo' },
  { nameEn: 'Sofitel Downtown Cairo', nameAr: 'سوفيتيل داون تاون القاهرة', detailEn: 'Downstairs (next to Banque Misr)', detailAr: 'الدور السفلي (بجانب بنك مصر)', mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Sofitel+Downtown+Cairo' },
  { nameEn: 'O Mall — New Alamein', nameAr: 'أوه مول — العلمين الجديدة', detailEn: 'Mediterranean Coast — North Coast', detailAr: 'الساحل المتوسطي — الساحل الشمالي', mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+O+Mall+New+Alamein' },
];

/* ── Before/After Slider ──
   hideLabels: when the source images already include their own typography
   (e.g. branded "Celebrity Chair" composites with EN+AR name overlays), set
   true so the slider's corner BEFORE/AFTER pills don't clash with the art. */
function BeforeAfterSlider({ before, after, hideLabels = false }: { before: string; after: string; hideLabels?: boolean }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100);
    setSliderPos(pct);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/5] overflow-hidden rounded-sm cursor-ew-resize select-none bg-black"
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

/* ── Testimonials ── */
const mockReviews = [
  { id: 1, clientName: "Nour Hassan", clientNameAr: "نور حسن", text: "TransforM completely changed my confidence! Mervat is a true artist. My tape-in extensions look completely natural and lasted over 6 months.", textAr: "ترانسفورم غيّرت ثقتي بنفسي تماماً! ميرفت فنانة حقيقية.", service: "Tape-In Hair Extensions", rating: 5 },
  { id: 2, clientName: "Farah Al-Rashid", clientNameAr: "فرح الرشيد", text: "Best lash extensions I've ever had in Cairo. The studio is elegant, the staff is professional, and the results are absolutely stunning.", textAr: "أفضل رموش تعلتها في القاهرة على الإطلاق. ستوديو راقي ونتائج مذهلة.", service: "Volume Lash Extensions", rating: 5 },
  { id: 3, clientName: "Mariam Samir", clientNameAr: "مريم سمير", text: "I flew in from Dubai specifically for Mervat's microblading. Worth every penny! My brows have never looked this perfect in my life.", textAr: "سافرت من دبي خصيصاً للمايكروبليدنج مع ميرفت. يستحق كل قرش!", service: "Microblading & Brows", rating: 5 },
  { id: 4, clientName: "Salma Khaled", clientNameAr: "سلمى خالد", text: "The VIP experience is unmatched. From the moment you walk in, every detail is perfect. TransforM is truly Cairo's #1 luxury salon.", textAr: "تجربة VIP لا مثيل لها. من لحظة دخولك، كل تفصيلة مثالية.", service: "Bridal Package", rating: 5 },
];

/* ── Quiz ── */
const quizSteps = [
  { question: "What is your current hair length?", questionAr: "ما هو طول شعرك الحالي؟", options: ["Short (above shoulders)", "Medium (shoulder length)", "Long (below shoulders)"], optionsAr: ["قصير (فوق الكتف)", "متوسط (مستوى الكتف)", "طويل (تحت الكتف)"] },
  { question: "How thick is your natural hair?", questionAr: "كيف كثافة شعرك الطبيعي؟", options: ["Thin", "Medium", "Thick"], optionsAr: ["خفيف", "متوسط", "كثيف"] },
  { question: "How much volume do you want?", questionAr: "كم من الحجم تريدين؟", options: ["Natural volume", "Noticeable volume", "Maximum volume"], optionsAr: ["حجم طبيعي", "حجم ملحوظ", "أقصى حجم"] },
  { question: "What length are you aiming for?", questionAr: "ما الطول المستهدف؟", options: ["Shoulder length", "Mid-back", "Waist length"], optionsAr: ["مستوى الكتف", "منتصف الظهر", "مستوى الخصر"] },
  { question: "What is your style preference?", questionAr: "ما أسلوبك المفضل؟", options: ["Straight", "Wavy", "Curly"], optionsAr: ["ناعم", "متموج", "مجعد"] },
];

const quizResults: Record<string, { title: string; desc: string; price: string }> = {
  default: { title: "Tape-In Extensions", desc: "Perfect for your hair type — seamless, natural, and long-lasting. Our invisible double-face tape-in extensions blend beautifully.", price: "EGP 10,000 – 30,000" },
  thick: { title: "Keratin Bond Extensions", desc: "Ideal for thick hair — keratin bonds provide the strongest hold and the most natural movement.", price: "EGP 13,000+" },
  volume: { title: "Indian Premium Extensions", desc: "Maximum volume with premium Indian hair — 100g at 60cm for stunning, full results.", price: "EGP 11,000+" },
};

function QuizSection({ lang }: { lang: 'en' | 'ar' }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const handleAnswer = (idx: number) => {
    const newAnswers = [...answers, idx];
    if (step < quizSteps.length - 1) {
      setAnswers(newAnswers);
      setStep(step + 1);
    } else {
      setAnswers(newAnswers);
      setDone(true);
    }
  };

  const reset = () => { setStep(0); setAnswers([]); setDone(false); };
  const result = answers[1] === 2 ? quizResults.thick : answers[2] === 2 ? quizResults.volume : quizResults.default;
  const current = quizSteps[step];

  return (
    <section className="py-24 bg-ivory">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="font-serif text-4xl md:text-5xl mb-4 text-black">
            {lang === 'ar' ? 'لاقي الاكستنشن المثالي ليكي' : 'Find Your Perfect Hair Extensions'}
          </motion.h2>
          <p className="text-warm-grey text-lg mb-12">
            {lang === 'ar' ? 'اختبار 60 ثانية للتوصيات الشخصية' : 'Take our 60-second quiz for personalized recommendations'}
          </p>

          {!done ? (
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-sm shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-warm-grey text-sm">{lang === 'ar' ? `خطوة ${step + 1} من ${quizSteps.length}` : `Step ${step + 1} of ${quizSteps.length}`}</span>
                <div className="flex gap-1">
                  {quizSteps.map((_, i) => (
                    <div key={i} className={cn("h-1 w-8 rounded-full transition-colors", i <= step ? "bg-gold" : "bg-taupe")} />
                  ))}
                </div>
              </div>
              <h3 className="font-serif text-2xl mb-8 text-black">{lang === 'ar' ? current.questionAr : current.question}</h3>
              <div className="grid gap-3">
                {(lang === 'ar' ? current.optionsAr : current.options).map((opt, i) => (
                  <button key={i} onClick={() => handleAnswer(i)} className="w-full text-left border border-taupe p-4 rounded-sm hover:border-gold hover:bg-gold/5 transition-all font-medium text-black">
                    {opt}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-black text-white rounded-sm p-8">
              <div className="text-gold font-serif text-4xl mb-2">✦</div>
              <p className="text-gold uppercase tracking-widest text-xs mb-4">{lang === 'ar' ? 'توصيتنا لك' : 'Our Recommendation For You'}</p>
              <h3 className="font-serif text-3xl mb-4">{result.title}</h3>
              <p className="text-gray-300 font-light mb-6 leading-relaxed">{result.desc}</p>
              <p className="text-gold text-2xl font-serif mb-8">{result.price}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/book">
                  <Button variant="shop">{lang === 'ar' ? 'احجزي استشارة مجانية' : 'Book FREE Consultation'}</Button>
                </Link>
                <button onClick={reset} className="text-gray-400 hover:text-white transition-colors text-sm underline">{lang === 'ar' ? 'ابدأي من جديد' : 'Start Over'}</button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

const prestigiousLocations = [
  {
    number: '01',
    nameEn: 'City Stars Mall', nameAr: 'سيتي ستارز مول',
    subtitleEn: 'Ground Floor · Gate 7', subtitleAr: 'الدور الأرضي · بوابة 7',
    tagEn: 'Cairo\'s Iconic Megamall', tagAr: 'أيقونة القاهرة',
    color: '#2a1a00',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+City+Stars+Mall+Cairo',
  },
  {
    number: '02',
    nameEn: 'Cairo Festival City Mall', nameAr: 'كايرو فيستيفال سيتي مول',
    subtitleEn: '3rd Floor · New Cairo', subtitleAr: 'الدور الثالث · القاهرة الجديدة',
    tagEn: 'Premium New Cairo Flagship', tagAr: 'الفرع البريميوم بالقاهرة الجديدة',
    color: '#0d1a0d',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Cairo+Festival+City+Mall',
  },
  {
    number: '03',
    nameEn: 'Sofitel Cairo', nameAr: 'سوفيتيل القاهرة',
    subtitleEn: 'Sofitel Downtown Cairo · Lower Level', subtitleAr: 'سوفيتيل داون تاون · الدور السفلي',
    tagEn: 'Five-Star Elegance', tagAr: 'أناقة خمس نجوم',
    color: '#0a0f1a',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Sofitel+Downtown+Cairo',
  },
  {
    number: '04',
    nameEn: 'The Nile Ritz-Carlton', nameAr: 'نايل ريتز كارلتون',
    subtitleEn: '1st Floor · Nile Corniche', subtitleAr: 'الدور الأول · كورنيش النيل',
    tagEn: 'Ultra-Luxury Waterfront', tagAr: 'فخامة على ضفاف النيل',
    color: '#1a0d00',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Nile+Ritz+Carlton+Cairo',
    closed: true,
  },
  {
    number: '05',
    nameEn: 'Walk of Cairo', nameAr: 'ووك أوف كايرو',
    subtitleEn: 'Sheikh Zayed · Open-Air Promenade', subtitleAr: 'الشيخ زايد · بروميناد مفتوح',
    tagEn: 'Sheikh Zayed\'s Finest', tagAr: 'أرقى الشيخ زايد',
    color: '#1a001a',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Walk+of+Cairo',
    closed: true,
  },
  {
    number: '06',
    nameEn: 'O Mall — New Alamein', nameAr: 'أوه مول — العلمين الجديدة',
    subtitleEn: 'Mediterranean Coast · North Coast', subtitleAr: 'الساحل المتوسطي · الساحل الشمالي',
    tagEn: 'The Mediterranean Retreat', tagAr: 'ملاذ البحر المتوسط',
    color: '#001020',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+O+Mall+New+Alamein',
  },
];

function PrestigiousLocations({ lang }: { lang: 'en' | 'ar' }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="bg-[#050505] py-20 md:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16 md:mb-24">
          <p className="text-gold text-xs uppercase tracking-[0.5em] font-light mb-4">
            {lang === 'ar' ? 'وجهاتنا المرموقة' : 'Our Prestigious Locations'}
          </p>
          <h2 className="font-serif text-4xl md:text-6xl text-white">
            {lang === 'ar' ? 'ستة فروع · أرقى العناوين في مصر' : 'Six Addresses · One Standard of Excellence'}
          </h2>
        </motion.div>

        <div className="divide-y divide-white/[0.06]">
          {prestigiousLocations.map((loc, i) => (
            <motion.a
              key={i}
              href={loc.closed ? '/locations' : loc.mapUrl}
              target={loc.closed ? undefined : '_blank'}
              rel={loc.closed ? undefined : 'noopener noreferrer'}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={`group flex items-center justify-between py-7 md:py-10 relative transition-all duration-500 block ${loc.closed ? 'opacity-60' : ''}`}
              style={{ background: hovered === i ? `linear-gradient(to right, ${loc.color}, transparent)` : 'transparent' }}
            >
              <div className="flex items-center gap-6 md:gap-12 flex-1 min-w-0">
                <span className="text-white/20 font-serif text-sm md:text-base tracking-widest hidden sm:block flex-shrink-0 group-hover:text-gold/40 transition-colors duration-300">
                  {loc.number}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className={`font-serif text-xl md:text-3xl leading-tight transition-colors duration-300 ${loc.closed ? 'text-white/70' : 'text-white group-hover:text-gold'}`}>
                      {lang === 'ar' ? loc.nameAr : loc.nameEn}
                    </h3>
                    {loc.closed && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs uppercase tracking-widest font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {lang === 'ar' ? 'مغلق مؤقتاً' : 'Closed for Renovation'}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm font-light mt-1 group-hover:text-gray-400 transition-colors">
                    {lang === 'ar' ? loc.subtitleAr : loc.subtitleEn}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                <span className="hidden md:block text-gray-600 text-xs tracking-widest uppercase font-light group-hover:text-gold/60 transition-colors">
                  {lang === 'ar' ? loc.tagAr : loc.tagEn}
                </span>
                <span className="text-white/20 group-hover:text-gold transition-all duration-300 text-xl">→</span>
              </div>
              <div
                className="absolute inset-y-0 left-0 w-0.5 transition-all duration-500"
                style={{ background: hovered === i ? '#D4B97A' : 'transparent', opacity: hovered === i ? 1 : 0 }}
              />
            </motion.a>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="mt-14 flex gap-4">
          <Link href="/book">
            <Button variant="primary" size="lg" className="uppercase tracking-widest text-sm">
              {lang === 'ar' ? 'احجزي في فرعك الأقرب' : 'Book at Your Nearest Branch'}
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t, lang } = useTranslation();
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [introComplete, setIntroComplete] = useState(true);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('preload', 'auto');
    vid.load();
    const tryPlay = () => { vid.play().catch(() => {}); };
    tryPlay();
    vid.addEventListener('loadeddata', tryPlay, { once: true });
    vid.addEventListener('canplay', tryPlay, { once: true });
    document.addEventListener('touchstart', tryPlay, { once: true });
    return () => { document.removeEventListener('touchstart', tryPlay); };
  }, []);

  const heroTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroTextRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        heroTextRef.current!.querySelectorAll('.gsap-hero-line'),
        { opacity: 0.2, y: 40, skewY: 1 },
        { opacity: 1, y: 0, skewY: 0, duration: 1.2, stagger: 0.18, ease: 'power3.out', delay: 0.3 }
      );
    }, heroTextRef);
    return () => ctx.revert();
  }, []);

  const { data: servicesData } = useListServices();
  const { data: reviewsData } = useListReviews();

  const services = servicesData?.services || [
    { id: 1, name: "Luxury Hair Extensions", nameAr: "اكستنشن شعر لاكشري", description: "Indian, Russian, Brazilian & Turkish premium extensions. Tape-in, keratin bond & more.", descriptionAr: "اكستنشن هندي، روسي، برازيلي وتركي. تيب إن وكيراتين بوند.", startingPrice: 10000, image: "service-hair.png", isFeatured: true, badge: "MOST POPULAR" },
    { id: 2, name: "Lash Extensions", nameAr: "اكستنشن رموش (لاش)", description: "Classic, 2D, 3D, Volume, Mega Volume & Fox lash sets.", descriptionAr: "كلاسيك، 2D، 3D، فوليوم، ميجا فوليوم ولاش فوكس.", startingPrice: 1050, image: "service-lashes.png", isFeatured: false },
    { id: 3, name: "Microblading & Brows", nameAr: "مايكروبليدنج وحواجب", description: "Semi-permanent microblading & brow extensions for perfect brows.", descriptionAr: "مايكروبليدنج شبه دائم واكستنشن حواجب.", startingPrice: 1450, image: "service-brows.png", isFeatured: false },
    { id: 4, name: "Skin Care & Facials", nameAr: "سكين كير وفيشيال", description: "Dermapen, diamond crystal, lifting massage, dermaplaning & more.", descriptionAr: "ديرمابن، كريستال دايموند، ليفتينج ماساج، ديرمابلانينج.", startingPrice: 500, image: "service-facials.png", isFeatured: false },
    { id: 5, name: "Nails & Beauty", nameAr: "نيلز وبيوتي", description: "Hard gel, acrylic, nail art, manicure, pedicure & lip blushing.", descriptionAr: "هارد جيل، أكريليك، نيل آرت، مانيكير، بديكير وليب بلاشينج.", startingPrice: 150, image: "service-nails.png", isFeatured: false },
  ];

  const rawReviews = (reviewsData as any)?.reviews;
  const reviews = rawReviews && rawReviews.length > 0 ? rawReviews : mockReviews;

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [reviews.length]);

  const glassStyle = {
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(184,153,104,0.4)', /* champagne #B89968 — replaces legacy #D4AF37 */
  } as React.CSSProperties;

  return (
    <div className="w-full">
      {/* INTRO CURTAIN */}
      <AnimatePresence>
        {!introComplete && (
          <motion.div
            key="intro-curtain"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="flex flex-col items-center gap-4"
            >
              <motion.img
                src={`${import.meta.env.BASE_URL}logo-t.png`}
                alt="TransforM"
                className="w-20 h-20 object-contain"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7 }}
              />
              <motion.p
                className="font-serif text-gold text-2xl tracking-[0.15em]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.7 }}
              >
                TransforM
              </motion.p>
              <motion.div
                className="w-16 h-[1px] bg-gold/50"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.0, duration: 0.8 }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: HERO */}
      <section ref={heroRef} className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden">
        <motion.div style={{ y: heroY }} className="absolute inset-0 w-full h-full scale-110">
          <video
            ref={videoRef}
            src={heroVideo}
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="auto"
            className="w-full h-full object-cover"
            style={{ pointerEvents: 'none' }}
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/95"></div>

        <div ref={heroTextRef} className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center mt-10">
          <div className="max-w-5xl mx-auto overflow-hidden">
            <div className="gsap-hero-line flex justify-center mb-6">
              <img src={`${import.meta.env.BASE_URL}logo-t.png`} alt="TransforM" loading="eager" fetchPriority="high" decoding="async" className="w-16 h-16 md:w-20 md:h-20 object-contain" />
            </div>
            <p className="gsap-hero-line text-gold text-base md:text-xl font-light tracking-[0.4em] uppercase mb-5">
              {lang === 'ar' ? 'سنتر الاكستنشن رقم ١ في مصر والشرق الأوسط' : 'The #1 Hair Extensions Center in Egypt and the Middle East'}
            </p>
            <h1 className="gsap-hero-line font-serif text-5xl md:text-7xl lg:text-8xl text-white mb-4 leading-[1.05]">
              TransforM Egypt
            </h1>
            <p className="gsap-hero-line font-serif text-2xl md:text-4xl lg:text-5xl text-gold italic mb-10">
              {lang === 'ar' ? 'أنتِ جديدة، اليوم!' : 'A new you, Today!'}
            </p>
            {/* Hero CTA reduced to 1 primary glass pill + 1 ghost text-link (item #2).
                Shop Extensions removed — accessible via the hamburger drawer (Boutique). */}
            <div className="gsap-hero-line flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              <Link href="/book">
                <span
                  className="inline-flex items-center justify-center h-14 px-10 rounded-full text-gold font-semibold text-sm uppercase tracking-[0.2em] shadow-[0_8px_32px_rgba(184,153,104,0.25)] hover:scale-105 hover:shadow-[0_8px_40px_rgba(184,153,104,0.45)] transition-all duration-300 cursor-pointer"
                  style={glassStyle}
                >
                  {lang === 'ar' ? 'احجزي تجربتك' : 'Book Your Experience'}
                </span>
              </Link>
              <Link href="/transformations">
                <span className="group inline-flex items-center gap-2 text-gold text-sm uppercase tracking-[0.25em] font-light cursor-pointer transition-colors hover:text-white">
                  {t('hero.viewTrans')}
                  <span className="inline-block w-5 border-t border-gold/60 group-hover:border-white transition-all duration-300 group-hover:w-8" aria-hidden="true" />
                </span>
              </Link>
            </div>
          </div>
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 1 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gold animate-bounce">
          <ChevronDown className="w-8 h-8 opacity-70" />
        </motion.div>
      </section>

      {/* SECTION 2: SOCIAL PROOF */}
      <section className="bg-ivory py-16 md:py-24 border-b border-taupe">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 text-center">
            <motion.div variants={fadeInUp}>
              <div className="flex justify-center text-gold mb-2">{[...Array(5)].map((_, i) => <Star key={i} className="w-6 h-6 fill-current" />)}</div>
              <h3 className="text-black font-serif text-3xl mb-2">4.9/5</h3>
              <p className="text-warm-grey uppercase tracking-widest text-xs font-semibold">{t('stats.reviews')}</p>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <h3 className="text-gold font-serif text-5xl mb-2">30+</h3>
              <p className="text-black font-medium">{t('stats.years')}</p>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <h3 className="text-gold font-serif text-5xl mb-2">5,000+</h3>
              <p className="text-black font-medium">{t('stats.clients')}</p>
            </motion.div>
            <motion.div variants={fadeInUp} className="flex flex-col items-center">
              <Award className="w-12 h-12 text-gold mb-2" />
              <p className="text-black font-medium uppercase tracking-widest text-sm">{t('stats.celebs')}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2.5: THE TRANSFORM EXPERIENCE — EDITORIAL */}
      <section className="py-28 md:py-40 bg-[#080808] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #D4AF37 0px, #D4AF37 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #D4AF37 0px, #D4AF37 1px, transparent 1px, transparent 60px)' }} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="max-w-5xl mx-auto">
            <div className="flex items-center gap-6 mb-10">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
              <span className="text-gold text-xs uppercase tracking-[0.4em] font-light">The TransforM Experience</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="font-serif text-4xl md:text-6xl lg:text-7xl text-white leading-[1.08] mb-12"
            >
              {lang === 'ar' ? (
                <>فن <em className="text-gold not-italic">التحول</em> — حيث كل تفصيلة تُعدّ</>
              ) : (
                <>The Art of <em className="text-gold not-italic">Metamorphosis</em> — Where Every Detail Counts</>
              )}
            </motion.h2>
            <div className="grid md:grid-cols-2 gap-12 md:gap-20">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.15 }} className="space-y-6 text-gray-400 font-light leading-relaxed text-lg">
                {lang === 'ar' ? (
                  <>
                    <p>ترانسفورم مش مجرد صالون تجميل — دي تجربة بيوتي متكاملة. من أول ما تدخلي، تحسي إنك في عالم تاني: عالم الرقي والدقة والاهتمام بكل تفصيلة.</p>
                    <p>أسستها ميرفت عطا الله قادمةً من لوس أنجلوس، لتجلب معها أعلى معايير الـ Beauty عالمياً. النهارده، أصبحت ترانسفورم الوجهة الأولى للنجمات والمؤثرات في مصر والشرق الأوسط.</p>
                  </>
                ) : (
                  <>
                    <p>TransforM is not merely a salon — it is a complete beauty atelier. From the moment you enter, you inhabit a world of refinement, precision, and obsessive attention to every last detail.</p>
                    <p>Founded by Mervat Atalla — arriving from Los Angeles to bring world-class standards to Cairo — TransforM has become the undisputed destination of choice for celebrities, influencers, and discerning women across Egypt and the Middle East.</p>
                  </>
                )}
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.3 }} className="space-y-6 text-gray-400 font-light leading-relaxed text-lg">
                {lang === 'ar' ? (
                  <>
                    <p>كل علاج هو قصة تحول. كل وصلة شعر هي عمل فني. كل جلسة تجميل هي استثمار في ثقتك بنفسك — وهذا هو وعد ترانسفورم لكِ.</p>
                    <p className="text-gold/90 font-serif text-2xl md:text-3xl italic">"أنتِ جديدة، اليوم!"</p>
                  </>
                ) : (
                  <>
                    <p>Every treatment is a story of transformation. Every hair extension is a work of art. Every session is an investment in your most powerful asset: your confidence — and that is the promise of TransforM.</p>
                    <p className="text-gold/90 font-serif text-2xl md:text-3xl italic">"A new you, Today!"</p>
                  </>
                )}
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="mt-16 flex justify-center">
              <Link href="/book">
                <button className="group relative px-12 py-4 border border-gold/40 text-gold uppercase tracking-[0.3em] text-sm font-light overflow-hidden transition-all hover:border-gold">
                  <span className="absolute inset-0 bg-gold/10 translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                  <span className="relative">{lang === 'ar' ? 'ابدئي تجربتك' : 'Begin Your Experience'}</span>
                </button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 3: TRANSFORMATION GALLERY — switched to ivory to break the back-to-back
          dark sections after the editorial (item A7 — section rhythm). */}
      <section className="py-24 bg-ivory">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="font-serif text-4xl md:text-5xl text-black mb-4">
              {lang === 'ar' ? 'تحولات حقيقية، نتائج حقيقية' : 'Real Transformations, Real Results'}
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-warm-grey text-lg">
              {lang === 'ar' ? 'شاهدي الفرق الذي يصنعه ترانسفورم' : 'See the TransforM difference — drag the slider'}
            </motion.p>
          </div>
          {/* Featured TransforM Celebrity Chair Series — Entesar / Dina / Houriya.
              Composites with built-in branded typography use hideLabels so the slider's
              corner pills don't collide with the gold name overlays. */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div variants={fadeInUp} className="flex flex-col gap-3">
              <BeforeAfterSlider before={entesarBefore} after={entesarAfter} hideLabels />
              <div className="text-center">
                <p className="font-serif text-lg text-black">{lang === 'ar' ? 'انتصار' : 'Entesar'}</p>
                <p className="text-xs uppercase tracking-widest text-warm-grey mt-1">{lang === 'ar' ? 'كرسي المشاهير' : 'Celebrity Chair'}</p>
              </div>
            </motion.div>
            <motion.div variants={fadeInUp} className="flex flex-col gap-3">
              <BeforeAfterSlider before={dinaBefore} after={dinaAfter} />
              <div className="text-center">
                <p className="font-serif text-lg text-black">{lang === 'ar' ? 'دينا' : 'Dina'}</p>
                <p className="text-xs uppercase tracking-widest text-warm-grey mt-1">{lang === 'ar' ? 'كرسي المشاهير' : 'Celebrity Chair'}</p>
              </div>
            </motion.div>
            <motion.div variants={fadeInUp} className="flex flex-col gap-3">
              <BeforeAfterSlider before={houriyaBefore} after={houriyaAfter} hideLabels />
              <div className="text-center">
                <p className="font-serif text-lg text-black">{lang === 'ar' ? 'حورية فرغلي' : 'Houriya Farghaly'}</p>
                <p className="text-xs uppercase tracking-widest text-warm-grey mt-1">{lang === 'ar' ? 'كرسي المشاهير' : 'Celebrity Chair'}</p>
              </div>
            </motion.div>
          </motion.div>
          <div className="text-center mt-12">
            <Link href="/transformations">
              <Button variant="secondary" size="lg" className="uppercase tracking-widest text-sm">
                {lang === 'ar' ? 'عرض كل التحولات' : 'View All Transformations'} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 4: SIGNATURE SERVICES */}
      <section className="py-24 bg-white text-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="font-serif text-4xl md:text-5xl mb-4">{t('services.title')}</motion.h2>
            <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-warm-grey text-lg">{t('services.subtitle')}</motion.p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div key={service.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}
                className={cn("group relative rounded-sm overflow-hidden bg-ivory border border-taupe shadow-sm hover:shadow-xl hover:shadow-gold/10 hover:-translate-y-2 transition-all duration-300", service.isFeatured ? "md:col-span-2 lg:col-span-2 flex flex-col md:flex-row" : "flex flex-col")}
              >
                {service.badge && (
                  /* Editorial badge — cream bg, deep gold border, serif italic (item #11) */
                  <div className="absolute top-4 left-4 z-20 bg-ivory text-black border border-[#B89968] font-serif italic text-xs tracking-[0.2em] py-1.5 px-4 shadow-sm">
                    {service.badge}
                  </div>
                )}
                <div className={cn("relative overflow-hidden", service.isFeatured ? "md:w-1/2 h-64 md:h-auto" : "h-64 w-full")}>
                  <LazyImage
                    src={serviceImageMap[service.name] || serviceHair}
                    alt={lang === 'ar' ? service.nameAr : service.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className={cn("p-8 flex flex-col justify-center", service.isFeatured ? "md:w-1/2" : "w-full")}>
                  <h3 className="font-serif text-2xl mb-3 group-hover:text-gold transition-colors">{lang === 'ar' ? service.nameAr : service.name}</h3>
                  <p className="text-gray-600 mb-6 font-light leading-relaxed flex-grow">{lang === 'ar' ? service.descriptionAr : service.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-semibold text-lg">{t('services.from')} EGP {service.startingPrice.toLocaleString()}</span>
                    <Link href="/book"><Button variant="shop" size="sm">{t('services.book')}</Button></Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: WHY CHOOSE TRANSFORM */}
      <section className="py-24 bg-ivory">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center font-serif text-4xl md:text-5xl mb-4 text-black">
            {t('why.title')}
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-center text-warm-grey italic font-serif text-2xl md:text-3xl mb-16">
            "{lang === 'ar' ? 'أنتِ جديدة، اليوم!' : 'A new you, Today!'}"
          </motion.p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {[
              { icon: Sparkles, titleEn: "Premium Quality", titleAr: "جودة فائقة", descEn: "Indian, Russian, Brazilian & Turkish 100% human hair", descAr: "شعر طبيعي 100٪ هندي، روسي، برازيلي وتركي" },
              { icon: Users, titleEn: "30+ Years", titleAr: "30+ سنة خبرة", descEn: "World-certified technicians with 30+ years experience", descAr: "فنيات معتمدات دولياً بخبرة +30 سنة" },
              { icon: Crown, titleEn: "Celebrity Hotspot", titleAr: "وجهة المشاهير", descEn: "The go-to destination for celebrities & influencers", descAr: "الوجهة المفضلة للمشاهير والمؤثرين" },
              { icon: MapPin, titleEn: "Prime Locations", titleAr: "فروع مميزة", descEn: "City Stars, CFC, Sofitel Downtown & O Mall New Alamein", descAr: "سيتي ستارز، CFC، سوفيتيل داون تاون وأوه مول العلمين" },
              { icon: Award, titleEn: "Free Consultation", titleAr: "استشارة مجانية", descEn: "Complimentary personalized beauty consultation", descAr: "استشارة جمال شخصية مجانية" },
            ].map((feature, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center mb-6">
                  <feature.icon className="w-8 h-8 text-gold" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-black">{lang === 'ar' ? feature.titleAr : feature.titleEn}</h3>
                <p className="text-gray-500 font-light text-sm">{lang === 'ar' ? feature.descAr : feature.descEn}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: FOUNDER STORY */}
      <section className="bg-white py-0">
        <div className="flex flex-col lg:flex-row">
          <div className="w-full lg:w-1/2 relative min-h-[500px] lg:min-h-[700px]">
            <LazyImage src={founderImage} alt="Mervat Attalla - Founder of TransforM Egypt" className="w-full h-full object-cover object-top" />
            <div className="absolute inset-0 border-[20px] border-white/10 m-6 pointer-events-none"></div>
          </div>
          <div className="w-full lg:w-1/2 p-12 lg:p-24 flex flex-col justify-center">
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="uppercase tracking-[0.2em] text-gold text-xs font-bold mb-4 block">{t('founder.meetOur')}</span>
              <h2 className="font-serif text-4xl md:text-5xl text-black mb-2">Mervat Atalla</h2>
              <p className="text-warm-grey text-xl mb-2 font-light italic">{t('founder.title')}</p>
              <p className="text-gold text-sm font-semibold uppercase tracking-widest mb-8">
                {lang === 'ar' ? '★ متاحة لاستشارات VIP خاصة' : '★ Available for VIP Private Consultations'}
              </p>
              <div className="space-y-6 text-gray-600 font-light leading-relaxed mb-10">
                {lang === 'ar' ? (
                  <>
                    <p>"أنتِ جديدة، اليوم! تحويل الجمال بدقة وأناقة."</p>
                    <p>المؤسِّسة والرئيسة التنفيذية لترانسفورم ومُلهِمة رؤيتها. بخبرة تتجاوز الـ 30 عاماً بين لوس أنجلوس والقاهرة، صنعت ميرفت إطلالات نجمات وعرايس وشخصيات عامة في مصر والمنطقة.</p>
                    <p>ضيفة دائمة في برنامج <span className="text-gold font-medium">"هي وبس" مع الإعلامية رضوى الشربيني</span> كخبيرة جمال ومستشارة إطلالة، وتستقبل عدداً محدوداً من جلسات الـ VIP الخاصة أسبوعياً في فروعنا الراقية: سيتي ستارز، سوفيتيل داون تاون، وأوه مول بالعلمين.</p>
                  </>
                ) : (
                  <>
                    <p>"A new you, Today! Transforming beauty with precision and style."</p>
                    <p>Founder, CEO and visionary behind TransforM Egypt. With over 30 years of experience between Los Angeles and Cairo, Mervat has shaped the look of regional celebrities, brides and public figures across Egypt and the Middle East.</p>
                    <p>A regular guest on <span className="text-gold font-medium">Heya w Bas with Radwa El Sherbiny</span> as Egypt's go-to beauty expert and image consultant, Mervat personally accepts a limited number of VIP private consultations each week — at City Stars, Sofitel Downtown and O Mall New Alamein.</p>
                  </>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/book">
                  <Button variant="primary" className="w-full sm:w-auto">{lang === 'ar' ? 'احجزي استشارة VIP' : 'Book VIP Consultation'}</Button>
                </Link>
                <a href={`https://wa.me/201009780008?text=${encodeURIComponent(lang === 'ar' ? 'السلام عليكم، حابة أحجز استشارة VIP خاصة مع الأستاذة ميرفت 🌹' : 'Hello, I would like to book a VIP private consultation with Mervat 🌹')}`} onClick={() => trackContact('whatsapp')} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" className="w-full sm:w-auto">{lang === 'ar' ? 'واتساب' : 'WhatsApp'}</Button>
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 7: PRESTIGIOUS LOCATIONS */}
      <PrestigiousLocations lang={lang} />

      {/* SECTION 8: INSTAGRAM FEED — live via /api/instagram/feed; falls back
          to the static curated grid if the API is unavailable so the section
          never renders broken. */}
      <InstagramFeed
        lang={lang}
        fallbackImages={[hairColoring, celebHorreya, hairExtDisplay, clientsConsult, hairColoring2, celebCamila]}
      />

      {/* SECTION 9: AI QUIZ */}
      <QuizSection lang={lang} />

      {/* SECTION 10: TESTIMONIALS */}
      <section className="py-24 bg-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="font-serif text-4xl md:text-5xl text-gold mb-4">
              {lang === 'ar' ? 'ماذا تقول عميلاتنا' : 'What Our Clients Say'}
            </motion.h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <motion.div key={activeTestimonial} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-[#111] border border-white/10 rounded-sm p-10 pt-14 text-center">
              {/* Decorative quote mark — upper-left, gold @ 40% (item #13) */}
              <Quote className="absolute top-6 left-6 w-10 h-10 text-gold/40" aria-hidden="true" />
              <p className="text-white text-xl font-light italic leading-relaxed mb-8">
                "{lang === 'ar' ? reviews[activeTestimonial]?.textAr : reviews[activeTestimonial]?.text}"
              </p>
              <div className="flex justify-center mb-3">{[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-gold fill-current" />)}</div>
              <p className="text-gold font-semibold text-lg">{lang === 'ar' ? reviews[activeTestimonial]?.clientNameAr : reviews[activeTestimonial]?.clientName}</p>
              <p className="text-gray-500 text-sm mt-1">{reviews[activeTestimonial]?.service}</p>
            </motion.div>
            <div className="flex items-center justify-center gap-6 mt-10">
              <button onClick={() => setActiveTestimonial(prev => (prev - 1 + reviews.length) % reviews.length)} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:border-gold hover:text-gold transition-colors" aria-label="Previous review"><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex gap-2">{reviews.map((_: unknown, i: number) => <button key={i} onClick={() => setActiveTestimonial(i)} className={cn("w-2 h-2 rounded-full transition-all", i === activeTestimonial ? "bg-gold w-8" : "bg-white/30")} aria-label={`Review ${i + 1}`} />)}</div>
              <button onClick={() => setActiveTestimonial(prev => (prev + 1) % reviews.length)} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:border-gold hover:text-gold transition-colors" aria-label="Next review"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="text-center mt-10">
              <Link href="/reviews"><Button variant="secondary" size="sm" className="uppercase tracking-widest text-xs">{lang === 'ar' ? 'قراءة المزيد' : 'Read More Reviews'} <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRESS */}
      <Press />

      {/* FAQ */}
      <Faq />

      {/* SECTION 11: BOOKING CTA */}
      <section className="relative py-40 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="TransforM Egypt salon" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/70"></div>
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="max-w-3xl mx-auto">
            <p className="text-gold font-serif text-2xl italic mb-4">{t('footer.tagline')}</p>
            <h2 className="font-serif text-5xl md:text-6xl text-white mb-6">
              {t('cta.ready')}
            </h2>
            <p className="text-gold mb-4 font-medium">{t('cta.freeConsult')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <a href={`tel:+2${PHONE_1}`} className="inline-flex items-center gap-2 text-gold text-xl font-serif hover:opacity-80 transition-opacity">
                <Phone className="w-5 h-5" /> {PHONE_1}
              </a>
              <span className="text-gray-500 hidden sm:inline">|</span>
              <a href={`tel:+2${PHONE_2}`} className="inline-flex items-center gap-2 text-gold text-xl font-serif hover:opacity-80 transition-opacity">
                <Phone className="w-5 h-5" /> {PHONE_2}
              </a>
            </div>
            <p className="text-gray-400 mb-10 text-sm flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" /> {t('cta.openHours')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/book">
                <Button variant="shop" size="lg" className="w-full sm:w-64 h-14 text-base">{t('cta.bookOnline')}</Button>
              </Link>
              <a href={`https://wa.me/${WHATSAPP_NUM}`} onClick={() => trackContact('whatsapp')} target="_blank" rel="noreferrer">
                <Button variant="primary" size="lg" className="w-full sm:w-64 h-14 text-base bg-[#25D366] text-white border-transparent hover:bg-white hover:text-[#25D366]">
                  {t('cta.whatsapp')}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
