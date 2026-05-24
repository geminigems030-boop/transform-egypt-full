import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ChevronDown, MessageCircle, Phone } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useChatContext, persistPhone } from '@/lib/chatContext';
import type { ChatMessage } from '@/lib/chatContext';

// ── Arabic RTL detection ──────────────────────────────────────────────────────
function isArabicText(text: string): boolean {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalLetters = (text.match(/[\p{L}]/gu) || []).length;
  return totalLetters > 0 && arabicChars / totalLetters > 0.3;
}

const WHATSAPP_URL = 'https://wa.me/201009780008';

// ── API call ──────────────────────────────────────────────────────────────────
async function sendChatMessage(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  clientPhone?: string;
  trigger?: 'phone_greeting';
}): Promise<{ reply: string; booked?: boolean; escalated?: boolean }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { reply?: string };
    return {
      reply: body.reply ?? 'Sorry, something went wrong. Please try again or contact us on WhatsApp.',
    };
  }
  return res.json() as Promise<{ reply: string; booked?: boolean; escalated?: boolean }>;
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0">
        <span className="font-serif text-xs text-gold font-bold leading-none">Y</span>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Timestamp formatter ───────────────────────────────────────────────────────
function formatMessageTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const arabic = isArabicText(msg.content);
  const timeLabel = msg.timestamp ? formatMessageTime(msg.timestamp) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-end gap-2 mb-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-xs text-gold font-bold leading-none">Y</span>
        </div>
      )}
      <div className={cn('flex flex-col max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-gold text-black rounded-br-sm font-medium'
              : 'bg-white/5 border border-white/10 text-gray-100 rounded-bl-sm',
          )}
          dir={arabic ? 'rtl' : 'ltr'}
        >
          {msg.content}
          {msg.booked && (
            <p className="mt-2 text-xs text-gold/80">
              ✓ Booking request received — our team will confirm shortly.
            </p>
          )}
          {msg.escalated && (
            <p className="mt-2 text-xs text-gold/80">
              We've notified our team — someone will reach out to you soon.
            </p>
          )}
          {msg.whatsappFallback && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat with us on WhatsApp
            </a>
          )}
        </div>
        {timeLabel && (
          <span className="mt-0.5 px-1 text-[10px] text-gray-600 select-none">
            {timeLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Phone capture step ────────────────────────────────────────────────────────
interface PhoneStepProps {
  lang: 'en' | 'ar';
  onSubmit: (phone: string) => void;
  onSkip: () => void;
}

function PhoneCaptureStep({ lang, onSubmit, onSkip }: PhoneStepProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = () => {
    const cleaned = value.replace(/\s/g, '');
    if (!cleaned) { onSkip(); return; }
    if (!/^[\+\d]{7,15}$/.test(cleaned)) {
      setError(lang === 'ar' ? 'رقم غير صحيح' : 'Invalid number');
      return;
    }
    onSubmit(cleaned);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-2 mb-3 rounded-2xl overflow-hidden border border-gold/20"
      style={{ background: 'rgba(184,153,104,0.05)' }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-3.5 h-3.5 text-gold flex-shrink-0" />
          <p className="text-white text-xs font-medium">
            {lang === 'ar'
              ? 'أدخلي رقمك عشان أعرّفك وأسلّم عليكِ بالاسم 👋'
              : 'Share your number so I can greet you personally 👋'}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="tel"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder={lang === 'ar' ? '01xxxxxxxxx' : '010xxxxxxxx'}
            dir="ltr"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/40 transition-colors"
          />
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-colors"
          >
            {lang === 'ar' ? 'تأكيد' : 'OK'}
          </button>
        </div>
        {error && <p className="text-rose-400 text-[10px] mt-1">{error}</p>}
        <button
          onClick={onSkip}
          className="text-gray-500 text-[10px] mt-2 hover:text-gray-400 transition-colors"
        >
          {lang === 'ar' ? 'تخطي' : 'Skip'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export function YaraChatWidget() {
  const { lang } = useTranslation();

  // All persistent state lives in context so it survives page navigations
  const {
    messages,
    setMessages,
    isOpen,
    setIsOpen,
    hasOpened,
    setHasOpened,
    phoneStep,
    setPhoneStep,
    clientPhone,
    setClientPhone,
    sessionId,
    forgetPhone,
  } = useChatContext();

  // Transient UI state — fine to be local
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUnread, setShowUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, phoneStep]);

  // Focus input when opening (only when past phone step)
  useEffect(() => {
    if (isOpen && phoneStep !== 'pending') {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, phoneStep]);

  // Unread bubble disabled — no auto-popup

  // Welcome message on first open
  const handleOpen = useCallback(async () => {
    setIsOpen(true);
    setShowUnread(false);
    if (!hasOpened) {
      setHasOpened(true);

      // If messages were restored from localStorage, skip the greeting —
      // the user is a returning visitor whose history is already in view.
      if (messages.length > 0) {
        return;
      }

      if (clientPhone && phoneStep === 'captured') {
        // Returning customer — trigger personalised greeting via API
        setIsLoading(true);
        try {
          const data = await sendChatMessage({
            messages: [],
            sessionId,
            clientPhone,
            trigger: 'phone_greeting',
          });
          setMessages([{
            id: `ai_greet_${Date.now()}`,
            role: 'assistant',
            content: data.reply,
            timestamp: Date.now(),
          }]);
        } catch {
          setMessages([{
            id: `welcome_fallback_${Date.now()}`,
            role: 'assistant',
            content: lang === 'ar'
              ? 'أهلاً بعودتك! أنا يارا، كيف أقدر أساعدك اليوم؟ 🌟'
              : "Welcome back! I'm Yara — how can I help you today? ✨",
            timestamp: Date.now(),
          }]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // New visitor — show generic welcome and phone-capture step
        setMessages([{
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: lang === 'ar'
            ? 'أهلاً وسهلاً! أنا يارا، مساعدتك الشخصية في TransforM Egypt 🌟 أقدر أساعدك تعرفي خدماتنا وأسعارنا، أو تحجزي معاد. إيه اللي تحبي تعرفيه؟'
            : "Welcome to TransforM Egypt! I'm Yara, your personal beauty consultant ✨ I can help you explore our services, pricing, and book an appointment. What can I help you with today?",
          timestamp: Date.now(),
        }]);
      }
    }
  }, [hasOpened, messages.length, clientPhone, phoneStep, lang, sessionId, setIsOpen, setHasOpened, setMessages, setIsLoading]);

  const handlePhoneSubmit = useCallback(async (phone: string) => {
    persistPhone(phone);
    setClientPhone(phone);
    setPhoneStep('captured');
    setIsLoading(true);
    try {
      const data = await sendChatMessage({
        messages: [],
        sessionId,
        clientPhone: phone,
        trigger: 'phone_greeting',
      });
      const greetMsg: ChatMessage = {
        id: `ai_greet_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, greetMsg]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `ai_greet_fallback_${Date.now()}`,
        role: 'assistant',
        content: lang === 'ar'
          ? 'ما قدرتش أتحقق من بياناتك دلوقتي، بس أنا هنا لمساعدتك 😊 إيه اللي تحبي تعرفيه؟'
          : "I couldn't look up your details right now, but I'm still here to help! What can I do for you?",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [lang, sessionId, setClientPhone, setPhoneStep, setMessages]);

  const handlePhoneSkip = useCallback(() => {
    setPhoneStep('skipped');
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [setPhoneStep]);

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const apiMessages = updatedMessages
        .filter((m) => !m.id.startsWith('welcome_'))
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const data = await sendChatMessage({
        messages: apiMessages,
        sessionId,
        clientPhone: clientPhone || undefined,
      });

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
        booked: data.booked,
        escalated: data.escalated,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: lang === 'ar'
          ? 'عذراً، فيه مشكلة دلوقتي. تواصلي معنا على واتساب.'
          : "Sorry, I'm having trouble right now. Please reach us on WhatsApp.",
        timestamp: Date.now(),
        whatsappFallback: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, lang, messages, clientPhone, sessionId, setMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const inputDir = isArabicText(inputValue) ? 'rtl' : 'ltr';
  const placeholder = lang === 'ar' ? 'اكتبي رسالتك…' : 'Ask me anything…';
  const showPhoneStep = isOpen && hasOpened && phoneStep === 'pending' && messages.length > 0;
  const inputDisabled = isLoading || showPhoneStep;

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] flex flex-col rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            style={{
              background: 'rgba(8,8,8,0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(184,153,104,0.25)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'rgba(184,153,104,0.2)', background: 'rgba(184,153,104,0.07)' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                    <span className="font-serif text-base text-gold font-semibold leading-none">Y</span>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold tracking-wide">TransforM Team</p>
                  <p className="text-gold/70 text-xs">Beauty Consultants</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close chat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-0"
              style={{ maxHeight: '380px', minHeight: '200px' }}
            >
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Phone capture step — shown inline below messages */}
            {showPhoneStep && (
              <PhoneCaptureStep
                lang={lang}
                onSubmit={handlePhoneSubmit}
                onSkip={handlePhoneSkip}
              />
            )}

            {/* Input */}
            <div
              className="px-3 py-3 border-t flex gap-2 items-end"
              style={{ borderColor: 'rgba(184,153,104,0.15)' }}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={showPhoneStep
                  ? (lang === 'ar' ? 'أدخلي رقمك أولاً…' : 'Enter your number above first…')
                  : placeholder}
                dir={inputDir}
                rows={1}
                disabled={inputDisabled}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/40 transition-colors resize-none disabled:opacity-40"
                style={{ maxHeight: '100px', overflowY: 'auto' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
                }}
              />
              <button
                onClick={() => void sendMessage()}
                disabled={inputDisabled || !inputValue.trim()}
                className="w-9 h-9 rounded-xl bg-gold text-black flex items-center justify-center hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 pb-2 text-center flex items-center justify-center gap-2">
              <p className="text-gray-600 text-[10px]">
                {lang === 'ar'
                  ? 'خبيرتك في الجمال · TransforM Egypt'
                  : 'Your beauty expert · TransforM Egypt'}
              </p>
              {clientPhone && phoneStep === 'captured' && (
                <>
                  <span className="text-gray-700 text-[10px]">·</span>
                  <button
                    onClick={forgetPhone}
                    className="text-gray-600 text-[10px] hover:text-gray-400 transition-colors underline underline-offset-2"
                  >
                    {lang === 'ar' ? 'نسيني' : 'Forget me'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Bubble Button */}
      <div className="fixed bottom-4 right-5 z-50 flex flex-col items-center gap-1">
        {/* Unread indicator */}
        <AnimatePresence>
          {showUnread && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute bottom-full right-0 mb-3 w-52 rounded-xl px-3 py-2 text-xs text-white shadow-lg"
              style={{
                background: 'rgba(8,8,8,0.95)',
                border: '1px solid rgba(184,153,104,0.3)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <p className="font-medium text-gold mb-0.5">
                {lang === 'ar' ? '👋 أنا يارا!' : "👋 Hi, I'm Yara!"}
              </p>
              <p className="text-gray-300">
                {lang === 'ar'
                  ? 'محتاجة مساعدة في الحجز؟'
                  : 'Need help booking or have questions?'}
              </p>
              <div
                className="absolute -bottom-1.5 right-4 w-3 h-3 rotate-45"
                style={{
                  background: 'rgba(8,8,8,0.95)',
                  borderRight: '1px solid rgba(184,153,104,0.3)',
                  borderBottom: '1px solid rgba(184,153,104,0.3)',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={isOpen ? () => setIsOpen(false) : handleOpen}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center gap-1"
          aria-label={isOpen ? 'Close chat' : 'Open chat with Yara'}
        >
          <div
            className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(184,153,104,0.35)] transition-shadow hover:shadow-[0_8px_40px_rgba(184,153,104,0.5)]"
            style={{
              background: isOpen ? 'rgba(184,153,104,0.9)' : 'rgba(10,10,10,0.9)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(184,153,104,0.5)',
            }}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="w-6 h-6 text-black" />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <MessageCircle className="w-6 h-6 text-gold" />
                </motion.span>
              )}
            </AnimatePresence>

            {/* Unread dot */}
            {showUnread && !isOpen && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gold border-2 border-black flex items-center justify-center">
                <span className="text-black text-[8px] font-bold">1</span>
              </span>
            )}
          </div>
          {!isOpen && (
            <span className="text-[10px] font-semibold tracking-widest uppercase text-gold/90" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {lang === 'ar' ? 'دردشة' : 'Live Chat'}
            </span>
          )}
        </motion.button>
      </div>
    </>
  );
}
