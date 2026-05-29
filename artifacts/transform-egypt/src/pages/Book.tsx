import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateBooking } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { trackBookingLead, trackInitiateBooking, trackContact, newEventId } from '@/lib/analytics';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { MapPin, Phone, Clock, MessageCircle } from 'lucide-react';

const PHONE_1 = '01009780008';
const PHONE_2 = '01004545700';
const WHATSAPP_NUM = '201009780008';

// Fallback list of currently-open branches (used until /api/branches loads, or if
// it fails). Live open branches are fetched in the component so this stays in
// sync with the DB / Google Sheet without a redeploy.
const FALLBACK_BRANCHES = [
  { en: 'City Stars Mall — Ground floor, Gate 7', ar: 'سيتي ستارز مول — الدور الأرضي، بوابة 7' },
  { en: 'Cairo Festival City Mall — 3rd Floor, New Cairo', ar: 'كايرو فيستيفال سيتي مول — الدور الثالث، القاهرة الجديدة' },
  { en: 'Sofitel Downtown Cairo — Downstairs', ar: 'سوفيتيل داون تاون — الدور السفلي' },
];

const serviceOptions = [
  { en: 'Hair Extensions (Indian)', ar: 'اكستنشن (هندي)' },
  { en: 'Hair Extensions (Russian)', ar: 'اكستنشن (روسي)' },
  { en: 'Hair Extensions (Brazilian)', ar: 'اكستنشن (برازيلي)' },
  { en: 'Hair Extensions (Turkish)', ar: 'اكستنشن (تركي)' },
  { en: 'Tape-In Extensions', ar: 'اكستنشن تيب إن (لاصق)' },
  { en: 'Keratin Bond Extensions', ar: 'اكستنشن كيراتين بوند' },
  { en: 'Lash Extensions — Classic', ar: 'لاش كلاسيك' },
  { en: 'Lash Extensions — Hybrid', ar: 'لاش هايبرد' },
  { en: 'Lash Extensions — Volume', ar: 'لاش فوليوم' },
  { en: 'Lash Extensions — Mega Volume', ar: 'لاش ميجا فوليوم' },
  { en: 'Fox Lashes', ar: 'لاش فوكس' },
  { en: 'Microblading', ar: 'مايكروبليدنج' },
  { en: 'Lip Blushing', ar: 'ليب بلاشينج (توريد شفايف)' },
  { en: 'Brow Extensions', ar: 'اكستنشن حواجب' },
  { en: 'Micropigmentation', ar: 'مايكروبيجمنتيشن' },
  { en: 'Skin Care / Facials', ar: 'سكين كير / فيشيال' },
  { en: 'Hydrafacial', ar: 'هيدرافيشيال' },
  { en: 'Dermapen', ar: 'ديرمابن' },
  { en: 'Nails (Hard Gel / Acrylic)', ar: 'نيلز (هارد جيل / أكريليك)' },
  { en: 'Bridal Package', ar: 'باكدج العروسة' },
  { en: 'Wigs', ar: 'باروكات (ويجز)' },
  { en: 'Hair Treatment', ar: 'هير تريتمنت' },
  { en: 'VIP Consultation with Mervat', ar: 'استشارة VIP مع الأستاذة ميرفت' },
  { en: 'Free Consultation', ar: 'كونسلتيشن مجانية' },
];

export default function Book() {
  const { toast } = useToast();
  const { lang } = useTranslation();
  const bookMutation = useCreateBooking();
  const [branchList, setBranchList] = useState(FALLBACK_BRANCHES);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: 'Free Consultation',
    branch: FALLBACK_BRANCHES[0].en,
    date: '',
    message: ''
  });

  useEffect(() => {
    trackInitiateBooking();
  }, []);

  // Pull the live open branches from the DB so the dropdown matches reality
  // (e.g. CFCM open, O Mall hidden) without a redeploy. Falls back silently.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/branches')
      .then((r) => (r.ok ? r.json() : { branches: [] }))
      .then((d: { branches?: Array<{ name: string; nameAr: string | null; city: string | null; cityAr: string | null; status: string }> }) => {
        if (cancelled || !Array.isArray(d.branches)) return;
        const open = d.branches.filter((b) => b.status === 'open');
        if (open.length === 0) return;
        const mapped = open.map((b) => ({
          en: b.city ? `${b.name} — ${b.city}` : b.name,
          ar: b.nameAr ? (b.cityAr ? `${b.nameAr} — ${b.cityAr}` : b.nameAr) : (b.city ? `${b.name} — ${b.city}` : b.name),
        }));
        setBranchList(mapped);
        // Keep the selected branch valid against the new options.
        setFormData((prev) => (mapped.some((m) => m.en === prev.branch) ? prev : { ...prev, branch: mapped[0].en }));
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Shared eventId for Pixel + CAPI dedup on the Lead event.
    const eventId = newEventId();
    bookMutation.mutate(
      { data: formData as any },
      {
        onSuccess: () => {
          trackBookingLead({ service: formData.service, branch: formData.branch, eventId });
          // Phase D — also write to the unified submissions table for the
          // admin dashboard. Fire-and-forget; booking success isn't blocked
          // on this and any failure is logged silently.
          void fetch('/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'book',
              name: formData.name,
              phone: formData.phone,
              email: formData.email,
              branch: formData.branch,
              service: formData.service,
              message: formData.message ? `${formData.message}\n[Preferred date: ${formData.date}]` : `Preferred date: ${formData.date}`,
              language: lang,
              eventId,
            }),
          }).catch(() => undefined);
          window.location.href = '/book/confirmed';
        },
        onError: () => {
          toast({
            title: lang === 'ar' ? 'حدث خطأ' : 'Something went wrong',
            description: lang === 'ar' ? 'حاولي مرة أخرى أو تواصلي معنا عبر الواتساب' : 'Please try again or contact us via WhatsApp',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };


  return (
    <div className="min-h-screen bg-ivory pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col lg:flex-row bg-white rounded-sm shadow-xl overflow-hidden border border-taupe">
          {/* Left info panel */}
          <div className="bg-black p-10 lg:w-2/5 text-white flex flex-col justify-between">
            <div>
              <p className="text-gold font-serif italic text-lg mb-2">{lang === 'ar' ? 'أنتِ جديدة، اليوم!' : 'A new you, Today!'}</p>
              <h2 className="font-serif text-3xl text-white mb-6">{lang === 'ar' ? 'احجزي تجربتك الـ VIP' : 'Book Your VIP Experience'}</h2>
              <p className="text-gray-300 font-light text-sm leading-relaxed mb-8">
                {lang === 'ar'
                  ? 'احجزي مكانك في أكبر وأفخم سنتر اكستنشن وبيوتي في مصر. أول كونسلتيشن مجانية بالكامل!'
                  : 'Reserve your spot at Egypt\'s largest and most premium beauty center. First consultation is FREE!'}
              </p>
            </div>

            <div className="space-y-6 text-sm text-gray-400">
              <div>
                <strong className="text-gold block mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" />{lang === 'ar' ? 'فروعنا' : 'Our Branches'}</strong>
                <ul className="space-y-1">
                  {branchList.map(b => <li key={b.en} className="text-gray-400">{lang === 'ar' ? b.ar.split('—')[0] : b.en.split('—')[0]}</li>)}
                </ul>
              </div>
              <div>
                <strong className="text-gold block mb-1 flex items-center gap-2"><Phone className="w-4 h-4" />{lang === 'ar' ? 'اتصلي بنا' : 'Call Us'}</strong>
                <a href={`tel:+2${PHONE_1}`} onClick={() => trackContact('phone')} className="block hover:text-gold transition-colors">{PHONE_1}</a>
                <a href={`tel:+2${PHONE_2}`} onClick={() => trackContact('phone')} className="block hover:text-gold transition-colors">{PHONE_2}</a>
              </div>
              <div>
                <strong className="text-gold block mb-1 flex items-center gap-2"><Clock className="w-4 h-4" />{lang === 'ar' ? 'ساعات العمل' : 'Hours'}</strong>
                {lang === 'ar' ? 'يومياً: من 12 ظهراً' : 'Daily: from 12:00 noon'}
              </div>
              <a href={buildWhatsAppLink({ name: formData.name, service: formData.service, branch: formData.branch, lang })} onClick={() => trackContact('whatsapp')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#25D366] hover:underline font-medium">
                <MessageCircle className="w-4 h-4" />{lang === 'ar' ? 'واتساب' : 'WhatsApp Booking'}
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="p-10 lg:w-3/5">
            <h3 className="font-serif text-2xl mb-8">{lang === 'ar' ? 'معلومات العميلة' : 'Client Information'}</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'الاسم الكامل *' : 'Full Name *'}</label>
                  <Input required name="name" value={formData.name} onChange={handleChange} className="focus-visible:ring-gold text-gray-900 placeholder:text-gray-400" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}</label>
                  <Input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="focus-visible:ring-gold text-gray-900 placeholder:text-gray-400" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'البريد الإلكتروني *' : 'Email Address *'}</label>
                <Input required type="email" name="email" value={formData.email} onChange={handleChange} className="focus-visible:ring-gold text-gray-900 placeholder:text-gray-400" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'الخدمة المطلوبة *' : 'Service of Interest *'}</label>
                  <select required name="service" value={formData.service} onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                  >
                    {serviceOptions.map(s => <option key={s.en} value={s.en}>{lang === 'ar' ? s.ar : s.en}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'الفرع المفضل *' : 'Preferred Branch *'}</label>
                  <select required name="branch" value={formData.branch} onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                  >
                    {branchList.map(b => <option key={b.en} value={b.en}>{lang === 'ar' ? b.ar : b.en}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'التاريخ المفضل *' : 'Preferred Date *'}</label>
                <Input required type="date" name="date" value={formData.date} onChange={handleChange} className="focus-visible:ring-gold text-gray-900" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{lang === 'ar' ? 'ملاحظات إضافية (اختياري)' : 'Additional Notes (Optional)'}</label>
                <textarea name="message" value={formData.message} onChange={handleChange} rows={3}
                  className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                  placeholder={lang === 'ar' ? 'كلمينا عن أهدافك...' : 'Tell us about your beauty goals...'}
                />
              </div>

              <Button type="submit" variant="shop" className="w-full py-6 text-lg" disabled={bookMutation.isPending}>
                {bookMutation.isPending ? (lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : (lang === 'ar' ? 'طلب موعد' : 'Request Appointment')}
              </Button>

              <p className="text-center text-warm-grey text-xs">
                {lang === 'ar' ? 'أو تواصلي معنا مباشرة عبر الهاتف أو الواتساب' : 'Or contact us directly by phone or WhatsApp'}
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
