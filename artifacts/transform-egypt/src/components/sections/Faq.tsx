import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useTranslation } from '@/lib/i18n';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

interface FaqItem {
  q: { en: string; ar: string };
  a: { en: string; ar: string };
}

const faqs: FaqItem[] = [
  {
    q: { en: 'How long do hair extensions last?', ar: 'الاكستنشن بيقعد قد إيه؟' },
    a: {
      en: 'Tape-in extensions last 6–8 weeks before re-application, keratin-bond extensions last up to 6 months, and clip-ins are reusable for over a year with proper care. We schedule complimentary maintenance check-ins between visits.',
      ar: 'اكستنشن التيب إن (اللاصق) بيقعد من 6 لـ 8 أسابيع قبل إعادة التركيب، واكستنشن الكيراتين بوند بيقعد لحد 6 شهور، والكلبس بيقعد أكتر من سنة مع العناية الصح. بنحجزلك ميين تينانس مجانية بين الجلسات.',
    },
  },
  {
    q: { en: 'Is the first consultation really free?', ar: 'هل الاستشارة الأولى مجانية فعلاً؟' },
    a: {
      en: 'Yes. Every first-time client receives a complimentary one-on-one consultation with a senior stylist to color-match, assess your hair condition, and design a plan tailored to your goals — no booking deposit required.',
      ar: 'نعم. كل عميلة جديدة تحصل على استشارة مجانية مع ستايليست خبيرة لمطابقة اللون وتقييم حالة الشعر وتصميم الخطة المناسبة لكي — بدون أي مقدم حجز.',
    },
  },
  {
    q: { en: 'What types of hair do you use?', ar: 'ما أنواع الشعر التي تستخدمونها؟' },
    a: {
      en: 'We carry premium Indian temple-grade Remy, Slavic Russian single-donor, Brazilian wave, Turkish, and tape-in collections. Every bundle is inspected at origin and color-matched in-house before fitting.',
      ar: 'بنوفر شعر هندي ريمي درجة أولى، شعر روسي سلافي من مصدر واحد، شعر برازيلي متموج، شعر تركي، واكستنشن تيب إن. كل خصلة بتتفحص في المصدر وبتتعمل لها كولور ماتش جوّه قبل التركيب.',
    },
  },
  {
    q: { en: 'Do extensions damage natural hair?', ar: 'هل الاكستنشن بيأذي الشعر الطبيعي؟' },
    a: {
      en: 'When fitted by a trained stylist using premium materials, extensions do not damage healthy hair. We use lightweight, weight-distributed techniques and follow strict removal protocols to protect your natural growth.',
      ar: 'لما الاكستنشن بيتركّب بواسطة ستايليست متدربة وبخامات بريميوم، مش بيأذي الشعر السليم. بنستخدم تقنيات لايت وموزّعة، وبنتبع بروتوكولات إزالة صارمة لحماية شعرك الطبيعي.',
    },
  },
  {
    q: { en: 'How long does microblading take and how long does it last?', ar: 'كم تستغرق جلسة المايكروبليدنج وكم تدوم؟' },
    a: {
      en: 'A microblading session takes about 2 hours, with a complimentary touch-up at 4–6 weeks. Results last 12–18 months depending on skin type and aftercare. Annual refreshers are recommended to maintain the shape.',
      ar: 'جلسة المايكروبليدنج تستغرق حوالي ساعتين، مع جلسة لمسات نهائية مجانية بعد 4 إلى 6 أسابيع. النتائج تدوم من 12 إلى 18 شهر حسب نوع البشرة والعناية. نوصي بجلسة تجديد سنوية للحفاظ على الشكل.',
    },
  },
  {
    q: { en: 'Can I book a bridal package or full-day service?', ar: 'هل أقدر أحجز باقة عروس أو يوم كامل؟' },
    a: {
      en: 'Absolutely. Our bridal packages combine hair, makeup, lashes, nails and skincare into a private suite session. Trial appointments are required and we recommend booking at least 8 weeks before the wedding date.',
      ar: 'أكيد. باكدج العروسة بيجمع الشعر والميك أب واللاش والنيلز والسكين كير في جلسة خاصة. الـ Trial session لازم، ويفضل الحجز قبل الفرح بـ 8 أسابيع على الأقل.',
    },
  },
  {
    q: { en: 'Do you accept walk-ins?', ar: 'هل تستقبلون زيارات بدون حجز مسبق؟' },
    a: {
      en: 'We strongly recommend booking in advance — our senior stylists are reserved by appointment. For same-day requests, please WhatsApp the branch directly and we will accommodate based on availability.',
      ar: 'ننصح بالحجز المسبق — ستايلستنا الخبيرات بالحجز فقط. للطلبات في نفس اليوم، تواصلي مع الفرع مباشرة عبر الواتساب وسنساعدك حسب التوفر.',
    },
  },
  {
    q: { en: 'What is your refund and cancellation policy?', ar: 'ما هي سياسة الإلغاء والاسترداد؟' },
    a: {
      en: 'Cancellations made 48 hours in advance are fully refundable. Within 48 hours, deposits are converted to a credit valid for 90 days. Boutique purchases are exchangeable within 14 days when unopened.',
      ar: 'الإلغاء قبل 48 ساعة من الموعد يسترد بالكامل. خلال 48 ساعة، يتم تحويل المقدم إلى رصيد صالح لمدة 90 يوم. مشتريات المتجر قابلة للاستبدال خلال 14 يوم إذا كانت غير مفتوحة.',
    },
  },
];

export default function Faq() {
  const { lang } = useTranslation();

  return (
    <section className="py-24 bg-ivory">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:sticky lg:top-32 self-start"
          >
            <p className="text-gold text-xs uppercase tracking-[0.4em] font-light mb-4">
              {lang === 'ar' ? 'أسئلة شائعة' : 'Common Questions'}
            </p>
            <h2 className="font-serif text-4xl md:text-5xl text-black mb-6 leading-tight">
              {lang === 'ar' ? 'كل ما تريدين معرفته' : 'Everything you want to know.'}
            </h2>
            <p className="text-warm-grey text-base leading-relaxed mb-8">
              {lang === 'ar'
                ? 'إجابات مباشرة من فريقنا على أكثر الأسئلة التي نسمعها قبل الحجز.'
                : 'Honest answers from our team to the questions we hear most before clients book.'}
            </p>
            <Link href="/book">
              <Button variant="primary" size="lg" className="uppercase tracking-widest text-xs">
                {lang === 'ar' ? 'احجزي استشارة مجانية' : 'Book a Free Consultation'}
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-b border-taupe/60">
                  <AccordionTrigger className="text-left font-serif text-lg md:text-xl text-black hover:text-gold py-6">
                    {lang === 'ar' ? item.q.ar : item.q.en}
                  </AccordionTrigger>
                  <AccordionContent className="text-warm-grey text-base leading-relaxed pb-6">
                    {lang === 'ar' ? item.a.ar : item.a.en}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
