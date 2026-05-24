import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import LazyImage from '@/components/LazyImage';

import founder from '@assets/Founder_Mervat_Atalla__1774666489143.PNG';
import staff1 from '@assets/Hair_treatments__1774666730979.JPG';
import staff2 from '@assets/Hair_coloring__1774666730978.jpg';
import staff3 from '@assets/IMG_3578_1774668525770.jpeg';
import staff4 from '@assets/IMG_4549_1774668422662.jpeg';
import staff5 from '@assets/Clients_Checking_Various_Hair_Extensions_options__1774666730978.jpg';

interface Stylist {
  nameEn: string;
  nameAr: string;
  roleEn: string;
  roleAr: string;
  specialtyEn: string;
  specialtyAr: string;
  branchEn: string;
  branchAr: string;
  bioEn: string;
  bioAr: string;
  image: string;
  isFounder?: boolean;
}

const stylists: Stylist[] = [
  {
    nameEn: 'Mervat Atalla',
    nameAr: 'ميرفت عطا الله',
    roleEn: 'Founder & CEO · Beauty Expert & Image Consultant',
    roleAr: 'المؤسِّسة والرئيسة التنفيذية · خبيرة جمال ومستشارة إطلالة',
    specialtyEn: 'Available for VIP Private Beauty Consultations',
    specialtyAr: 'متاحة لاستشارات بيوتي خاصة (VIP)',
    branchEn: 'By Appointment · All Branches',
    branchAr: 'بحجز مسبق · كل الفروع',
    bioEn: 'Founder, CEO and visionary behind TransforM Egypt. With over 30 years of experience between Los Angeles and Cairo, Mervat has shaped the look of regional celebrities, brides and public figures — and is regularly featured on Heya w Bas with Radwa El Sherbiny as Egypt\u2019s go-to beauty expert and image consultant. She personally accepts a limited number of VIP private consultations each week.',
    bioAr: 'المؤسِّسة والرئيسة التنفيذية لترانسفورم ومُلهِمة رؤيتها. بخبرة تتجاوز الـ 30 عاماً بين لوس أنجلوس والقاهرة، صنعت ميرفت إطلالات نجمات وعرايس وشخصيات عامة في مصر والمنطقة، وضيفة دائمة في برنامج "هي وبس" مع الإعلامية رضوى الشربيني كخبيرة جمال ومستشارة إطلالة. تستقبل عدداً محدوداً من جلسات الـ VIP الخاصة أسبوعياً.',
    image: founder,
    isFounder: true,
  },
  {
    nameEn: 'Yara Mostafa',
    nameAr: 'يارا مصطفى',
    roleEn: 'Senior Hair Extension Specialist',
    roleAr: 'سينيور هير اكستنشن سبيشلست',
    specialtyEn: 'Russian & Indian extensions · Color match',
    specialtyAr: 'اكستنشن روسي وهندي · كولور ماتشينج',
    branchEn: 'City Stars · Sofitel Downtown',
    branchAr: 'سيتي ستارز · سوفيتيل داون تاون',
    bioEn: 'Trained in London and Dubai. Specializes in invisible tape-in techniques for fine hair.',
    bioAr: 'اتدربت في لندن ودبي. متخصصة في تقنيات الاكستنشن التيب إن الخفية للشعر الناعم.',
    image: staff2,
  },
  {
    nameEn: 'Heba Sharkawy',
    nameAr: 'هبة الشرقاوي',
    roleEn: 'Master Lash Artist',
    roleAr: 'كبيرة فنانات الرموش',
    specialtyEn: 'Mega volume · Fox lashes · Wedding sets',
    specialtyAr: 'ميجا فوليوم · فوكس لاش · لاش العرايس',
    branchEn: 'Sofitel Downtown · City Stars',
    branchAr: 'سوفيتيل داون تاون · سيتي ستارز',
    bioEn: 'Eight years of award-winning lash artistry. Known for the signature TransforM cat-eye lift.',
    bioAr: 'ثمانية سنوات من فن الرموش الحائز على جوائز. مشهورة برفع رموش ترانسفورم الكلاسيكي.',
    image: staff3,
  },
  {
    nameEn: 'Dina El-Naggar',
    nameAr: 'دينا النجار',
    roleEn: 'Microblading & Brow Designer',
    roleAr: 'مصممة مايكروبليدنج وحواجب',
    specialtyEn: 'Microblading · Lip blushing · Brow extensions',
    specialtyAr: 'مايكروبليدنج · ليب بلاشينج · اكستنشن حواجب',
    branchEn: 'Sofitel Downtown · O Mall',
    branchAr: 'سوفيتيل داون تاون · أوه مول',
    bioEn: 'Certified by Phibrows Academy. Brings hand-drawn precision to every brow design.',
    bioAr: 'حاصلة على شهادة من أكاديمية فيبروز. تجلب دقة الرسم اليدوي لكل تصميم حواجب.',
    image: staff4,
  },
  {
    nameEn: 'Salma Adel',
    nameAr: 'سلمى عادل',
    roleEn: 'Bridal Lead Stylist',
    roleAr: 'كبيرة ستايلستات العرايس',
    specialtyEn: 'Bridal updos · Hollywood waves · Trial sessions',
    specialtyAr: 'تسريحات العرايس · موجات هوليوود · جلسات تجريبية',
    branchEn: 'All Branches',
    branchAr: 'كل الفروع',
    bioEn: 'Over 400 brides styled. Personally manages every bridal trial from concept to wedding day.',
    bioAr: 'صفّفت أكثر من 400 عروسة. تدير شخصياً كل جلسة تجريبية من الفكرة حتى يوم الزفاف.',
    image: staff5,
  },
  {
    nameEn: 'Reem Hossam',
    nameAr: 'ريم حسام',
    roleEn: 'Skincare & Dermapen Specialist',
    roleAr: 'أخصائية بشرة وديرمابن',
    specialtyEn: 'Dermapen · Hydrafacial · Lifting massage',
    specialtyAr: 'ديرمابن · هيدرافيشل · مساج شد',
    branchEn: 'City Stars · Sofitel Downtown',
    branchAr: 'سيتي ستارز · سوفيتيل داون تاون',
    bioEn: 'Esthetician trained in Paris. Designs personalized skin journeys using medical-grade equipment.',
    bioAr: 'أخصائية بشرة تدربت في باريس. تصمم رحلات بشرة شخصية باستخدام أجهزة طبية.',
    image: staff1,
  },
];

export default function Team() {
  const { lang } = useTranslation();

  return (
    <div className="bg-ivory min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mb-16"
        >
          <p className="text-gold text-xs uppercase tracking-[0.5em] font-light mb-6">
            {lang === 'ar' ? 'فريقنا' : 'Our Team'}
          </p>
          <h1 className="font-serif text-5xl md:text-7xl text-black leading-[1.05] mb-6">
            {lang === 'ar' ? 'فنانات يعرفنك حقاً.' : 'Artists who really know you.'}
          </h1>
          <p className="text-warm-grey text-lg leading-relaxed">
            {lang === 'ar'
              ? 'كل عضو في فريقنا تم اختياره وتدريبه شخصياً على معايير ترانسفورم. تعرفي على الفنانة المناسبة لكي.'
              : 'Every member of our team is hand-picked and personally trained to the TransforM standard. Meet the artist who fits you best.'}
          </p>
        </motion.div>

        {/* Founder feature */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 mb-24 bg-black p-8 lg:p-16 rounded-sm overflow-hidden"
        >
          <div className="aspect-[4/5] overflow-hidden bg-neutral-900">
            <LazyImage
              src={stylists[0].image}
              alt={stylists[0].nameEn}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-center text-white">
            <p className="text-gold text-xs uppercase tracking-[0.5em] mb-4">
              {lang === 'ar' ? 'المؤسسة' : 'The Founder'}
            </p>
            <h2 className="font-serif text-4xl md:text-5xl mb-3">
              {lang === 'ar' ? stylists[0].nameAr : stylists[0].nameEn}
            </h2>
            <p className="text-gold font-serif italic text-lg mb-8">
              {lang === 'ar' ? stylists[0].roleAr : stylists[0].roleEn}
            </p>
            <p className="text-gray-300 leading-relaxed mb-6">
              {lang === 'ar' ? stylists[0].bioAr : stylists[0].bioEn}
            </p>
            <p className="text-sm text-gray-400 mb-8">
              <span className="text-gold uppercase tracking-widest text-xs">
                {lang === 'ar' ? 'تخصص: ' : 'Specialty: '}
              </span>
              {lang === 'ar' ? stylists[0].specialtyAr : stylists[0].specialtyEn}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/book">
                <Button variant="shop" size="lg" className="uppercase tracking-widest text-xs">
                  {lang === 'ar' ? 'احجزي استشارة VIP' : 'Book VIP Consultation'}
                </Button>
              </Link>
              <a href={`https://wa.me/201009780008?text=${encodeURIComponent(lang === 'ar' ? 'السلام عليكم، حابة أحجز استشارة VIP خاصة مع الأستاذة ميرفت 🌹' : 'Hello, I would like to book a VIP private consultation with Mervat 🌹')}`} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="lg" className="uppercase tracking-widest text-xs w-full">
                  {lang === 'ar' ? 'واتساب الأستاذة ميرفت' : 'WhatsApp Mervat'}
                </Button>
              </a>
            </div>
          </div>
        </motion.section>

        {/* Senior team grid */}
        <h2 className="font-serif text-3xl md:text-4xl text-black mb-2">
          {lang === 'ar' ? 'الفريق الأول' : 'Senior Team'}
        </h2>
        <p className="text-warm-grey mb-12">
          {lang === 'ar' ? 'كبار الفنانات بحسب التخصص.' : 'Master artists by specialty.'}
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {stylists.slice(1).map((s, i) => (
            <motion.article
              key={s.nameEn}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="bg-white border border-taupe/40 hover:border-gold/60 transition-colors group overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/5] overflow-hidden bg-neutral-100">
                <LazyImage
                  src={s.image}
                  alt={s.nameEn}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-serif text-2xl text-black mb-1 leading-tight">
                  {lang === 'ar' ? s.nameAr : s.nameEn}
                </h3>
                <p className="text-gold text-xs uppercase tracking-widest mb-4">
                  {lang === 'ar' ? s.roleAr : s.roleEn}
                </p>
                <p className="text-warm-grey text-sm leading-relaxed mb-4 flex-1">
                  {lang === 'ar' ? s.bioAr : s.bioEn}
                </p>
                <div className="space-y-2 text-xs border-t border-taupe/40 pt-4">
                  <p className="text-gray-700">
                    <span className="text-gold uppercase tracking-widest">
                      {lang === 'ar' ? 'تخصص · ' : 'Specialty · '}
                    </span>
                    {lang === 'ar' ? s.specialtyAr : s.specialtyEn}
                  </p>
                  <p className="text-gray-700">
                    <span className="text-gold uppercase tracking-widest">
                      {lang === 'ar' ? 'الفرع · ' : 'Branch · '}
                    </span>
                    {lang === 'ar' ? s.branchAr : s.branchEn}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="text-center mt-20">
          <Link href="/book">
            <Button variant="primary" size="lg" className="uppercase tracking-widest text-sm">
              {lang === 'ar' ? 'احجزي مع فريقنا' : 'Book With Our Team'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
