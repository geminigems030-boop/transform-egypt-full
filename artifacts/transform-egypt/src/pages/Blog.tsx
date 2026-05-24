import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { useTranslation } from '@/lib/i18n';
import { blogPosts } from '@/lib/blogData';
import { ArrowRight, Clock, Calendar } from 'lucide-react';

export default function Blog() {
  const { lang } = useTranslation();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-gold text-xs uppercase tracking-[0.5em] font-light mb-4">
              {lang === 'ar' ? 'المدونة' : 'TransforM Journal'}
            </p>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.05] mb-6">
              {lang === 'ar'
                ? 'معلومات تساعدك تختاري بثقة'
                : 'Expert advice to help you choose with confidence.'}
            </h1>
            <p className="text-gray-300 text-lg max-w-2xl font-light leading-relaxed">
              {lang === 'ar'
                ? 'دلايل مفصلة من آرتيستات TransforM بتغطي كل جانب من الجمال — الاكستنشن، الرموش، الحواجب، والعناية بالبشرة.'
                : 'Detailed guides from TransforM stylists covering every side of beauty — hair extensions, lashes, brows, and skincare.'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Articles grid */}
      <section className="pb-24 md:pb-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map((post, i) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group bg-[#0c0c0c] border border-white/10 hover:border-gold/30 transition-all duration-300 flex flex-col"
              >
                <Link href={`/blog/${post.slug}`}>
                  <div className="aspect-[16/10] overflow-hidden bg-white/5">
                    <img
                      src={post.image}
                      alt={lang === 'ar' ? post.titleAr : post.titleEn}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </Link>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-3 text-xs text-white/40 uppercase tracking-wider">
                    <span>{lang === 'ar' ? post.categoryAr : post.categoryEn}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'short', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readTime} min
                    </span>
                  </div>
                  <h2 className="font-serif text-xl leading-tight mb-3 group-hover:text-gold transition-colors">
                    <Link href={`/blog/${post.slug}`}>
                      {lang === 'ar' ? post.titleAr : post.titleEn}
                    </Link>
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed flex-1">
                    {lang === 'ar' ? post.excerptAr : post.excerptEn}
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-2 text-sm text-gold hover:text-white transition-colors"
                    >
                      {lang === 'ar' ? 'اقرأ المزيد' : 'Read more'}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
