import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ThumbsUp, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const reviews = [
  { id: 1, name: 'Nour Hassan', nameAr: 'نور حسن', rating: 5, date: 'March 20, 2025', service: 'Tape-In Hair Extensions', serviceAr: 'اكستنشن تيب إن', text: 'TransforM completely changed my confidence! Mervat is a true artist. My tape-in extensions look completely natural and have lasted over 6 months without any issues. The salon itself is stunning — feels like a luxury spa in Dubai. I wouldn\'t go anywhere else!', textAr: 'ترانسفورم غيّرت ثقتي بنفسي تماماً! ميرفت آرتيست حقيقية. الاكستنشن التيب إن بتاعي شكله طبيعي 100٪ وقعد معايا أكتر من 6 شهور من غير أي مشاكل.', verified: true, helpful: 42 },
  { id: 2, name: 'Farah Al-Rashid', nameAr: 'فرح الرشيد', rating: 5, date: 'February 14, 2025', service: 'Volume Lash Extensions', serviceAr: 'رموش فوليوم', text: 'Best lash extensions I\'ve ever had in Cairo. The studio is elegant, the staff is so professional, and the results are absolutely stunning. My lashes lasted 6 weeks with proper care. Already booked my next appointment!', textAr: 'أفضل رموش تعلتها في القاهرة على الإطلاق. ستوديو راقي، طاقم عمل محترف جداً، ونتائج مذهلة.', verified: true, helpful: 38 },
  { id: 3, name: 'Mariam Samir', nameAr: 'مريم سمير', rating: 5, date: 'January 8, 2025', service: 'Microblading & Brows', serviceAr: 'مايكروبليدنج وحواجب', text: 'I flew in from Dubai specifically for Mervat\'s microblading. Worth every penny and every kilometer! My brows have never looked this perfect in my life. The technique is flawless and the results are incredibly natural.', textAr: 'سافرت من دبي خصيصاً للمايكروبليدنج مع ميرفت. يستحق كل قرش وكل كيلومتر! حواجبي لم تبدُ بهذا الجمال أبداً.', verified: true, helpful: 55 },
  { id: 4, name: 'Salma Khaled', nameAr: 'سلمى خالد', rating: 5, date: 'April 2, 2025', service: 'Bridal Package', serviceAr: 'باقة العروس', text: 'The VIP experience is absolutely unmatched. From the moment you walk in, every single detail is perfect. The team made my bridal day unforgettable. I was the most beautiful bride thanks to TransforM!', textAr: 'تجربة VIP لا مثيل لها. من لحظة دخولك، كل تفصيلة مثالية. الفريق جعل يوم زفافي لا يُنسى!', verified: true, helpful: 67 },
  { id: 5, name: 'Yasmine Tarek', nameAr: 'ياسمين طارق', rating: 5, date: 'March 15, 2025', service: 'Keratin Bond Extensions', serviceAr: 'اكستنشن كيراتين بوند', text: 'Absolutely obsessed with my new hair! The keratin bond extensions are so seamlessly done — no one can tell they\'re extensions. Mervat\'s expertise is on another level entirely. 10/10, will keep coming back forever!', textAr: 'مهووسة بشعري الجديد! اكستنشن الكيراتين بوند متناسق بشكل خرافي — محدش يقدر يحس إنه اكستنشن. خبرة ميرفت ليفل تاني خالص.', verified: true, helpful: 29 },
  { id: 6, name: 'Dina Fathy', nameAr: 'دينا فتحي', rating: 5, date: 'February 28, 2025', service: 'Balayage Color', serviceAr: 'صباغة بالياج', text: 'The most natural balayage I\'ve ever had. The color looks like the sun kissed my hair — it\'s absolutely gorgeous. Booking my next session already. TransforM is truly in a league of their own.', textAr: 'أكثر بالياج طبيعي حصلت عليه. اللون يبدو كأن الشمس قبّلت شعري — جميل للغاية.', verified: false, helpful: 21 },
];

const ratingBreakdown = [
  { stars: 5, count: 487, pct: 97 },
  { stars: 4, count: 12, pct: 2 },
  { stars: 3, count: 3, pct: 1 },
  { stars: 2, count: 0, pct: 0 },
  { stars: 1, count: 0, pct: 0 },
];

const filterOptions = ['All Reviews', '5 Stars', 'With Photos', 'Verified'];
const filterOptionsAr = ['كل التقييمات', '5 نجوم', 'مع صور', 'موثقة'];

export default function Reviews() {
  const { lang } = useTranslation();
  const [activeFilter, setActiveFilter] = useState(0);
  const [helpful, setHelpful] = useState<Set<number>>(new Set());

  const toggleHelpful = (id: number) => {
    setHelpful(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const filtered = activeFilter === 1 ? reviews.filter(r => r.rating === 5)
    : activeFilter === 3 ? reviews.filter(r => r.verified)
    : reviews;

  return (
    <div className="min-h-screen bg-white pt-24">
      {/* Hero */}
      <div className="bg-black py-20 text-center">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-5xl md:text-6xl text-gold mb-4">
          {lang === 'ar' ? 'ماذا تقول عميلاتنا' : 'What Our Clients Say'}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-300 text-xl">
          {lang === 'ar' ? 'تقييمات حقيقية من تحولات حقيقية' : 'Real reviews from real transformations'}
        </motion.p>
      </div>

      {/* Overall Rating */}
      <section className="bg-ivory py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12 items-center">
            <div className="text-center flex-shrink-0">
              <div className="font-serif text-8xl text-black mb-2">4.9</div>
              <div className="flex justify-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-6 h-6 text-gold fill-current" />)}
              </div>
              <p className="text-warm-grey text-sm">{lang === 'ar' ? 'من 500+ تقييم' : 'Based on 500+ reviews'}</p>
              <div className="flex gap-4 justify-center mt-4">
                <div className="text-center">
                  <p className="text-xs text-warm-grey uppercase tracking-wider">{lang === 'ar' ? 'جوجل' : 'Google'}</p>
                  <p className="font-serif text-2xl">4.9</p>
                </div>
                <div className="w-px bg-taupe"></div>
                <div className="text-center">
                  <p className="text-xs text-warm-grey uppercase tracking-wider">{lang === 'ar' ? 'فيسبوك' : 'Facebook'}</p>
                  <p className="font-serif text-2xl">5.0</p>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full">
              {ratingBreakdown.map(({ stars, count, pct }) => (
                <div key={stars} className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-warm-grey w-12 text-right">{stars} {lang === 'ar' ? '★' : '★'}</span>
                  <div className="flex-1 h-2 bg-taupe rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gold rounded-full"
                    />
                  </div>
                  <span className="text-sm text-warm-grey w-10">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Filter */}
      <div className="sticky top-[72px] z-20 bg-white border-b border-taupe">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-4 overflow-x-auto scrollbar-hide [-webkit-mask-image:linear-gradient(to_right,black_88%,transparent_100%)] [mask-image:linear-gradient(to_right,black_88%,transparent_100%)] rtl:[-webkit-mask-image:linear-gradient(to_left,black_88%,transparent_100%)] rtl:[mask-image:linear-gradient(to_left,black_88%,transparent_100%)] md:[mask-image:none] md:[-webkit-mask-image:none]">
            {filterOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => setActiveFilter(i)}
                className={cn(
                  "px-5 py-2 text-sm uppercase tracking-widest whitespace-nowrap transition-all rounded-sm font-medium",
                  activeFilter === i ? "bg-black text-gold" : "text-warm-grey border border-taupe hover:border-black"
                )}
              >
                {lang === 'ar' ? filterOptionsAr[i] : opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="space-y-8">
            {filtered.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border border-taupe rounded-sm p-8 shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-black">{lang === 'ar' ? review.nameAr : review.name}</span>
                      {review.verified && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle className="w-3 h-3" />
                          {lang === 'ar' ? 'موثق' : 'Verified'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(review.rating)].map((_, j) => <Star key={j} className="w-4 h-4 text-gold fill-current" />)}
                      </div>
                      <span className="text-warm-grey text-xs">{review.date}</span>
                    </div>
                  </div>
                  <span className="text-xs text-warm-grey uppercase tracking-widest bg-ivory px-3 py-1 rounded-sm">
                    {lang === 'ar' ? review.serviceAr : review.service}
                  </span>
                </div>

                <p className="text-gray-600 font-light leading-relaxed mb-6 italic">
                  "{lang === 'ar' ? review.textAr : review.text}"
                </p>

                <div className="flex items-center justify-between border-t border-taupe pt-4">
                  <span className="text-warm-grey text-sm">{lang === 'ar' ? 'هل كان هذا مفيداً؟' : 'Was this helpful?'}</span>
                  <button
                    onClick={() => toggleHelpful(review.id)}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-colors",
                      helpful.has(review.id) ? "text-gold" : "text-warm-grey hover:text-black"
                    )}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    {review.helpful + (helpful.has(review.id) ? 1 : 0)}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-black text-center">
        <h2 className="font-serif text-4xl text-gold mb-4">
          {lang === 'ar' ? 'هل أنتِ مستعدة لتجربتك الخاصة؟' : 'Ready for Your Own Transformation?'}
        </h2>
        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
          {lang === 'ar' ? 'احجزي موعدك اليوم واكتشفي لماذا تختار آلاف النساء ترانسفورم.' : 'Join thousands of clients who trust TransforM for their most important beauty moments.'}
        </p>
        <Link href="/book">
          <Button variant="shop" size="lg">{lang === 'ar' ? 'احجزي الآن' : 'Book Your Appointment'}</Button>
        </Link>
      </section>
    </div>
  );
}
