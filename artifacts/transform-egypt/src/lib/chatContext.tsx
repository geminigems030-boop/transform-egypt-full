import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  booked?: boolean;
  escalated?: boolean;
  whatsappFallback?: boolean;
}

interface ChatContextValue {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  hasOpened: boolean;
  setHasOpened: (v: boolean) => void;
  phoneStep: 'pending' | 'captured' | 'skipped';
  setPhoneStep: (v: 'pending' | 'captured' | 'skipped') => void;
  clientPhone: string;
  setClientPhone: (v: string) => void;
  sessionId: string;
  forgetPhone: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Phone persistence (localStorage + 30-day TTL) ────────────────────────────
const PHONE_KEY = 'yara_client_phone';
const PHONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredPhoneRecord {
  phone: string;
  expires: number;
}

export function persistPhone(phone: string): void {
  const record: StoredPhoneRecord = { phone, expires: Date.now() + PHONE_TTL_MS };
  localStorage.setItem(PHONE_KEY, JSON.stringify(record));
}

export function clearPersistedPhone(): void {
  localStorage.removeItem(PHONE_KEY);
}

function loadPersistedPhone(): string {
  try {
    const raw = localStorage.getItem(PHONE_KEY);
    if (!raw) return '';
    const record = JSON.parse(raw) as unknown;
    if (
      typeof record !== 'object' ||
      record === null ||
      typeof (record as StoredPhoneRecord).phone !== 'string' ||
      !Number.isFinite((record as StoredPhoneRecord).expires)
    ) {
      localStorage.removeItem(PHONE_KEY);
      return '';
    }
    const { phone, expires } = record as StoredPhoneRecord;
    if (Date.now() > expires) {
      localStorage.removeItem(PHONE_KEY);
      return '';
    }
    return phone;
  } catch {
    localStorage.removeItem(PHONE_KEY);
    return '';
  }
}

// ── Phone-step persistence (sessionStorage — tab-scoped) ─────────────────────
const PHONE_STEP_KEY = 'yara_phone_step';

function loadPersistedPhoneStep(): 'pending' | 'captured' | 'skipped' {
  try {
    const v = sessionStorage.getItem(PHONE_STEP_KEY);
    if (v === 'skipped' || v === 'captured') return v;
    return 'pending';
  } catch {
    return 'pending';
  }
}

function persistPhoneStep(step: 'pending' | 'captured' | 'skipped'): void {
  try {
    if (step === 'pending') {
      sessionStorage.removeItem(PHONE_STEP_KEY);
    } else {
      sessionStorage.setItem(PHONE_STEP_KEY, step);
    }
  } catch {
    // ignore
  }
}

// ── Session ID (persisted in localStorage so it survives tab close) ──────────
const SESSION_ID_KEY = 'yara_session_id';

function getSessionId(): string {
  // Prefer sessionStorage for same-tab fast-path
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (id) return id;

  // Restore persisted session from localStorage (returning visitor)
  id = localStorage.getItem(SESSION_ID_KEY);
  if (id) {
    sessionStorage.setItem(SESSION_ID_KEY, id);
    return id;
  }

  // Brand-new session
  id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(SESSION_ID_KEY, id);
  localStorage.setItem(SESSION_ID_KEY, id);
  return id;
}

// ── Message persistence (localStorage, capped at 50 messages) ────────────────
const MESSAGES_KEY = 'yara_chat_history';
const MAX_STORED_MESSAGES = 50;

interface StoredHistory {
  sessionId: string;
  messages: ChatMessage[];
}

function loadPersistedMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    const record = JSON.parse(raw) as unknown;
    if (
      typeof record !== 'object' ||
      record === null ||
      typeof (record as StoredHistory).sessionId !== 'string' ||
      !Array.isArray((record as StoredHistory).messages)
    ) {
      localStorage.removeItem(MESSAGES_KEY);
      return [];
    }
    const stored = record as StoredHistory;
    if (stored.sessionId !== sessionId) {
      // Different session — clear stale history
      localStorage.removeItem(MESSAGES_KEY);
      return [];
    }
    return stored.messages;
  } catch {
    localStorage.removeItem(MESSAGES_KEY);
    return [];
  }
}

function persistMessages(sessionId: string, messages: ChatMessage[]): void {
  try {
    const capped = messages.slice(-MAX_STORED_MESSAGES);
    const record: StoredHistory = { sessionId, messages: capped };
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(record));
  } catch {
    // ignore quota errors silently
  }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const sessionId = useRef(getSessionId()).current;
  const storedPhone = loadPersistedPhone();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadPersistedMessages(sessionId)
  );
  const [isOpen, setIsOpenRaw] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [phoneStep, setPhoneStepRaw] = useState<'pending' | 'captured' | 'skipped'>(() => {
    const sessionStep = loadPersistedPhoneStep();
    if (sessionStep !== 'pending') return sessionStep;
    return storedPhone ? 'captured' : 'pending';
  });
  const [clientPhone, setClientPhone] = useState(storedPhone);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    persistMessages(sessionId, messages);
  }, [messages, sessionId]);

  const setIsOpen = useCallback((open: boolean) => setIsOpenRaw(open), []);

  const setPhoneStep = useCallback((step: 'pending' | 'captured' | 'skipped') => {
    persistPhoneStep(step);
    setPhoneStepRaw(step);
  }, []);

  const forgetPhone = useCallback(() => {
    clearPersistedPhone();
    persistPhoneStep('pending');
    setClientPhone('');
    setPhoneStepRaw('pending');
  }, []);

  return (
    <ChatContext.Provider
      value={{
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
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used inside ChatProvider');
  return ctx;
}
