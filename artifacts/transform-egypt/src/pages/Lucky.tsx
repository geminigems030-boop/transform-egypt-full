import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Gift, Trophy, MessageCircle, ArrowRight, ArrowLeft, X, Clock, Star, Mail, Instagram,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  trackQuizStart, trackQuizComplete, trackLeadSubmit,
  trackSpinClick, trackSpinResult, trackBookingClick,
  newEventId,
} from '@/lib/analytics';

const WHATSAPP_NUM = '201009780008';

type GoalKey = 'hair' | 'lash' | 'skin' | 'brows' | 'bridal' | 'makeover';
type HairKey = 'fine' | 'medium' | 'thick' | 'curly' | 'damaged';
type TimeKey = 'thisweek' | 'thismonth' | 'fewmonths' | 'exploring';
type VibeKey = 'subtle' | 'editorial' | 'celebrity' | 'bridal';

const BRANCHES = [
  { key: 'citystars', en: 'City Stars Mall', ar: 'سيتي ستارز مول' },
  { key: 'sofitel', en: 'Sofitel Downtown', ar: 'سوفيتيل داون تاون' },
  { key: 'omall', en: 'O Mall — New Alamein', ar: 'أوه مول — العلمين' },
] as const;

const GOAL_OPTIONS: { key: GoalKey; emoji: string }[] = [
  { key: 'hair', emoji: '💇‍♀️' }, { key: 'lash', emoji: '👁️' }, { key: 'skin', emoji: '✨' },
  { key: 'brows', emoji: '🪞' }, { key: 'bridal', emoji: '👰‍♀️' }, { key: 'makeover', emoji: '💎' },
];
const HAIR_OPTIONS: HairKey[] = ['fine', 'medium', 'thick', 'curly', 'damaged'];
const TIME_OPTIONS: TimeKey[] = ['thisweek', 'thismonth', 'fewmonths', 'exploring'];
const VIBE_OPTIONS: VibeKey[] = ['subtle', 'editorial', 'celebrity', 'bridal'];

const WHEEL_SEGMENTS_EN = [
  'EGP 1500 OFF', '30% OFF', 'FREE DEEP COND.', 'EGP 1500 OFF',
  'FREE BROWS', '15% OFF', 'FREE LASH MAP.', '10% OFF',
];
const WHEEL_SEGMENTS_AR = [
  'خصم 1500 ج', 'خصم 30%', 'ديب كونديشنينج', 'خصم 1500 ج',
  'حواجب مجانًا', 'خصم 15%', 'ماببينج لاش', 'خصم 10%',
];

type Stats = { grandWinnersAwarded: number; grandWinnersRemaining: number; grandWinnersDailyCap: number; totalSpinsToday: number };
type SpinResp = {
  alreadyPlayed: boolean;
  prize: { label: string; labelAr: string; isGrand: boolean; code: string; segmentIndex: number };
  recommendation: { en: string; ar: string };
};

type Stage = 'hero' | 'quiz' | 'reco' | 'spin' | 'result';

// ─────────────────────────────────────────────────────────────────────────────
// LUCKY WHEEL PAUSED
// The spin experience is temporarily disabled. To re-enable, set
// LUCKY_WHEEL_PAUSED to false. The full original component remains below.
// ─────────────────────────────────────────────────────────────────────────────
const LUCKY_WHEEL_PAUSED = true;

function LuckyPaused() {
  const { t, lang } = useTranslation();
  const isAr = lang === 'ar';
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6 py-24" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-lg text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/40 text-gold text-xs uppercase font-semibold mb-6 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAr ? 'متوقف مؤقتاً' : 'Temporarily Paused'}</span>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight mb-5">
          {isAr ? 'العجلة في استراحة قصيرة' : 'Our lucky wheel is on a short break'}
        </h1>
        <p className="text-white/65 text-base leading-relaxed mb-10">
          {isAr
            ? 'هنرجع قريباً بمفاجآت أحلى. تابعينا على إنستجرام أو احجزي معنا في البوتيك.'
            : 'We\'ll be back soon with even better surprises. In the meantime, follow us on Instagram or visit our boutique.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/boutique" className="inline-flex items-center justify-center gap-2 bg-gold text-black font-semibold text-sm uppercase tracking-[0.18em] px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity">
            {isAr ? 'تسوقي البوتيك' : 'Shop the Boutique'}
          </a>
          <a href="/book" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-semibold text-sm uppercase tracking-[0.18em] px-8 py-3.5 rounded-full hover:bg-white/5 transition-colors">
            {isAr ? 'احجزي موعد' : 'Book an Appointment'}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Lucky() {
  if (LUCKY_WHEEL_PAUSED) return <LuckyPaused />;
  return <LuckyActive />;
}

function LuckyActive() {
  const { t, lang } = useTranslation();
  const [stage, setStage] = useState<Stage>('hero');
  const [stats, setStats] = useState<Stats | null>(null);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [hair, setHair] = useState<HairKey | null>(null);
  const [time, setTime] = useState<TimeKey | null>(null);
  const [vibe, setVibe] = useState<VibeKey | null>(null);
  const [branch, setBranch] = useState<typeof BRANCHES[number]['key'] | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [submitErr, setSubmitErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SpinResp | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);
  const confettiTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const isAr = lang === 'ar';

  const branchLabel = useMemo(() => {
    const b = BRANCHES.find((x) => x.key === branch);
    return b ? (isAr ? b.ar : b.en) : '';
  }, [branch, isAr]);

  const refreshStats = async () => {
    try {
      const r = await fetch('/api/lucky/today-stats');
      if (r.ok) setStats(await r.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 30000);
    return () => clearInterval(id);
  }, []);

  // Cleanup audio + tick + pending timers on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
      if (confettiTimeoutRef.current) window.clearTimeout(confettiTimeoutRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch { /* noop */ }
      }
    };
  }, []);

  const startQuiz = () => {
    setStage('quiz');
    setStep(0);
    trackQuizStart();
  };

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canAdvance = [goal, hair, time, vibe, branch][step] != null;

  // Shared event_id for Pixel + CAPI dedup on the quiz CompleteRegistration
  // event. Created when the quiz completes and held in a ref so we can
  // forward it to the server with the later spin POST. The lead event_id
  // is created inline in the spin handler since it's only used once.
  const quizEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (stage === 'quiz' && step === 4 && branch) {
      const tm = setTimeout(() => {
        const quizEventId = newEventId();
        quizEventIdRef.current = quizEventId;
        trackQuizComplete({ goal: goal ?? undefined, hair: hair ?? undefined, timeline: time ?? undefined, vibe: vibe ?? undefined, branch: branch ?? undefined }, quizEventId);
        setStage('reco');
      }, 250);
      return () => clearTimeout(tm);
    }
    return undefined;
  }, [stage, step, branch, goal, hair, time, vibe]);

  const personalReco = useMemo(() => {
    if (!goal) return { en: '', ar: '' };
    if (goal === 'bridal') return {
      en: 'Full Bridal Package: trial run + signature hair + lash set + brow design + skincare prep + nail set. Book a dedicated bridal consultation 6–8 weeks ahead.',
      ar: 'باكدج العروسة الكامل: ترايل + شعر سيجنتشر + لاش سيت + تصميم حواجب + تجهيز سكين كير + نيلز. احجزي كونسلتيشن العروسة قبل الفرح بـ 6 لـ 8 أسابيع.',
    };
    if (goal === 'hair') {
      if (hair === 'fine' || hair === 'damaged') return {
        en: 'Tape-In or Hand-Tied Extensions (gentle on fine/damaged hair) + Olaplex deep treatment + Signature Blowdry. Free fitting consultation included.',
        ar: 'اكستنشن تيب إن أو هاند تايد (مناسب للشعر الناعم أو التالف) + ديب تريتمنت أولابلكس + بلودراي سيجنتشر. كونسلتيشن المقاس مجاني.',
      };
      if (hair === 'curly') return {
        en: 'Curly-matched Russian Extensions + Curl Treatment + Custom Cut. We hand-pick the texture to match your natural curl pattern.',
        ar: 'اكستنشن روسي مطابق للكيرلي + تريتمنت الكيرلي + قصة مخصوصة. بنختار التكستشر اليدوي اللي يطابق كيرلك الطبيعي.',
      };
      return {
        en: 'Mega Volume Russian Extensions + Color Match + Signature Blowdry — celebrity-level density and length.',
        ar: 'اكستنشن روسي ميجا فوليوم + كولور ماتش + بلودراي سيجنتشر — كثافة وطول بمستوى النجمات.',
      };
    }
    if (goal === 'lash') return {
      en: 'Hybrid or Mega Volume Lash Set + Lash Lift consultation. We custom-map every set to your eye shape.',
      ar: 'لاش هايبرد أو ميجا فوليوم + كونسلتيشن لاش ليفت. بنرسم كل سيت بشكل مخصوص حسب شكل عينيكي.',
    };
    if (goal === 'skin') return {
      en: 'Signature Hydra-Glow Facial + Skincare Routine consultation + Take-home regimen tailored to your skin type.',
      ar: 'فيشيال هيدرا جلو سيجنتشر + كونسلتيشن روتين سكين كير + روتين بيتي تاخديه معاكي مخصوص لنوع بشرتك.',
    };
    if (goal === 'brows') return {
      en: 'Microblading or Brow Lamination + Custom Brow Mapping. Free pre-treatment consultation included.',
      ar: 'مايكروبليدنج أو براو لامينيشن + رسم حواجب مخصوص. كونسلتيشن قبل الجلسة مجاني.',
    };
    if (time === 'thisweek') return {
      en: 'Express Glam Package: hair styling + brow shaping + lash trial. Same-week appointment guaranteed.',
      ar: 'باكدج جلام إكسبريس: تصفيف شعر + تشكيل حواجب + تجربة لاش. ميعاد نفس الأسبوع مضمون.',
    };
    return {
      en: 'Full Beauty Audit with our Beauty Expert + custom multi-service plan + free first consultation.',
      ar: 'أوديت بيوتي كامل مع خبيرة الجمال بتاعتنا + خطة سيرفسات مخصوصة + كونسلتيشن أولى مجانية.',
    };
  }, [goal, hair, time]);

  const validatePhone = (p: string) => /^01[0125]\d{8}$/.test(p.replace(/\s+/g, ''));
  const validateEmail = (e: string) => e.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  // ── Audio: short gold "tick" sound ─────────────────────────────────────────
  const ensureAudioCtx = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        audioCtxRef.current = new Ctx();
      } catch { return null; }
    }
    return audioCtxRef.current;
  };

  const playTick = () => {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch { /* noop */ }
  };

  const startTickLoop = () => {
    if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
    let interval = 80;
    let elapsed = 0;
    const step = () => {
      playTick();
      elapsed += interval;
      // Slow down ticks gradually over the 4.5s spin
      if (elapsed > 1500) interval = 130;
      if (elapsed > 2800) interval = 200;
      if (elapsed > 3800) interval = 320;
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = window.setInterval(step, interval);
    };
    tickIntervalRef.current = window.setInterval(step, interval);
  };

  const stopTickLoop = () => {
    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };

  // ── Confetti for grand prize ───────────────────────────────────────────────
  const fireGrandConfetti = () => {
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#FFE9A3', '#FFFFFF', '#B8941F'],
        particleCount: Math.floor(220 * particleRatio),
        ...opts,
      });
    };
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
    // Side bursts (tracked so we can cancel on unmount)
    if (confettiTimeoutRef.current) window.clearTimeout(confettiTimeoutRef.current);
    confettiTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      confetti({ origin: { x: 0, y: 0.7 }, angle: 60, spread: 70, particleCount: 80, colors: ['#D4AF37', '#FFE9A3'] });
      confetti({ origin: { x: 1, y: 0.7 }, angle: 120, spread: 70, particleCount: 80, colors: ['#D4AF37', '#FFE9A3'] });
    }, 300);
  };

  const submitSpin = async () => {
    setSubmitErr('');
    setPhoneErr('');
    setEmailErr('');
    if (!name.trim() || name.trim().length < 2) return;
    if (!validatePhone(phone)) {
      setPhoneErr(t('spin.invalidPhone'));
      return;
    }
    if (!validateEmail(email)) {
      setEmailErr(t('spin.invalidEmail'));
      return;
    }

    trackSpinClick();
    const leadEventId = newEventId();
    trackLeadSubmit({ hasEmail: email.trim().length > 0, branch: branchLabel || undefined, eventId: leadEventId });

    setSubmitting(true);
    setSpinning(true);

    // Vibrate (mobile haptic)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([40, 30, 40]);
      }
    } catch { /* noop */ }

    // Start tick loop
    startTickLoop();

    try {
      const r = await fetch('/api/lucky/spin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\s+/g, ''),
          email: email.trim() || undefined,
          branch: branchLabel || undefined,
          goal: goal || undefined,
          hair: hair || undefined,
          timeline: time || undefined,
          vibe: vibe || undefined,
          leadEventId,
          quizEventId: quizEventIdRef.current ?? undefined,
        }),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        throw new Error(errBody.error || 'spin failed');
      }
      const data: SpinResp = await r.json();

      const segIdx = data.prize.segmentIndex;
      const targetDeg = 360 * 6 + (360 - (segIdx * 45) - 22.5);
      setWheelRotation(targetDeg);

      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        stopTickLoop();
        setResult(data);
        setSpinning(false);
        setStage('result');
        trackSpinResult({ isGrand: data.prize.isGrand, prize: data.prize.label, value: data.prize.isGrand ? 1500 : 250 });

        // Final reveal vibration + confetti for grand prize
        try {
          if (data.prize.isGrand && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([100, 50, 100, 50, 200]);
          }
        } catch { /* noop */ }
        if (data.prize.isGrand) fireGrandConfetti();

        refreshStats();
      }, 4500);
    } catch (e) {
      stopTickLoop();
      setSpinning(false);
      setSubmitting(false);
      const msg = e instanceof Error ? e.message : '';
      setSubmitErr(msg && msg !== 'spin failed' ? msg : t('spin.errorGeneric'));
    }
  };

  const buildWAUrl = (intent: 'redeem' | 'book' = 'redeem') => {
    if (!result) return '';
    const prize = isAr ? result.prize.labelAr : result.prize.label;
    const grandCondition = result.prize.isGrand
      ? isAr ? '\n(الخصم على خدمات بقيمة فوق 10,000 جنيه)' : '\n(Valid on services above EGP 10,000)'
      : '';
    const text = isAr
      ? `أهلاً ترانسفورم! أنا ${name}، كسبت ${prize} من تجربة Transform وعايزة أحجز ✨\nالكود: ${result.prize.code}${grandCondition}${branchLabel ? `\nالفرع: ${branchLabel}` : ''}${intent === 'book' ? '\nمتاحة لأقرب ميعاد.' : ''}`
      : `Hi, I'm ${name} — I got ${prize} from the Transform experience and I want to book ✨\nMy code: ${result.prize.code}${grandCondition}${branchLabel ? `\nPreferred branch: ${branchLabel}` : ''}${intent === 'book' ? '\nReady for the next available slot.' : ''}`;
    return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Ambient gradient glow layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-gradient-radial from-gold/20 via-gold/5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-gradient-radial from-gold/10 via-transparent to-transparent blur-3xl" />
      </div>

      {/* Floating gold particles (decorative) */}
      <GoldParticles />

      {/* Background glowing wheel silhouette behind hero */}
      {stage === 'hero' && (
        <div aria-hidden className="absolute top-24 left-1/2 -translate-x-1/2 w-[680px] h-[680px] max-w-[110vw] max-h-[110vw] pointer-events-none opacity-25 select-none">
          <BackgroundWheel />
        </div>
      )}

      <div className="relative pt-24 sm:pt-32 pb-32 sm:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">

          <AnimatePresence mode="wait">
            {/* ───── HERO ───── */}
            {stage === 'hero' && (
              <motion.section
                key="hero"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="text-center relative"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/40 text-gold text-xs uppercase font-semibold mb-6 backdrop-blur-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('lucky.eyebrow')}</span>
                </motion.div>

                <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl text-white leading-[1.05] mb-5 max-w-4xl mx-auto tracking-tight">
                  {t('lucky.title')}
                </h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-2xl sm:text-3xl lg:text-4xl font-serif italic mb-8 bg-gradient-to-r from-gold via-[#FFE9A3] to-gold bg-clip-text text-transparent"
                >
                  {t('lucky.subtitle')}
                </motion.p>

                <p className="max-w-xl mx-auto text-sm sm:text-base text-white/60 mb-10 leading-relaxed">
                  {t('lucky.urgency')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto mb-10">
                  <StatCard icon={<Trophy className="w-5 h-5 text-gold" />} value={stats ? `${stats.grandWinnersRemaining} / ${stats.grandWinnersDailyCap}` : '5 / 5'} label={t('lucky.spotsLeft')} highlight />
                  <StatCard icon={<Gift className="w-5 h-5 text-gold" />} value={stats ? String(stats.totalSpinsToday) : '—'} label={t('lucky.totalToday')} />
                  <StatCard icon={<Clock className="w-5 h-5 text-gold" />} value="00:00" label={t('lucky.endsAt')} />
                </div>

                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-block"
                >
                  <Button
                    onClick={startQuiz}
                    className="bg-gradient-to-r from-gold via-[#E9C457] to-gold text-black hover:opacity-95 text-base font-semibold px-12 py-7 h-auto rounded-full shadow-[0_12px_60px_-10px] shadow-gold/70 relative overflow-hidden group"
                  >
                    <span className="relative z-10 flex items-center">
                      {t('lucky.startCta')}
                      <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180" />
                    </span>
                    <motion.span
                      className="absolute inset-0 bg-white/20"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </Button>
                </motion.div>

                <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  {[t('lucky.step1'), t('lucky.step2'), t('lucky.step3'), t('lucky.step4')].map((s, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 text-start backdrop-blur-sm">
                      <div className="w-7 h-7 rounded-full bg-gold/20 text-gold flex items-center justify-center text-sm font-bold mb-2">{i + 1}</div>
                      <p className="text-sm text-white/80 leading-snug">{s}</p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ───── QUIZ ───── */}
            {stage === 'quiz' && (
              <motion.section key="quiz" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="max-w-3xl mx-auto">
                <ProgressBar step={step} total={5} />

                <div className="mt-10 min-h-[420px]">
                  {step === 0 && (
                    <QuestionCard title={t('quizP.q1.title')}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {GOAL_OPTIONS.map((o) => (
                          <Choice key={o.key} active={goal === o.key} onClick={() => { setGoal(o.key); setTimeout(next, 220); }}>
                            <span className="text-3xl mb-2 block">{o.emoji}</span>
                            <span className="text-sm font-medium leading-tight">{t(`quizP.goal.${o.key}`)}</span>
                          </Choice>
                        ))}
                      </div>
                    </QuestionCard>
                  )}
                  {step === 1 && (
                    <QuestionCard title={t('quizP.q2.title')}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {HAIR_OPTIONS.map((k) => (
                          <Choice key={k} active={hair === k} onClick={() => { setHair(k); setTimeout(next, 220); }}>
                            <span className="text-base font-medium">{t(`quizP.hair.${k}`)}</span>
                          </Choice>
                        ))}
                      </div>
                    </QuestionCard>
                  )}
                  {step === 2 && (
                    <QuestionCard title={t('quizP.q3.title')}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {TIME_OPTIONS.map((k) => (
                          <Choice key={k} active={time === k} onClick={() => { setTime(k); setTimeout(next, 220); }}>
                            <span className="text-base font-medium">{t(`quizP.time.${k}`)}</span>
                          </Choice>
                        ))}
                      </div>
                    </QuestionCard>
                  )}
                  {step === 3 && (
                    <QuestionCard title={t('quizP.q4.title')}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {VIBE_OPTIONS.map((k) => (
                          <Choice key={k} active={vibe === k} onClick={() => { setVibe(k); setTimeout(next, 220); }}>
                            <span className="text-base font-medium">{t(`quizP.vibe.${k}`)}</span>
                          </Choice>
                        ))}
                      </div>
                    </QuestionCard>
                  )}
                  {step === 4 && (
                    <QuestionCard title={t('quizP.q5.title')}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {BRANCHES.map((b) => (
                          <Choice key={b.key} active={branch === b.key} onClick={() => setBranch(b.key)}>
                            <span className="text-base font-medium">{isAr ? b.ar : b.en}</span>
                          </Choice>
                        ))}
                      </div>
                    </QuestionCard>
                  )}
                </div>

                <div className="flex items-center justify-between mt-6">
                  <Button variant="outline" onClick={back} disabled={step === 0} className="border-white/20 text-white hover:bg-white/10 hover:text-white disabled:opacity-30">
                    <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                    {t('quizP.back')}
                  </Button>
                  <span className="text-xs text-white/40">{step + 1} / 5</span>
                  <Button onClick={next} disabled={!canAdvance || step === 4} className="bg-gold text-black hover:bg-gold/90 disabled:opacity-30">
                    {t('quizP.next')}
                    <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
                  </Button>
                </div>
              </motion.section>
            )}

            {/* ───── RECOMMENDATION ───── */}
            {stage === 'reco' && (
              <motion.section key="reco" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs uppercase tracking-wider mb-5">
                  <Star className="w-3 h-3" />
                  {t('quizP.recoTitle')}
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl mb-6">
                  {isAr ? `الخطة المخصوصة ليكي يا ${name || 'حبيبتي'}` : 'Your personalized beauty plan'}
                </h2>
                <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-white/5 to-transparent p-6 sm:p-8 text-start">
                  <p className="text-white/90 text-base sm:text-lg leading-relaxed">
                    {isAr ? personalReco.ar : personalReco.en}
                  </p>
                </div>
                <Button onClick={() => setStage('spin')} className="mt-8 bg-gold text-black hover:bg-gold/90 px-10 py-6 h-auto rounded-full text-base font-semibold">
                  {t('quizP.spinNext')}
                  <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180" />
                </Button>
              </motion.section>
            )}

            {/* ───── SPIN (centered, premium) ───── */}
            {stage === 'spin' && (
              <motion.section key="spin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs uppercase tracking-wider mb-4">
                    <Gift className="w-3 h-3" />
                    {t('spin.oneStepAway')}
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl mb-2">{t('spin.unlockTitle')}</h2>
                  <p className="text-white/60 text-sm max-w-md mx-auto">{t('spin.formSubtitle')}</p>
                </div>

                {/* Centered big glowing wheel */}
                <div className="mb-10">
                  <Wheel rotation={wheelRotation} spinning={spinning} segments={isAr ? WHEEL_SEGMENTS_AR : WHEEL_SEGMENTS_EN} wheelRef={wheelRef} />
                </div>

                <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">{t('book.name')}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 focus:border-gold rounded-lg px-4 py-3 text-white outline-none transition-colors"
                      placeholder={isAr ? 'مريم عطا الله' : 'Mariam Atalla'}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">{t('book.phone')}</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setPhoneErr(''); }}
                      className="w-full bg-white/5 border border-white/15 focus:border-gold rounded-lg px-4 py-3 text-white outline-none transition-colors"
                      placeholder="01009780008"
                      inputMode="numeric"
                      autoComplete="tel"
                      aria-invalid={phoneErr ? 'true' : undefined}
                      aria-describedby={phoneErr ? 'lucky-phone-err' : undefined}
                    />
                    {phoneErr && <p id="lucky-phone-err" className="text-rose-400 text-xs mt-1.5">{phoneErr}</p>}
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      {t('spin.email')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailErr(''); }}
                      className="w-full bg-white/5 border border-white/15 focus:border-gold rounded-lg px-4 py-3 text-white outline-none transition-colors"
                      placeholder={t('spin.emailPlaceholder')}
                      autoComplete="email"
                      aria-invalid={emailErr ? 'true' : undefined}
                      aria-describedby={emailErr ? 'lucky-email-err' : undefined}
                    />
                    {emailErr && <p id="lucky-email-err" className="text-rose-400 text-xs mt-1.5">{emailErr}</p>}
                  </div>
                  {submitErr && <p className="text-rose-400 text-sm">{submitErr}</p>}
                  <Button
                    onClick={submitSpin}
                    disabled={submitting || !name.trim() || !phone.trim()}
                    className="w-full bg-gradient-to-r from-gold via-[#E9C457] to-gold text-black hover:opacity-95 py-6 h-auto text-base font-bold tracking-wider rounded-lg disabled:opacity-50 shadow-[0_8px_40px_-8px] shadow-gold/60"
                  >
                    {spinning ? t('spin.spinning') : t('spin.spinNow')}
                  </Button>
                  <p className="text-[11px] text-white/40 text-center leading-relaxed">
                    {isAr ? 'بالضغط على لفّي، أنتي بتوافقي ترانسفورم تتواصل معاكي على الواتساب لاستبدال جايزتك.' : 'By spinning, you agree TransforM may contact you on WhatsApp to redeem your prize.'}
                  </p>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ───── RESULT MODAL ───── */}
          <AnimatePresence>
            {stage === 'result' && result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="lucky-result-title"
                onKeyDown={(e) => { if (e.key === 'Escape') setStage('hero'); }}
                tabIndex={-1}
              >
                <motion.div
                  initial={{ scale: 0.85, y: 30 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="relative max-w-lg w-full rounded-3xl bg-gradient-to-br from-gold/30 via-black to-black border border-gold/50 p-8 text-center shadow-2xl"
                >
                  <button
                    ref={modalCloseBtnRef}
                    onClick={() => setStage('hero')}
                    className="absolute top-4 end-4 text-white/50 hover:text-white focus:text-white focus:outline-none focus:ring-2 focus:ring-gold rounded-full p-1"
                    aria-label="Close result"
                    autoFocus
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {result.alreadyPlayed && (
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-2">{t('spin.alreadyPlayed')}</p>
                  )}
                  {result.prize.isGrand ? (
                    <>
                      <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: 1 }} className="inline-block">
                        <Trophy className="w-20 h-20 text-gold mx-auto mb-3 drop-shadow-[0_0_25px_rgba(212,175,55,0.8)]" />
                      </motion.div>
                      <p className="text-gold font-bold uppercase tracking-[0.2em] text-sm mb-3">{t('spin.grand')}</p>
                    </>
                  ) : (
                    <>
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
                        <Gift className="w-16 h-16 text-gold mx-auto mb-3" />
                      </motion.div>
                      <p className="text-gold font-bold uppercase tracking-[0.2em] text-sm mb-3">{t('spin.youWon')}</p>
                    </>
                  )}

                  <p className="text-white/80 italic text-sm mb-2">{t('spin.madeForYou')}</p>

                  <h3 id="lucky-result-title" className="font-serif text-2xl sm:text-3xl text-white mb-2 leading-tight">
                    {isAr ? result.prize.labelAr : result.prize.label}
                  </h3>
                  {result.prize.isGrand && (
                    <p className="text-xs text-gold/70 uppercase tracking-widest mb-4">
                      {isAr ? 'صالح على خدمات بقيمة فوق 10,000 جنيه · يُقدَّم وقت الحجز' : 'Valid on services above EGP 10,000 · Presented at time of booking'}
                    </p>
                  )}

                  <div className="rounded-xl bg-black/50 border border-gold/30 p-4 mb-5">
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{t('spin.code')}</p>
                    <p className="font-mono text-lg text-gold tracking-wider">{result.prize.code}</p>
                  </div>

                  <div className="text-start mb-6">
                    <p className="text-xs uppercase tracking-wider text-white/50 mb-2">{t('spin.basedOnAnswers')}</p>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {isAr ? result.recommendation.ar : result.recommendation.en}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={buildWAUrl('book')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackBookingClick('whatsapp')}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {t('spin.bookOnWA')}
                    </a>
                    <button
                      onClick={() => setStage('hero')}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 font-medium py-3 rounded-lg transition-colors"
                    >
                      {t('spin.tryAgain')}
                    </button>
                  </div>

                  {/* C3 — Instagram follow CTA, secondary action shown on every result */}
                  <a
                    href="https://instagram.com/transformegypt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center justify-center gap-2 text-sm text-gold/90 hover:text-gold transition-colors font-medium"
                    aria-label={t('lucky.followShort')}
                  >
                    <Instagram className="w-4 h-4" />
                    {t('lucky.followCta')}
                  </a>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* ───── STICKY MOBILE CTA (hero only) ───── */}
      {stage === 'hero' && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.6 }}
          className="fixed bottom-0 inset-x-0 z-50 sm:hidden p-4 bg-gradient-to-t from-black via-black/95 to-transparent"
        >
          <Button
            onClick={startQuiz}
            className="w-full bg-gradient-to-r from-gold via-[#E9C457] to-gold text-black hover:opacity-95 py-6 h-auto text-base font-bold rounded-full shadow-[0_-4px_30px] shadow-gold/40"
          >
            {t('lucky.stickyCta')}
            <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Decorative components ────────────────────────────────────────────────────

function GoldParticles() {
  // Stable random positions generated once
  const particles = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 6,
      duration: 8 + Math.random() * 8,
      drift: -10 + Math.random() * 20,
    }));
  }, []);

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-gold"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            boxShadow: `0 0 ${p.size * 3}px rgba(212,175,55,0.7)`,
          }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{
            opacity: [0, 0.9, 0.9, 0],
            y: [-20, -120],
            x: [0, p.drift],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

function BackgroundWheel() {
  // Slow continuous rotation, decorative only
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      className="w-full h-full rounded-full border-2 border-gold/30 relative"
      style={{ boxShadow: '0 0 200px 30px rgba(212,175,55,0.18) inset, 0 0 100px 10px rgba(212,175,55,0.18)' }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = 45;
          const startAngle = i * angle - 90;
          const endAngle = startAngle + angle;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const x1 = 100 + 100 * Math.cos(startRad);
          const y1 = 100 + 100 * Math.sin(startRad);
          const x2 = 100 + 100 * Math.cos(endRad);
          const y2 = 100 + 100 * Math.sin(endRad);
          return (
            <path
              key={i}
              d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
              fill={i % 2 === 0 ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.02)'}
              stroke="rgba(212,175,55,0.25)"
              strokeWidth="0.4"
            />
          );
        })}
      </svg>
    </motion.div>
  );
}

function StatCard({ icon, value, label, highlight }: { icon: React.ReactNode; value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 backdrop-blur-sm ${highlight ? 'border-gold/40 bg-gold/5' : 'border-white/10 bg-white/5'}`}>
      <div className="flex items-center justify-center gap-2 mb-2">{icon}</div>
      <div className="text-2xl font-serif text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-white/60 mt-1">{label}</div>
    </div>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-gold' : 'bg-white/10'}`} />
      ))}
    </div>
  );
}

function QuestionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
      <h2 className="font-serif text-2xl sm:text-3xl text-white mb-6 text-center">{title}</h2>
      {children}
    </motion.div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`text-center p-4 sm:p-5 rounded-xl border transition-all duration-200 ${active ? 'border-gold bg-gold/10 text-white shadow-lg shadow-gold/20 scale-[1.02]' : 'border-white/15 bg-white/[0.03] text-white/80 hover:border-gold/40 hover:bg-white/5'}`}>
      {children}
    </button>
  );
}

function Wheel({ rotation, spinning, segments, wheelRef }: { rotation: number; spinning: boolean; segments: string[]; wheelRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const colors = ['#D4AF37', '#1a1a1a', '#D4AF37', '#1a1a1a', '#D4AF37', '#1a1a1a', '#D4AF37', '#1a1a1a'];
  return (
    <div className="relative w-full max-w-[480px] aspect-square mx-auto">
      {/* Outer halo glow — pulses when spinning */}
      <motion.div
        animate={spinning ? { opacity: [0.4, 0.85, 0.4], scale: [1, 1.05, 1] } : { opacity: 0.45 }}
        transition={spinning ? { duration: 1, repeat: Infinity } : { duration: 0.5 }}
        className="absolute -inset-8 rounded-full bg-gradient-to-br from-gold/50 via-gold/20 to-transparent blur-3xl"
      />
      {/* Pointer */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
        <div className="w-0 h-0 border-l-[16px] border-r-[16px] border-t-[28px] border-l-transparent border-r-transparent border-t-gold drop-shadow-[0_4px_10px_rgba(212,175,55,0.8)]" />
      </div>

      <div
        ref={wheelRef}
        className="relative w-full h-full rounded-full border-[5px] border-gold shadow-[0_0_80px_-5px_rgba(212,175,55,0.7),inset_0_0_30px_rgba(212,175,55,0.3)] overflow-hidden"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.21, 1)' : 'none',
        }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {segments.map((label, i) => {
            const angle = 45;
            const startAngle = i * angle - 90;
            const endAngle = startAngle + angle;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const x1 = 100 + 100 * Math.cos(startRad);
            const y1 = 100 + 100 * Math.sin(startRad);
            const x2 = 100 + 100 * Math.cos(endRad);
            const y2 = 100 + 100 * Math.sin(endRad);
            const labelAngle = startAngle + angle / 2;
            const labelRad = (labelAngle * Math.PI) / 180;
            const lx = 100 + 60 * Math.cos(labelRad);
            const ly = 100 + 60 * Math.sin(labelRad);
            const isGrand = i === 0 || i === 3;
            return (
              <g key={i}>
                <path d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`} fill={colors[i]} stroke="#D4AF37" strokeWidth="0.5" />
                <text x={lx} y={ly} fill={i % 2 === 0 ? '#000' : '#D4AF37'} fontSize={isGrand ? '6.5' : '6'} fontWeight={isGrand ? '900' : '700'} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${labelAngle + 90}, ${lx}, ${ly})`}>
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Center hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black border-4 border-gold flex items-center justify-center shadow-xl shadow-gold/30">
          <span className="font-serif text-gold text-xl sm:text-2xl">T</span>
        </div>
      </div>
    </div>
  );
}
