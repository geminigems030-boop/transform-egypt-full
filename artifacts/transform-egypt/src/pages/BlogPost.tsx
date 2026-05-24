import { useEffect } from 'react';
import { useRoute } from 'wouter';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { getPostBySlug, blogPosts } from '@/lib/blogData';
import { ArrowLeft, Clock, Calendar, Share2 } from 'lucide-react';

export default function BlogPost() {
  const [, params] = useRoute('/blog/:slug');
  const { lang } = useTranslation();
  const slug = params?.slug ?? '';
  const post = getPostBySlug(slug);

  useEffect(() => {
    if (post) {
      document.title = lang === 'ar' ? post.titleAr : post.titleEn;
    }
    window.scrollTo(0, 0);
  }, [post, lang]);

  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-3xl mb-4">
            {lang === 'ar' ? 'المقال مش موجود' : 'Article not found'}
          </h1>
          <Link href="/blog" className="text-gold hover:text-white transition-colors">
            {lang === 'ar' ? 'الرجوع للمدونة' : 'Back to Journal'}
          </Link>
        </div>
      </div>
    );
  }

  const title = lang === 'ar' ? post.titleAr : post.titleEn;
  const content = lang === 'ar' ? post.contentAr : post.contentEn;
  const related = blogPosts
    .filter((p) => p.slug !== slug)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-gold transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              {lang === 'ar' ? 'الرجوع للمدونة' : 'Back to Journal'}
            </Link>

            <div className="flex items-center gap-3 mb-4 text-xs text-white/40 uppercase tracking-wider">
              <span>{lang === 'ar' ? post.categoryAr : post.categoryEn}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(post.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {post.readTime} min {lang === 'ar' ? 'قراءة' : 'read'}
              </span>
            </div>

            <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl leading-[1.05] mb-8">
              {title}
            </h1>

            <div className="aspect-[21/9] overflow-hidden rounded-lg bg-white/5">
              <img
                src={post.image}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="prose prose-invert prose-lg max-w-none
              prose-headings:font-serif prose-headings:text-white prose-headings:leading-tight
              prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6
              prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-6
              prose-ul:text-gray-300 prose-ul:mb-6 prose-ul:space-y-2
              prose-li:marker:text-gold
              prose-a:text-gold prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white
              prose-table:text-gray-300 prose-table:border-white/10
              prose-th:text-white prose-th:border-white/20 prose-th:font-medium prose-th:uppercase prose-th:text-xs prose-th:tracking-wider
              prose-td:border-white/10"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* CTA */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="bg-gold/5 border border-gold/20 rounded-xl p-6 md:p-8 text-center">
              <h3 className="font-serif text-xl md:text-2xl text-white mb-3">
                {lang === 'ar'
                  ? 'جاهزة لتجربة الجمال مع TransforM؟'
                  : 'Ready to experience TransforM?'}
              </h3>
              <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                {lang === 'ar'
                  ? 'احجزي استشارتك المجانية الآن وابدأي رحلة التحول.'
                  : 'Book your free consultation now and begin your transformation journey.'}
              </p>
              <Link
                href="/book"
                className="inline-flex items-center gap-2 bg-gold text-black px-6 py-3 rounded-lg font-medium hover:bg-gold/90 transition-colors"
              >
                {lang === 'ar' ? 'احجزي استشارتك المجانية' : 'Book Free Consultation'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="pb-24 md:pb-32 border-t border-white/10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl pt-16">
            <h2 className="font-serif text-2xl md:text-3xl mb-8">
              {lang === 'ar' ? 'مقالات مشابهة' : 'Related Articles'}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group bg-[#0c0c0c] border border-white/10 hover:border-gold/30 transition-all duration-300 p-6 block"
                >
                  <span className="text-gold text-xs uppercase tracking-wider mb-2 block">
                    {lang === 'ar' ? r.categoryAr : r.categoryEn}
                  </span>
                  <h3 className="font-serif text-lg group-hover:text-gold transition-colors leading-tight">
                    {lang === 'ar' ? r.titleAr : r.titleEn}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
