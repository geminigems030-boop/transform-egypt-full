import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, MessageCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { trackContact } from '@/lib/analytics';
import LazyImage from '@/components/LazyImage';

import heroInterior from '@assets/CTA_luxury_salon_interior__1774666489143.jpg';

const PHONE_1 = '01009780008';
const PHONE_2 = '01004545700';

interface BranchLocation {
  number: string;
  nameEn: string;
  nameAr: string;
  cityEn: string;
  cityAr: string;
  addressEn: string;
  addressAr: string;
  detailEn: string;
  detailAr: string;
  mapUrl: string;
  phone: string;
  closed?: boolean;
  closureReasonEn?: string;
  closureReasonAr?: string;
}

const branches: BranchLocation[] = [
  {
    number: '01',
    nameEn: 'City Stars Mall',
    nameAr: 'سيتي ستارز مول',
    cityEn: 'Heliopolis',
    cityAr: 'مصر الجديدة',
    addressEn: 'City Stars Mall, Ground Floor — Gate 7',
    addressAr: 'سيتي ستارز مول، الدور الأرضي — بوابة 7',
    detailEn: 'Next to Cafe Supreme. Ample mall parking.',
    detailAr: 'بجانب كافيه سوبريم. مواقف سيارات متوفرة.',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+City+Stars+Mall+Cairo',
    phone: PHONE_1,
  },
  {
    number: '02',
    nameEn: 'Cairo Festival City Mall',
    nameAr: 'كايرو فيستيفال سيتي مول',
    cityEn: 'New Cairo',
    cityAr: 'القاهرة الجديدة',
    addressEn: 'Cairo Festival City Mall, 3rd Floor',
    addressAr: 'كايرو فيستيفال سيتي مول، الدور الثالث',
    detailEn: 'Next to Casper. Valet parking available.',
    detailAr: 'بجانب كاسبر. خدمة الفاليه متوفرة.',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Cairo+Festival+City+Mall',
    phone: PHONE_1,
    closed: true,
    closureReasonEn: 'Temporarily closed for renovation. Reopening soon — please book a nearby branch.',
    closureReasonAr: 'مغلق مؤقتاً للتجديد. سيُعاد الافتتاح قريباً — يرجى الحجز في فرع قريب.',
  },
  {
    number: '03',
    nameEn: 'Sofitel Downtown Cairo',
    nameAr: 'سوفيتيل داون تاون القاهرة',
    cityEn: 'Downtown',
    cityAr: 'وسط البلد',
    addressEn: 'Sofitel Downtown Cairo, Lower Level',
    addressAr: 'سوفيتيل داون تاون القاهرة، الدور السفلي',
    detailEn: 'Next to Banque Misr. Hotel valet on arrival.',
    detailAr: 'بجانب بنك مصر. فاليه الفندق عند الوصول.',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Sofitel+Downtown+Cairo',
    phone: PHONE_2,
  },
  {
    number: '04',
    nameEn: 'The Nile Ritz-Carlton',
    nameAr: 'ذا نايل ريتز كارلتون',
    cityEn: 'Garden City',
    cityAr: 'جاردن سيتي',
    addressEn: 'The Nile Ritz-Carlton, 1st Floor above lobby',
    addressAr: 'ذا نايل ريتز كارلتون، الدور الأول فوق اللوبي',
    detailEn: 'Five-star hotel. Private suites available on request.',
    detailAr: 'فندق خمس نجوم. أجنحة خاصة متاحة بناءً على الطلب.',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Nile+Ritz+Carlton+Cairo',
    phone: PHONE_2,
    closed: true,
    closureReasonEn: 'Temporarily closed for renovation. Reopening soon — please book a nearby branch.',
    closureReasonAr: 'مغلق مؤقتاً للتجديد. سيُعاد الافتتاح قريباً — يرجى الحجز في فرع قريب.',
  },
  {
    number: '05',
    nameEn: 'Walk of Cairo',
    nameAr: 'ووك أوف كايرو',
    cityEn: 'Sheikh Zayed',
    cityAr: 'الشيخ زايد',
    addressEn: 'Walk of Cairo, Open-Air Promenade — Ground floor',
    addressAr: 'ووك أوف كايرو، البروميناد المفتوح — الدور الأرضي',
    detailEn: 'Outdoor luxury district with cafés and boutiques.',
    detailAr: 'منطقة فاخرة في الهواء الطلق بها كافيهات وبوتيكات.',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Walk+of+Cairo',
    phone: PHONE_1,
    closed: true,
    closureReasonEn: 'Temporarily closed for construction. Reopening soon — please book a nearby branch.',
    closureReasonAr: 'مغلق مؤقتاً بسبب أعمال الإنشاءات. سيُعاد الافتتاح قريباً — يرجى الحجز في فرع قريب.',
  },
  {
    number: '06',
    nameEn: 'O Mall — New Alamein',
    nameAr: 'أوه مول — العلمين الجديدة',
    cityEn: 'North Coast',
    cityAr: 'الساحل الشمالي',
    addressEn: 'O Mall, New Alamein — Mediterranean coast',
    addressAr: 'أوه مول، العلمين الجديدة — الساحل المتوسطي',
    detailEn: 'Seasonal flagship — open during the summer season.',
    detailAr: 'فرع موسمي — مفتوح خلال الصيف.',
    mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+O+Mall+New+Alamein',
    phone: PHONE_1,
  },
];

const branchSchemas = [
  {
    number: '01',
    name: 'TransforM Egypt — City Stars Mall',
    address: 'City Stars Mall, Ground Floor, Gate 7, Heliopolis, Cairo, Egypt',
    phone: '+201009780008',
    lat: 30.0728,
    lng: 31.3463,
    mapQuery: 'Transform+Egypt+City+Stars+Mall+Cairo',
  },
  {
    number: '03',
    name: 'TransforM Egypt — Sofitel Downtown Cairo',
    address: 'Sofitel Downtown Cairo, Lower Level, Downtown, Cairo, Egypt',
    phone: '+201004545700',
    lat: 30.0444,
    lng: 31.2357,
    mapQuery: 'Transform+Egypt+Sofitel+Downtown+Cairo',
  },
  {
    number: '06',
    name: 'TransforM Egypt — O Mall New Alamein',
    address: 'O Mall, New Alamein, North Coast, Egypt',
    phone: '+201009780008',
    lat: 30.8385,
    lng: 28.9486,
    mapQuery: 'Transform+Egypt+O+Mall+New+Alamein',
  },
];

export default function Locations() {
  const { lang } = useTranslation();

  return (
    <div className="bg-[#050505] min-h-screen">
      {/* Hero */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <LazyImage
          src={heroInterior}
          alt="TransforM Egypt salon interior"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-[#050505]" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <p className="text-gold text-xs uppercase tracking-[0.5em] font-light mb-6">
              {lang === 'ar' ? 'فروعنا' : 'Our Locations'}
            </p>
            <h1 className="font-serif text-5xl md:text-7xl text-white leading-[1.05] mb-6">
              {lang === 'ar' ? 'ستة فروع · أرقى العناوين في مصر' : 'Six addresses, one standard.'}
            </h1>
            <p className="text-gray-300 text-lg max-w-2xl font-light leading-relaxed">
              {lang === 'ar'
                ? 'داخل أفخم المولات والفنادق في القاهرة والساحل. كل فرع يقدم نفس مستوى الفخامة والرعاية بدون استثناء.'
                : 'Inside Cairo\u2019s most prestigious malls and hotels — and on the Mediterranean coast. Every branch holds the same standard of craftsmanship and care.'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Branches grid */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
            {branches.map((b, i) => (
              <motion.article
                key={b.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`bg-[#0c0c0c] border transition-all duration-[250ms] p-8 md:p-10 flex flex-col ${b.closed ? 'border-amber-500/30 opacity-80' : 'group border-white/10 hover:border-gold/40 hover:bg-[rgba(212,185,122,0.06)]'}`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <p className="text-gold text-xs uppercase tracking-[0.4em]">
                        {lang === 'ar' ? b.cityAr : b.cityEn}
                      </p>
                      {b.closed && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs uppercase tracking-widest font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          {lang === 'ar' ? 'مغلق مؤقتاً' : 'Temporarily Closed'}
                        </span>
                      )}
                    </div>
                    <h2 className={`font-serif text-2xl md:text-3xl leading-tight ${b.closed ? 'text-white/70' : 'text-white'}`}>
                      {lang === 'ar' ? b.nameAr : b.nameEn}
                    </h2>
                    {/* Animated gold underline reveals on row hover (item B2) */}
                    {!b.closed && (
                      <span aria-hidden="true" className="block h-px w-0 bg-gold mt-2 transition-all duration-[250ms] ease-out group-hover:w-16" />
                    )}
                  </div>
                  <span className="text-gold/30 font-serif text-base tracking-widest">{b.number}</span>
                </div>

                <div className="space-y-4 mb-8 flex-1">
                  {b.closed && b.closureReasonEn && (
                    <div className="bg-amber-500/5 border border-amber-500/20 px-4 py-3 text-amber-300/90 text-sm leading-relaxed">
                      {lang === 'ar' ? b.closureReasonAr : b.closureReasonEn}
                    </div>
                  )}
                  <div className="flex items-start gap-3 text-gray-300">
                    <MapPin className="w-4 h-4 text-gold flex-shrink-0 mt-1" />
                    <div className="text-sm">
                      <p className={b.closed ? 'text-gray-400' : 'text-white'}>{lang === 'ar' ? b.addressAr : b.addressEn}</p>
                      <p className="text-gray-500 mt-1">{lang === 'ar' ? b.detailAr : b.detailEn}</p>
                    </div>
                  </div>
                  {!b.closed && (
                    <>
                      <div className="flex items-center gap-3 text-gray-300">
                        <Phone className="w-4 h-4 text-gold flex-shrink-0" />
                        <a href={`tel:+2${b.phone}`} onClick={() => trackContact('phone')} className="text-sm hover:text-gold transition-colors">
                          {b.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-3 text-gray-300">
                        <Clock className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="text-sm">
                          {lang === 'ar' ? 'يومياً · 10 ص – 10 م' : 'Daily · 10am – 10pm'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {!b.closed && branchSchemas.find(s => s.number === b.number) && (
                  <div className="mb-6">
                    <iframe
                      title={lang === 'ar' ? b.nameAr : b.nameEn}
                      src={`https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d13812.0!2d${branchSchemas.find(s => s.number === b.number)!.lng}!3d${branchSchemas.find(s => s.number === b.number)!.lat}!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDA0JzIyLjEiTiAzMcKwMjEnMDguNiJF!5e0!3m2!1sen!2seg!4v1700000000000!5m2!1sen!2seg&q=${branchSchemas.find(s => s.number === b.number)!.mapQuery}`}
                      width="100%"
                      height="200"
                      style={{ border: 0, filter: 'grayscale(100%) invert(92%) contrast(83%)' }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="rounded-lg"
                    />
                  </div>
                )}

                {b.closed ? (
                  <div className="grid grid-cols-2 gap-2 pt-6 border-t border-white/10">
                    <a
                      href={buildWhatsAppLink({ lang })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-xs uppercase tracking-widest text-[#25D366] hover:text-white hover:bg-[#25D366]/20 transition-colors py-2 border border-[#25D366]/30 hover:border-[#25D366] flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" />
                      {lang === 'ar' ? 'تواصلي معنا' : 'Contact Us'}
                    </a>
                    <Link
                      href="/book"
                      className="text-center text-xs uppercase tracking-widest text-black bg-gold hover:bg-white transition-colors py-2 font-semibold flex items-center justify-center gap-1"
                    >
                      {lang === 'ar' ? 'احجزي بفرع آخر' : 'Book Another Branch'}
                      {lang === 'ar' ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 pt-6 border-t border-white/10">
                    <a
                      href={b.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-xs uppercase tracking-widest text-gray-400 hover:text-gold transition-colors py-2 border border-white/10 hover:border-gold/40"
                    >
                      {lang === 'ar' ? 'الخريطة' : 'Map'}
                    </a>
                    <a
                      href={buildWhatsAppLink({ branch: b.nameEn, lang })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-xs uppercase tracking-widest text-[#25D366] hover:text-white hover:bg-[#25D366]/20 transition-colors py-2 border border-[#25D366]/30 hover:border-[#25D366] flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" />
                      {lang === 'ar' ? 'واتساب' : 'WhatsApp'}
                    </a>
                    <Link
                      href="/book"
                      className="text-center text-xs uppercase tracking-widest text-black bg-gold hover:bg-white transition-colors py-2 font-semibold flex items-center justify-center gap-1"
                    >
                      {lang === 'ar' ? 'احجزي' : 'Book'}
                      {/* Arrow translates 8px on row hover, RTL-aware so the motion always
                          follows the reading direction (architect note item B2). */}
                      {lang === 'ar' ? (
                        <ArrowLeft className="w-3 h-3 transition-transform duration-[250ms] ease-out group-hover:-translate-x-2" />
                      ) : (
                        <ArrowRight className="w-3 h-3 transition-transform duration-[250ms] ease-out group-hover:translate-x-2" />
                      )}
                    </Link>
                  </div>
                )}
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/[0.06]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <p className="text-gold font-serif italic text-xl mb-4">
            {lang === 'ar' ? 'أنتِ جديدة، اليوم!' : 'A new you, Today!'}
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-8">
            {lang === 'ar' ? 'لست متأكدة من الفرع؟ كلمينا.' : 'Not sure which branch? Let us help.'}
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={buildWhatsAppLink({ lang })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#25D366] text-white font-semibold uppercase tracking-widest text-sm hover:bg-white hover:text-[#25D366] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {lang === 'ar' ? 'تواصلي على واتساب' : 'Chat on WhatsApp'}
            </a>
            <Link href="/book">
              <Button variant="shop" size="lg" className="uppercase tracking-widest text-sm">
                {lang === 'ar' ? 'احجزي أونلاين' : 'Book Online'}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
