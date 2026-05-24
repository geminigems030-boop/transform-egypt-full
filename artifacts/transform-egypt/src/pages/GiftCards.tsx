import { motion } from 'framer-motion';
import { Gift, MessageCircle, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { trackContact } from '@/lib/analytics';
import LazyImage from '@/components/LazyImage';

import heroInterior from '@assets/CTA_luxury_salon_interior__1774666489143.jpg';
import giftPattern from '@assets/Hair_extensions_Display__1774666730978.PNG';

interface Tier {
  amount: number;
  amountLabelEn: string;
  amountLabelAr: string;
  nameEn: string;
  nameAr: string;
  perksEn: string[];
  perksAr: string[];
  highlight?: boolean;
}

const tiers: Tier[] = [
  {
    amount: 2500,
    amountLabelEn: 'EGP 2,500',
    amountLabelAr: '2,500 جنيه',
    nameEn: 'The Glow Card',
    nameAr: 'بطاقة التألق',
    perksEn: [
      'Classic facial or signature manicure',
      'Complimentary blow-dry',
      'Welcome refreshment',
    ],
    perksAr: [
      'فيشل كلاسيك أو مانيكير مميز',
      'سيشوار مجاني',
      'مشروب ترحيبي',
    ],
  },
  {
    amount: 6000,
    amountLabelEn: 'EGP 6,000',
    amountLabelAr: '6,000 جنيه',
    nameEn: 'The Signature Card',
    nameAr: 'البطاقة المميزة',
    perksEn: [
      'Volume lashes or tape-in trial',
      'Hydrafacial or deep skincare',
      'Senior stylist on request',
      'Private styling suite',
    ],
    perksAr: [
      'لاش فوليوم أو تجربة اكستنشن تيب إن',
      'هيدرافيشل أو عناية عميقة بالبشرة',
      'ستايليست خبيرة بناءً على الطلب',
      'جناح تصفيف خاص',
    ],
    highlight: true,
  },
  {
    amount: 15000,
    amountLabelEn: 'EGP 15,000',
    amountLabelAr: '15,000 جنيه',
    nameEn: 'The Transformation Card',
    nameAr: 'بطاقة التحول',
    perksEn: [
      'Full hair extension consultation & fitting',
      'Microblading or lip blushing session',
      'Bridal trial preview included',
      'Founder-led concept review',
    ],
    perksAr: [
      'كونسلتيشن وتركيب اكستنشن شعر كامل',
      'جلسة مايكروبليدنج أو توريد شفايف',
      'جلسة تجريبية للعروس مشمولة',
      'مراجعة مفهوم مع المؤسسة',
    ],
  },
  {
    amount: 0,
    amountLabelEn: 'Custom Amount',
    amountLabelAr: 'مبلغ مخصص',
    nameEn: 'The Bespoke Card',
    nameAr: 'البطاقة المخصصة',
    perksEn: [
      'Choose any amount from EGP 1,000',
      'Personalized digital card',
      'Hand-delivered to recipient',
      'Bilingual gift note',
    ],
    perksAr: [
      'اختاري أي مبلغ يبدأ من 1,000 جنيه',
      'بطاقة رقمية مخصصة',
      'تسليم يدوي للمستلمة',
      'ملاحظة هدية بلغتين',
    ],
  },
];

export default function GiftCards() {
  const { lang } = useTranslation();

  return (
    <div className="bg-ivory min-h-screen">
      {/* Hero */}
      <section className="relative pt-40 pb-24 overflow-hidden bg-black">
        <LazyImage
          src={heroInterior}
          alt="TransforM Egypt salon"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <p className="text-gold text-xs uppercase tracking-[0.5em] font-light mb-6 inline-flex items-center gap-3">
              <Gift className="w-4 h-4" />
              {lang === 'ar' ? 'بطاقات الهدايا' : 'Gift Cards'}
            </p>
            <h1 className="font-serif text-5xl md:text-7xl text-white leading-[1.05] mb-6">
              {lang === 'ar' ? 'هدية تستحقها.' : 'A gift she\u2019ll remember.'}
            </h1>
            <p className="text-gray-300 text-lg max-w-2xl font-light leading-relaxed">
              {lang === 'ar'
                ? 'جيفت كاردز ترانسفورم بتدّي البيوتي والـ Me-time لأهم الناس — للأعراس، أعياد الميلاد، أو لمجرد إنها تستاهل.'
                : 'A TransforM gift card gives her the beauty experience she\u2019ll talk about for weeks — for weddings, birthdays, or simply because she deserves it.'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {tiers.map((t, i) => (
              <motion.article
                key={t.nameEn}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative flex flex-col p-8 transition-all ${
                  t.highlight
                    ? 'bg-black text-white border border-gold shadow-[0_8px_32px_rgba(212,175,55,0.18)]'
                    : 'bg-white text-black border border-taupe/40 hover:border-gold/60'
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-black text-[10px] uppercase tracking-widest font-bold px-3 py-1">
                    {lang === 'ar' ? 'الأكثر طلباً' : 'Most Gifted'}
                  </span>
                )}
                <h3 className="font-serif text-2xl mb-2">
                  {lang === 'ar' ? t.nameAr : t.nameEn}
                </h3>
                <p className={`font-serif text-4xl mb-6 ${t.highlight ? 'text-gold' : 'text-gold'}`}>
                  {lang === 'ar' ? t.amountLabelAr : t.amountLabelEn}
                </p>
                <ul className="space-y-3 flex-1 mb-8">
                  {(lang === 'ar' ? t.perksAr : t.perksEn).map((perk, idx) => (
                    <li key={idx} className={`flex items-start gap-2 text-sm ${t.highlight ? 'text-gray-300' : 'text-warm-grey'}`}>
                      <Sparkles className="w-3 h-3 text-gold flex-shrink-0 mt-1" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={buildWhatsAppLink({
                    service: `Gift Card · ${t.nameEn} (${t.amountLabelEn})`,
                    lang,
                  })}
                  onClick={() => trackContact('whatsapp')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-widest font-semibold transition-colors ${
                    t.highlight
                      ? 'bg-gold text-black hover:bg-white'
                      : 'bg-black text-white hover:bg-gold hover:text-black'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  {lang === 'ar' ? 'اطلبي عبر واتساب' : 'Request on WhatsApp'}
                </a>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-center max-w-6xl mx-auto">
            <div className="aspect-[4/3] overflow-hidden bg-neutral-900 hidden lg:block">
              <LazyImage
                src={giftPattern}
                alt="TransforM gift packaging"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-white">
              <p className="text-gold text-xs uppercase tracking-[0.4em] mb-4">
                {lang === 'ar' ? 'كيف تعمل' : 'How It Works'}
              </p>
              <h2 className="font-serif text-4xl md:text-5xl mb-8">
                {lang === 'ar' ? 'سلس · مخصص · فاخر' : 'Effortless. Personal. Luxe.'}
              </h2>
              <ol className="space-y-6">
                <li className="flex gap-4">
                  <span className="font-serif text-gold text-2xl flex-shrink-0">01</span>
                  <div>
                    <h3 className="font-serif text-xl mb-1">
                      {lang === 'ar' ? 'اختاري بطاقتك' : 'Choose her card'}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {lang === 'ar'
                        ? 'اختاري الشريحة أو حددي مبلغاً مخصصاً يناسب المناسبة.'
                        : 'Pick a tier or set a custom amount that matches the occasion.'}
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="font-serif text-gold text-2xl flex-shrink-0">02</span>
                  <div>
                    <h3 className="font-serif text-xl mb-1">
                      {lang === 'ar' ? 'كلمينا على واتساب' : 'Message us on WhatsApp'}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {lang === 'ar'
                        ? 'أرسلي اسم المستلمة وملاحظتك. ندفع عبر تحويل بنكي أو فيزا.'
                        : 'Share the recipient\u2019s name and your note. Pay by bank transfer or Visa.'}
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="font-serif text-gold text-2xl flex-shrink-0">03</span>
                  <div>
                    <h3 className="font-serif text-xl mb-1">
                      {lang === 'ar' ? 'نُسلّم البطاقة' : 'We deliver the card'}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {lang === 'ar'
                        ? 'نرسل بطاقة رقمية في نفس اليوم، أو نُسلم مغلفاً مطبوعاً يدوياً لأي فرع.'
                        : 'We send a digital card the same day, or hand-deliver a printed envelope to any branch.'}
                    </p>
                  </div>
                </li>
              </ol>
              <div className="mt-10">
                <a
                  href={buildWhatsAppLink({ service: 'Gift Card inquiry', lang })}
                  onClick={() => trackContact('whatsapp')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="shop" size="lg" className="uppercase tracking-widest text-xs">
                    {lang === 'ar' ? 'ابدئي طلبك' : 'Start Your Order'}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
