import { useEffect, useState } from 'react';
import { Instagram, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IGItem {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface Props {
  lang: 'en' | 'ar';
  fallbackImages?: string[];
}

// Live Instagram feed for the Home page. Falls back to the static image grid
// passed in via `fallbackImages` if the API is unconfigured/unavailable, so
// the section never renders broken.
export function InstagramFeed({ lang, fallbackImages = [] }: Props) {
  const [items, setItems] = useState<IGItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}api/instagram/feed?limit=6`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { data?: IGItem[] }) => {
        if (!active) return;
        const data = j.data || [];
        if (data.length === 0) {
          setUsingFallback(true);
        } else {
          setItems(data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setUsingFallback(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const showFallback = usingFallback && fallbackImages.length > 0;

  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12">
          <div>
            <h2 className="font-serif text-4xl md:text-5xl text-gold mb-2">
              {lang === 'ar' ? 'تابعي تحولاتنا' : 'Follow Our Transformations'}
            </h2>
            <a
              href="https://www.instagram.com/transformegypt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl text-white hover:text-gold transition-colors inline-flex items-center gap-2"
            >
              <Instagram className="w-5 h-5" /> @transformegypt{' '}
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
          <div className="mt-6 md:mt-0">
            <a
              href="https://www.instagram.com/transformegypt"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm">
                {lang === 'ar' ? 'تابعي على إنستغرام' : 'Follow on Instagram'}
              </Button>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-neutral-900 animate-pulse"
                />
              ))
            : showFallback
              ? fallbackImages.slice(0, 6).map((img, i) => (
                  <a
                    key={i}
                    href="https://www.instagram.com/transformegypt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden block bg-neutral-900"
                  >
                    <img
                      src={img}
                      alt="TransforM Egypt"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
                      <Instagram className="text-white w-10 h-10" />
                    </div>
                  </a>
                ))
              : items.map((it) => (
                  <a
                    key={it.id}
                    href={it.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden block bg-neutral-900"
                    aria-label={
                      it.caption
                        ? it.caption.slice(0, 80)
                        : 'Instagram post by @transformegypt'
                    }
                  >
                    <img
                      src={
                        it.media_type === 'VIDEO'
                          ? it.thumbnail_url || it.media_url
                          : it.media_url
                      }
                      alt={it.caption ? it.caption.slice(0, 100) : 'Instagram post'}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
                      <Instagram className="text-white w-10 h-10" />
                    </div>
                    {it.media_type === 'VIDEO' && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="w-7 h-7 bg-black/60 rounded-full flex items-center justify-center">
                          <svg
                            className="w-3.5 h-3.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.3 2.84A1 1 0 005 3.7v12.6a1 1 0 001.5.86l11-6.3a1 1 0 000-1.72l-11-6.3z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </a>
                ))}
        </div>
      </div>
    </section>
  );
}
