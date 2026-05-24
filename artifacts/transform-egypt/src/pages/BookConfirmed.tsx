import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';

export default function BookConfirmed() {
  const { lang } = useTranslation();

  useEffect(() => {
    document.title = lang === 'ar'
      ? 'تم استلام طلبك — TransforM Egypt'
      : 'Booking Confirmed — TransforM Egypt';
    window.scrollTo(0, 0);
  }, [lang]);

  const waLink = buildWhatsAppLink({ name: '', service: 'Free Consultation', branch: 'City Stars Mall', lang });

  return (
    <div className="min-h-screen bg-ivory pt-32 pb-20 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white max-w-lg w-full p-12 text-center rounded-sm shadow-lg border border-taupe"
      >
        <CheckCircle2 className="w-20 h-20 text-gold mx-auto mb-6" />
        <h2 className="font-serif text-4xl text-black mb-2">
          {lang === 'ar' ? 'تم الإرسال!' : 'Request Sent!'}
        </h2>
        <p className="text-gold font-serif italic text-lg mb-4">
          {lang === 'ar' ? 'أنتِ جديدة، اليوم!' : 'A new you, Today!'}
        </p>
        <p className="text-gray-600 mb-8">
          {lang === 'ar'
            ? 'استلمنا طلب حجزك. فريقنا هيتواصل معاكي قريباً لتأكيد الموعد.'
            : "We've received your booking request. Our team will contact you shortly to confirm your appointment."}
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/">
            <Button variant="primary" className="w-full">
              {lang === 'ar' ? 'العودة للرئيسية' : 'Return to Home'}
            </Button>
          </Link>
          <a href={waLink} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">
              {lang === 'ar' ? 'تواصلي معنا على واتساب' : 'Message us on WhatsApp'}
            </Button>
          </a>
        </div>
      </motion.div>
    </div>
  );
}
