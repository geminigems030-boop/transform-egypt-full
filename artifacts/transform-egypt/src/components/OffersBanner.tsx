import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface Offer {
  id: number;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
}

// Dynamic offers banner. Fetches active offers from /api/offers (managed in the
// admin Offers tab) and renders only when at least one is live — otherwise the
// component returns null and takes no space.
export default function OffersBanner({ lang }: { lang: 'en' | 'ar' }) {
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/offers')
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d) => { if (!cancelled) setOffers(Array.isArray(d.offers) ? d.offers : []); })
      .catch(() => { if (!cancelled) setOffers([]); });
    return () => { cancelled = true; };
  }, []);

  if (offers.length === 0) return null;

  return (
    <section className="bg-gradient-to-r from-[#0c0c0c] via-[#171206] to-[#0c0c0c] border-y border-gold/30 py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <Sparkles className="w-4 h-4 text-gold" />
          <p className="text-gold text-xs uppercase tracking-[0.4em] font-light">
            {lang === 'ar' ? 'عروض حالية' : 'Current Offers'}
          </p>
        </div>
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          {offers.map((o) => {
            const title = lang === 'ar' ? (o.titleAr || o.title) : o.title;
            const desc = lang === 'ar' ? (o.descriptionAr || o.description) : o.description;
            return (
              <div
                key={o.id}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                className="rounded-xl border border-gold/30 bg-black/40 px-6 py-4 max-w-sm text-center"
              >
                <p className="font-serif text-lg text-white">{title}</p>
                {desc && <p className="text-sm text-white/55 mt-1">{desc}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
