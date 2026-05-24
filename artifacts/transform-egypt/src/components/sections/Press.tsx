import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';

const outlets = [
  { en: 'Heya w Bas', ar: 'هي وبس' },
  { en: 'Vogue Arabia', ar: 'فوج العربية' },
  { en: 'ET Bil Arabi', ar: 'إي تي بالعربي' },
  { en: 'Layalina', ar: 'ليالينا' },
  { en: 'Hia Magazine', ar: 'مجلة هي' },
  { en: 'Sayidaty', ar: 'سيدتي' },
];

const pressQuotes = [
  {
    quote: {
      en: '"Mervat Atalla is the beauty expert Egyptian women trust — her image consultations have shaped countless on-screen looks."',
      ar: '"ميرفت عطا الله هي خبيرة الجمال اللي بتثق فيها بنات مصر — استشاراتها رسمت إطلالات كتير على الشاشة."',
    },
    source: { en: 'Heya w Bas — Radwa El Sherbiny', ar: 'هي وبس — رضوى الشربيني' },
  },
  {
    quote: {
      en: '"The address every Cairo bride knows by heart."',
      ar: '"العنوان اللي كل عروسة في القاهرة بتعرفه."',
    },
    source: { en: 'Cairo Brides Magazine', ar: 'مجلة عرائس القاهرة' },
  },
  {
    quote: {
      en: '"Egypt\u2019s most-trusted destination for luxury hair extensions."',
      ar: '"الوجهة الأكثر ثقة في مصر للاكستنشن الفاخر."',
    },
    source: { en: 'ET Bil Arabi', ar: 'إي تي بالعربي' },
  },
];

export default function Press() {
  const { lang } = useTranslation();

  return (
    <section className="py-20 md:py-28 bg-black border-t border-white/[0.06]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-gold text-xs uppercase tracking-[0.5em] font-light mb-4">
            {lang === 'ar' ? 'ظهرنا في' : 'As Featured In'}
          </p>
          <h2 className="font-serif text-3xl md:text-5xl text-white max-w-3xl mx-auto leading-tight">
            {lang === 'ar' ? 'ثقة النجمات وكبرى المنابر الإعلامية.' : 'Trusted by celebrities and the editors who cover them.'}
          </h2>
          <p className="text-warm-grey text-sm md:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
            {lang === 'ar'
              ? 'الأستاذة ميرفت عطا الله — مؤسسة ترانسفورم — ضيفة دائمة في برنامج "هي وبس" مع الإعلامية رضوى الشربيني كخبيرة جمال ومستشارة إطلالة.'
              : 'TransforM Founder Mervat Atalla is a regular guest beauty expert and image consultant on Heya w Bas with Radwa El Sherbiny — Egypt\u2019s most-watched women\u2019s show.'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-10 mb-20 items-center"
        >
          {outlets.map((o, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="text-center"
            >
              <span className="font-serif text-white/60 text-lg md:text-xl tracking-wider hover:text-gold transition-colors duration-300 whitespace-nowrap">
                {lang === 'ar' ? o.ar : o.en}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pressQuotes.map((p, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border border-white/10 p-8 bg-[#0c0c0c] hover:border-gold/40 transition-colors"
            >
              <blockquote className="font-serif italic text-white/85 text-lg leading-relaxed mb-4">
                {lang === 'ar' ? p.quote.ar : p.quote.en}
              </blockquote>
              <figcaption className="text-gold text-xs uppercase tracking-[0.3em]">
                — {lang === 'ar' ? p.source.ar : p.source.en}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
