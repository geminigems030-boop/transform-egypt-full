import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ShoppingBag, Globe, MessageCircle, Instagram, Facebook, MapPin, Phone } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { trackContact, trackLuckyFooterClick, trackNewsletterLead, newEventId } from '@/lib/analytics';
import { useCart } from '@/lib/cart';
import YaraCallWidget from './YaraCallWidget';
import { YaraChatWidget } from './YaraChatWidget';

const WHATSAPP_NUM = '201009780008';
const PHONE_1 = '01009780008';
const PHONE_2 = '01004545700';

const branches = [
  { nameEn: 'City Stars Mall', nameAr: 'سيتي ستارز مول', detailEn: 'Ground floor, Gate 7', detailAr: 'الدور الأرضي، بوابة 7', mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+City+Stars+Mall+Cairo' },
  { nameEn: 'Sofitel Downtown', nameAr: 'سوفيتيل داون تاون', detailEn: 'Lower level', detailAr: 'الدور السفلي', mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+Sofitel+Downtown+Cairo' },
  { nameEn: 'O Mall — New Alamein', nameAr: 'أوه مول — العلمين', detailEn: 'North Coast', detailAr: 'الساحل الشمالي', mapUrl: 'https://www.google.com/maps/search/Transform+Egypt+O+Mall+New+Alamein' },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, lang, toggleLanguage } = useTranslation();
  const [location] = useLocation();

  const { itemCount: cartItemsCount } = useCart();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/services', label: t('nav.services') },
    { href: '/transformations', label: t('nav.transformations') },
    { href: '/team', label: t('nav.team') },
    { href: '/locations', label: t('nav.locations') },
    { href: '/blog', label: t('nav.blog') },
    { href: '/boutique', label: t('nav.boutique') },
    { href: '/reviews', label: t('nav.reviews') },
    { href: '/gift-cards', label: t('nav.giftCards') },
    { href: '/try-on', label: t('nav.tryOn') },
  ];

  // Admin route — render with no site chrome (header, footer, FABs intercept clicks)
  if (location.split('?')[0] === '/admin') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-gold selection:text-black">
      {/* HEADER — reduced mobile height ~15% for cleaner luxury feel (item #4) */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b border-transparent",
        isScrolled ? "bg-black/90 backdrop-blur-md border-white/10 py-3 md:py-4" : "bg-gradient-to-b from-black/80 to-transparent py-4 md:py-6"
      )}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <img src={`${import.meta.env.BASE_URL}logo-t.png`} alt="TransforM Logo" className="h-10 w-10 object-contain group-hover:scale-105 transition-transform" />
              <span className="font-serif text-2xl tracking-widest text-white hidden sm:block">TransforM</span>
            </Link>

            {/* Desktop inline nav removed — luxury minimalist (Aesop / Tom Ford pattern).
                All navigation lives in the hamburger drawer for both mobile and desktop. */}

            <div className="flex items-center gap-4">
              <button onClick={toggleLanguage} className="flex items-center gap-2 text-sm text-gray-300 hover:text-gold transition-colors" aria-label="Toggle Language">
                <Globe className="w-4 h-4" />
                <span className="uppercase">{lang === 'en' ? 'AR' : 'EN'}</span>
              </button>
              <Link href="/cart" className="relative p-2 text-gray-300 hover:text-gold transition-colors">
                <ShoppingBag className="w-5 h-5" />
                {cartItemsCount > 0 && (
                  <span className="absolute top-0 right-0 bg-gold text-black text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center transform translate-x-1/4 -translate-y-1/4">{cartItemsCount}</span>
                )}
              </Link>
              {/* Header reduced to 4 elements: T logo / lang toggle / cart / hamburger (item #4).
                  Primary BOOK CTA lives in the mobile drawer + the floating glass FAB. */}
              <button className="text-white p-2" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="fixed inset-0 z-[100] bg-black">
            <div className="flex flex-col h-full p-6">
              <div className="flex justify-end">
                <button onClick={() => setMobileMenuOpen(false)} className="text-white p-2 hover:text-gold transition-colors" aria-label="Close menu"><X className="w-8 h-8" /></button>
              </div>
              <nav className="flex flex-col gap-6 mt-12">
                {navLinks.map((link, i) => (
                  <motion.div key={link.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
                    <Link href={link.href} onClick={() => setMobileMenuOpen(false)} className={cn("text-3xl font-serif block", location === link.href ? "text-gold" : "text-white")}>{link.label}</Link>
                  </motion.div>
                ))}
              </nav>
              <div className="mt-auto pb-12 flex flex-col gap-6">
                <Link href="/book" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="shop" className="w-full text-lg h-14">{t('nav.book')}</Button>
                </Link>
                <div className="flex items-center justify-center gap-4 text-gray-400">
                  <a href="https://www.instagram.com/transformegypt" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="Instagram"><Instagram className="w-6 h-6" /></a>
                  <a href="https://www.facebook.com/share/1GAJKnTcWe/" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="Facebook"><Facebook className="w-6 h-6" /></a>
                  <a href="https://www.tiktok.com/@transformegypt" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="TikTok"><span className="text-lg font-bold">TT</span></a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">{children}</main>

      {/* FOOTER */}
      <footer className="bg-black pt-20 pb-10 border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={`${import.meta.env.BASE_URL}logo-t.png`} alt="TransforM Logo" className="h-8 w-8 object-contain" />
                <span className="font-serif text-2xl tracking-widest text-white">TransforM</span>
              </div>
              <p className="text-gold font-serif italic text-lg mb-4">{t('footer.tagline')}</p>
              <p className="text-gray-400 font-light mb-6">{t('footer.description')}</p>
              <div className="flex gap-4">
                <a href="https://www.instagram.com/transformegypt" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold transition-colors" aria-label="Instagram"><Instagram className="w-4 h-4" /></a>
                <a href="https://www.facebook.com/share/1GAJKnTcWe/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold transition-colors" aria-label="Facebook"><Facebook className="w-4 h-4" /></a>
                <a href="https://www.tiktok.com/@transformegypt" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold transition-colors" aria-label="TikTok"><span className="text-xs font-bold">TT</span></a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-serif text-xl mb-6">{t('footer.services')}</h4>
              <ul className="flex flex-col gap-3 text-gray-400 font-light">
                <li><Link href="/services" className="hover:text-gold transition-colors">{t('footer.hairExt')}</Link></li>
                <li><Link href="/services" className="hover:text-gold transition-colors">{t('footer.lashExt')}</Link></li>
                <li><Link href="/services" className="hover:text-gold transition-colors">{t('footer.microblading')}</Link></li>
                <li><Link href="/services" className="hover:text-gold transition-colors">{t('footer.skincare')}</Link></li>
                <li><Link href="/services" className="hover:text-gold transition-colors">{t('footer.nails')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-serif text-xl mb-6">{t('footer.branches')}</h4>
              <ul className="flex flex-col gap-3 text-gray-400 font-light">
                {branches.map(b => (
                  <li key={b.nameEn}>
                    <a href={b.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors flex items-center gap-2">
                      <MapPin className="w-3 h-3 flex-shrink-0" /> {lang === 'ar' ? b.nameAr : b.nameEn}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-serif text-xl mb-6">{lang === 'ar' ? 'اكتشفي' : 'Explore'}</h4>
              <ul className="flex flex-col gap-3 text-gray-400 font-light mb-6">
                <li><Link href="/blog" className="hover:text-gold transition-colors">{t('nav.blog')}</Link></li>
                <li><Link href="/team" className="hover:text-gold transition-colors">{t('nav.team')}</Link></li>
                <li><Link href="/locations" className="hover:text-gold transition-colors">{t('nav.locations')}</Link></li>
                <li><Link href="/gift-cards" className="hover:text-gold transition-colors">{t('nav.giftCards')}</Link></li>
                <li><Link href="/transformations" className="hover:text-gold transition-colors">{t('nav.transformations')}</Link></li>
              </ul>
              {/* Lucky Wheel paused — link hidden until further notice */}
              <h4 className="text-white font-serif text-xl mb-4">{t('footer.contact')}</h4>
              <ul className="flex flex-col gap-3 text-gray-400 font-light">
                <li><a href={`tel:+2${PHONE_1}`} onClick={() => trackContact('phone')} className="hover:text-gold transition-colors flex items-center gap-2"><Phone className="w-3 h-3" />{PHONE_1}</a></li>
                <li><a href={`tel:+2${PHONE_2}`} onClick={() => trackContact('phone')} className="hover:text-gold transition-colors flex items-center gap-2"><Phone className="w-3 h-3" />{PHONE_2}</a></li>
                <li><a href={`https://wa.me/${WHATSAPP_NUM}`} onClick={() => trackContact('whatsapp')} target="_blank" rel="noreferrer" className="hover:text-gold transition-colors flex items-center gap-2"><MessageCircle className="w-3 h-3" />{t('footer.whatsapp')}</a></li>
                <li className="text-gray-500 text-sm mt-2">{t('footer.openHours')}</li>
              </ul>
              <div className="mt-6">
                <h5 className="text-white text-sm font-medium mb-3">{t('footer.newsletter')}</h5>
                <NewsletterForm />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} TransforM Egypt. {t('footer.rights')}</p>
            <div className="flex gap-4 text-sm text-gray-500">
              <Link href="/privacy" className="hover:text-gold">{t('footer.privacy')}</Link>
              <Link href="/terms" className="hover:text-gold">{t('footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Glassmorphism Book Now FAB — hidden on pages that already have a primary booking CTA (item #2).
          Normalize pathname so query strings or trailing slashes don't bypass the hide. */}
      {(() => {
        const path = (location || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return !['/book', '/lucky', '/locations'].includes(path);
      })() && (
        <Link href="/book"
          className="fixed bottom-[12.5rem] right-5 z-50 px-5 py-3 rounded-full flex items-center gap-2 text-gold font-semibold text-sm tracking-widest uppercase shadow-[0_8px_32px_rgba(184,153,104,0.25)] transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgba(184,153,104,0.45)]"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(184,153,104,0.4)' }}
          aria-label="Book Now"
        >
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          {t('common.bookNow')}
        </Link>
      )}

      {/* Floating WhatsApp — moved to bottom-LEFT, dark glass + gold icon (item #3) */}
      <a href={`https://wa.me/${WHATSAPP_NUM}`} target="_blank" rel="noopener noreferrer"
        onClick={() => trackContact('whatsapp')}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-300 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(184,153,104,0.45)' }}
        aria-label="Contact on WhatsApp"
      >
        <MessageCircle className="w-7 h-7 text-gold" />
      </a>

      {/* Yara Voice Call Widget — floating phone button (bottom-right, above Book Now) */}
      <YaraCallWidget />

      {/* Yara AI Chat Widget — bottom-right corner */}
      <YaraChatWidget />
    </div>
  );
};

// ─── Newsletter signup (Phase D — wires to /api/submissions) ──────────────────
function NewsletterForm() {
  const { t, lang } = useTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error' | 'invalid'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('invalid');
      return;
    }
    setStatus('submitting');
    // Same eventId is sent to both Pixel (browser) and CAPI (server) so
    // Meta deduplicates the duplicate Lead events on its side.
    const eventId = newEventId();
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'newsletter', email: trimmed, language: lang, eventId }),
      });
      if (!res.ok) throw new Error('Subscribe failed');
      trackNewsletterLead(eventId);
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <p className="text-gold text-sm" role="status" aria-live="polite">
        {t('newsletter.success')}
      </p>
    );
  }

  return (
    <>
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status !== 'idle') setStatus('idle'); }}
          placeholder={t('footer.emailPlaceholder')}
          aria-label={t('footer.newsletter')}
          required
          className="bg-white/5 border border-white/20 px-4 py-2 text-white w-full focus:outline-none focus:border-gold transition-colors text-sm"
        />
        <Button variant="shop" size="sm" type="submit" disabled={status === 'submitting'}>OK</Button>
      </form>
      {status === 'invalid' && (
        <p className="text-rose-300 text-xs mt-2" role="alert">{t('newsletter.invalid')}</p>
      )}
      {status === 'error' && (
        <p className="text-rose-300 text-xs mt-2" role="alert">{t('newsletter.error')}</p>
      )}
    </>
  );
}
