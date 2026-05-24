import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2, X } from 'lucide-react';
import { Conversation } from '@11labs/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type CallPhase =
  | 'idle'        // FAB shown, nothing happening
  | 'form'        // pre-call intake form overlay
  | 'ringing'     // "connecting…" with dial tone UX
  | 'connecting'  // fetching token + establishing WebRTC
  | 'active'      // call is live
  | 'ended';      // call ended, brief goodbye screen

interface IntakeForm {
  name: string;
  phone: string;
  email: string;
  birthMonth: string;
  birthYear: string;
  serviceInterest: string;
}

const SERVICES = [
  { value: '', label: 'Service interested in (optional)' },
  { value: 'Hair Extensions', label: 'Hair Extensions' },
  { value: 'Lash Extensions', label: 'Lash Extensions' },
  { value: 'Microblading', label: 'Microblading & Brows' },
  { value: 'Hair Treatments', label: 'Hair Treatments & Keratin' },
  { value: 'Nails', label: 'Nails & Manicure' },
  { value: 'Skincare', label: 'Skincare Facials' },
  { value: 'Other', label: 'Other / Not sure yet' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Yara Call Widget ─────────────────────────────────────────────────────────

export default function YaraCallWidget() {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  // Form state
  const [form, setForm] = useState<IntakeForm>({
    name: '', phone: '', email: '', birthMonth: '', birthYear: '', serviceInterest: '',
  });
  const [phonePreFilled, setPhonePreFilled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingForm, setSubmittingForm] = useState(false);

  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const formDataRef = useRef<IntakeForm | null>(null);

  // Check if voice is configured on mount
  useEffect(() => {
    fetch('/api/yara-call/status')
      .then(r => r.json())
      .then((d: { configured: boolean }) => setIsConfigured(d.configured))
      .catch(() => setIsConfigured(false));
  }, []);

  // Pre-fill phone from localStorage (shared with chat widget)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('yara_client_phone');
      if (!raw) return;
      const record = JSON.parse(raw) as { phone?: string; expires?: number };
      if (record.phone && record.expires && Date.now() < record.expires) {
        setForm(f => ({ ...f, phone: record.phone! }));
        setPhonePreFilled(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringingTimerRef.current) clearTimeout(ringingTimerRef.current);
      conversationRef.current?.endSession().catch(() => {});
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const endCall = useCallback((showEnded = true) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (ringingTimerRef.current) { clearTimeout(ringingTimerRef.current); ringingTimerRef.current = null; }

    conversationRef.current?.endSession().catch(() => {});
    conversationRef.current = null;

    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;

    if (showEnded) {
      setPhase('ended');
      setAgentSpeaking(false);
      setTimeout(() => setPhase('idle'), 3000);
    } else {
      setPhase('idle');
    }
  }, []);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Please enter your name'); return; }
    if (!form.phone.trim()) { setFormError('Please enter your phone number'); return; }
    setFormError(null);
    setSubmittingForm(true);

    // Request mic FIRST — must happen within the user gesture context on iOS.
    // Any await before this would lose the gesture context and block getUserMedia.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
    } catch (permErr) {
      const msg = (permErr as Error).message ?? '';
      setFormError(
        msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')
          ? 'Microphone access denied — please allow microphone in your browser settings.'
          : 'Could not access microphone. Please check your settings.',
      );
      setSubmittingForm(false);
      return;
    }

    // Save form data for context injection into the ElevenLabs session
    formDataRef.current = { ...form };

    // ── Blocking lead capture ─────────────────────────────────────────────────
    // The lead MUST be saved before the call starts so the client is never lost,
    // even if the call drops immediately after connecting.
    const birthday = form.birthMonth && form.birthYear
      ? `${form.birthMonth} ${form.birthYear}` : undefined;

    try {
      const leadRes = await fetch('/api/yara-call/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          birthday,
          service_interest: form.serviceInterest || undefined,
        }),
      });

      if (!leadRes.ok) {
        const errBody = await leadRes.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `Lead save failed (${leadRes.status})`);
      }
    } catch (leadErr) {
      // Lead save failed — release mic and surface error. The user can retry.
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      setFormError(
        (leadErr as Error).message.includes('fetch')
          ? 'No internet connection. Please check your connection and try again.'
          : ((leadErr as Error).message || 'Could not save your details. Please try again.'),
      );
      setSubmittingForm(false);
      return;
    }

    setSubmittingForm(false);
    setError(null);

    // ── Ringing phase (2.5s realistic dial UX) ──────────────────────────────
    setPhase('ringing');

    ringingTimerRef.current = setTimeout(async () => {
      setPhase('connecting');

      try {
        const tokenRes = await fetch('/api/yara-call/token', { method: 'POST' });
        if (!tokenRes.ok) {
          const err = await tokenRes.json() as { error?: string };
          throw new Error(err.error ?? 'Failed to connect');
        }
        const { signedUrl } = await tokenRes.json() as { signedUrl: string };

        // Release the warm-up stream so ElevenLabs has exclusive mic access.
        // On iOS only one audio track can be active at a time.
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;

        // Build dynamic variables from the intake form data.
        // These fill {{client_name}}, {{service_interest}}, {{is_returning_customer}}
        // in Yara's system prompt stored on ElevenLabs.
        const fd = formDataRef.current;
        const isReturning = (() => {
          try {
            const raw = localStorage.getItem('yara_client_phone');
            if (!raw) return false;
            const r = JSON.parse(raw) as { expires?: number };
            return !!(r.expires && Date.now() < r.expires);
          } catch { return false; }
        })();

        const conversation = await Conversation.startSession({
          signedUrl,
          dynamicVariables: {
            client_name: fd?.name?.trim() || 'there',
            service_interest: fd?.serviceInterest || 'beauty services',
            is_returning_customer: isReturning,
          },
          onConnect: () => {
            setPhase('active');
            setElapsedSeconds(0);
            timerRef.current = setInterval(() => {
              setElapsedSeconds(s => s + 1);
            }, 1000);
          },
          onDisconnect: () => {
            endCall(true);
          },
          onError: (err) => {
            console.error('ElevenLabs error:', err);
            setError('Connection lost. Please try again.');
            endCall(false);
          },
          onModeChange: ({ mode }) => {
            setAgentSpeaking(mode === 'speaking');
          },
        });

        conversationRef.current = conversation;
      } catch (err) {
        const msg = (err as Error).message ?? 'Could not connect';
        setError(
          msg.includes('Permission') || msg.includes('NotAllowed')
            ? 'Microphone access denied. Please allow microphone and try again.'
            : msg,
        );
        setPhase('form');
      }
    }, 2500);
  }, [form, endCall]);

  const toggleMute = useCallback(() => {
    if (!conversationRef.current) return;
    const next = !isMuted;
    conversationRef.current.setVolume({ volume: next ? 0 : 1 });
    setIsMuted(next);
  }, [isMuted]);

  const setField = useCallback(
    (field: keyof IntakeForm) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value })),
    [],
  );

  if (!isConfigured) return null;

  const inputCls = "w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-gold/60 placeholder:text-white/30 transition-colors";
  const selectCls = `${inputCls} appearance-none`;

  return (
    <>
      {/* ── Floating call button (bottom-right, above Book Now FAB) ── */}
      {phase === 'idle' && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          onClick={() => setPhase('form')}
          className="fixed bottom-[7rem] right-5 z-50 flex flex-col items-center gap-1 group"
          aria-label="Free call with Yara"
          title="Free Call"
        >
          <div
            className="relative w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-300 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{
              background: 'rgba(10,10,10,0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(184,153,104,0.45)',
            }}
          >
            <Phone className="w-6 h-6 text-gold" />
            <span className="absolute inset-0 rounded-full border border-gold/30 animate-ping" />
          </div>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-gold/90" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            Free Call
          </span>
        </motion.button>
      )}

      <AnimatePresence>

        {/* ── Pre-call intake form overlay ── */}
        {phase === 'form' && (
          <motion.div
            key="form-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-sm px-6 pb-10 pt-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-serif text-xl text-white tracking-wide">Talk to Yara</h2>
                  <p className="text-white/40 text-xs mt-0.5">Your TransforM beauty consultant</p>
                </div>
                <button
                  onClick={() => setPhase('idle')}
                  className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Avatar */}
              <div className="flex justify-center mb-5">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center border"
                  style={{
                    background: 'linear-gradient(135deg, rgba(184,153,104,0.15), rgba(184,153,104,0.05))',
                    borderColor: 'rgba(184,153,104,0.4)',
                  }}
                >
                  <span className="font-serif text-3xl text-gold select-none">Y</span>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
                {/* Name */}
                <input
                  type="text"
                  placeholder="Your name *"
                  value={form.name}
                  onChange={setField('name')}
                  required
                  autoFocus
                  className={inputCls}
                />

                {/* Phone — read-only when pre-filled from chat/session context */}
                {phonePreFilled ? (
                  <div
                    className="w-full flex items-center justify-between bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm"
                    title="Phone pre-filled from your previous session"
                  >
                    <span className="text-white/60">{form.phone}</span>
                    <button
                      type="button"
                      onClick={() => setPhonePreFilled(false)}
                      className="text-white/30 hover:text-white/60 text-xs underline transition-colors ml-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <input
                    type="tel"
                    placeholder="Phone number *"
                    value={form.phone}
                    onChange={setField('phone')}
                    required
                    className={inputCls}
                  />
                )}

                {/* Email */}
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={form.email}
                  onChange={setField('email')}
                  className={inputCls}
                />

                {/* Birthday */}
                <div className="flex gap-2">
                  <select
                    value={form.birthMonth}
                    onChange={setField('birthMonth')}
                    className={`${selectCls} flex-1`}
                  >
                    <option value="">Birth month</option>
                    {MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Year"
                    value={form.birthYear}
                    onChange={setField('birthYear')}
                    min="1940"
                    max={new Date().getFullYear() - 5}
                    className={`${inputCls} w-24 text-center`}
                  />
                </div>

                {/* Service interest */}
                <select
                  value={form.serviceInterest}
                  onChange={setField('serviceInterest')}
                  className={selectCls}
                >
                  {SERVICES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                {formError && (
                  <p className="text-rose-400 text-xs text-center">{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={submittingForm}
                  className="mt-1 w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, rgba(184,153,104,0.95), rgba(160,130,85,0.9))',
                    color: '#0a0a0a',
                  }}
                >
                  <Phone className="w-4 h-4" />
                  {submittingForm ? 'Starting call…' : 'Start Free Call'}
                </button>

                <p className="text-white/20 text-[11px] text-center">
                  AI-powered · Free · TransforM Egypt
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* ── Full-screen call overlay ── */}
        {phase !== 'idle' && phase !== 'form' && (
          <motion.div
            key="call-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div className="flex flex-col items-center gap-6 px-8 w-full max-w-sm">

              {/* Avatar ring */}
              <div className="relative">
                {agentSpeaking && (
                  <>
                    <span className="absolute inset-0 rounded-full border-2 border-gold/40 animate-ping scale-110" />
                    <span className="absolute inset-0 rounded-full border border-gold/20 animate-ping scale-125" style={{ animationDelay: '0.3s' }} />
                  </>
                )}
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center border-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(184,153,104,0.15), rgba(184,153,104,0.05))',
                    borderColor: 'rgba(184,153,104,0.6)',
                  }}
                >
                  <span className="font-serif text-5xl text-gold select-none">Y</span>
                </div>
              </div>

              {/* Name + status */}
              <div className="text-center">
                <p className="text-white font-serif text-2xl tracking-wide mb-1">Yara</p>
                <p className="text-gold/80 text-sm tracking-widest uppercase font-light">
                  TransforM Egypt · Beauty Consultant
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {phase === 'ringing' && (
                    <>
                      <DialingDots />
                      <span className="text-white/60 text-sm">Connecting you to a representative…</span>
                    </>
                  )}
                  {phase === 'connecting' && (
                    <span className="text-white/60 text-sm animate-pulse">Setting up secure call…</span>
                  )}
                  {phase === 'active' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 text-sm font-mono">{formatTime(elapsedSeconds)}</span>
                      <span className="text-white/40 text-xs ml-1">
                        {agentSpeaking ? '· Yara is speaking' : '· Listening…'}
                      </span>
                    </>
                  )}
                  {phase === 'ended' && (
                    <span className="text-white/60 text-sm">Call ended · Thank you</span>
                  )}
                </div>
              </div>

              {/* Audio visualizer (active only) */}
              {phase === 'active' && (
                <div className="flex items-end gap-1 h-8">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 rounded-full bg-gold/70"
                      animate={agentSpeaking ? {
                        height: ['4px', `${12 + Math.sin(i * 0.8) * 10}px`, '4px'],
                      } : { height: '4px' }}
                      transition={{
                        duration: 0.5,
                        repeat: agentSpeaking ? Infinity : 0,
                        delay: i * 0.06,
                        ease: 'easeInOut',
                      }}
                      style={{ height: '4px' }}
                    />
                  ))}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-rose-400 text-sm text-center px-4">{error}</p>
              )}

              {/* Call controls */}
              <div className="flex items-center gap-6 mt-2">
                {phase === 'active' && (
                  <button
                    onClick={toggleMute}
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-all border"
                    style={{
                      background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                      borderColor: isMuted ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)',
                    }}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted
                      ? <MicOff className="w-5 h-5 text-rose-400" />
                      : <Mic className="w-5 h-5 text-white/70" />}
                  </button>
                )}

                {(phase === 'ringing' || phase === 'connecting' || phase === 'active') && (
                  <button
                    onClick={() => endCall(phase === 'active')}
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
                    aria-label="End call"
                  >
                    <PhoneOff className="w-7 h-7 text-white" />
                  </button>
                )}

                {phase === 'ended' && (
                  <button
                    onClick={() => setPhase('idle')}
                    className="w-14 h-14 rounded-full flex items-center justify-center border border-white/20 text-white/60 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {phase === 'active' && (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center border"
                    style={{ borderColor: 'rgba(184,153,104,0.3)', background: 'rgba(184,153,104,0.05)' }}
                    aria-label="Speaker"
                  >
                    <Volume2 className="w-5 h-5 text-gold/60" />
                  </div>
                )}
              </div>

              <p className="text-white/20 text-xs tracking-widest uppercase mt-2">
                Powered by TransforM Egypt AI
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Animated dialing dots ────────────────────────────────────────────────────

function DialingDots() {
  return (
    <span className="flex gap-1 items-center">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gold/60"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}
