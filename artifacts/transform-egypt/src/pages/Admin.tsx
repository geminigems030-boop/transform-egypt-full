import { useEffect, useRef, useState } from 'react';
import {
  Lock, Search, Download, RefreshCw, LogOut, Trophy, Users, Calendar, Mail, Phone,
  Inbox, Plus, X, MapPin, MessageSquare, Send, ExternalLink, Copy, Check, Sparkles, AlertTriangle, RotateCw,
  Brain, Loader2, Database, Zap, BarChart3, Megaphone, PhoneCall, Bot, ChevronDown, ChevronUp, Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CampaignsPanel from '@/components/CampaignsPanel';
import AdsPanel from '@/components/AdsPanel';
import CallsPanel from '@/components/CallsPanel';
import AppointmentsPanel from '@/components/AppointmentsPanel';
import ClientsPanel from '@/components/ClientsPanel';
import AutomationPanel from '@/components/AutomationPanel';
import SocialPanel from '@/components/SocialPanel';
import OffersPanel from '@/components/OffersPanel';

const TOKEN_STORAGE_KEY = 'tm_admin_token_v1';

type TabKey = 'spins' | 'submissions' | 'inbox' | 'campaigns' | 'ads' | 'calls' | 'appointments' | 'clients' | 'automation' | 'social' | 'offers' | 'chat';

interface Lead {
  id: number;
  spinDate: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string | null;
  branch: string | null;
  quizGoal: string | null;
  quizHair: string | null;
  quizTimeline: string | null;
  quizVibe: string | null;
  prizeLabel: string;
  prizeCode: string;
  isGrand: boolean;
}

interface Stats {
  totalLeads: number;
  totalGrandAwarded: number;
  todaySpins: number;
  todayGrandAwarded: number;
  grandCap: number;
}

interface Submission {
  id: number;
  source: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  branch: string | null;
  service: string | null;
  message: string | null;
  language: string | null;
  status: string;
  loggedBy: string | null;
  createdAt: string;
}

interface SourceCount {
  source: string;
  count: number;
}

const SOURCE_LABELS: Record<string, string> = {
  book: 'Booking',
  consultation: 'Consultation',
  giftcard: 'Gift Card',
  contact: 'Contact',
  boutique: 'Boutique',
  newsletter: 'Newsletter',
  manual: 'Manual',
  instagram_dm: 'Instagram DM',
  facebook_dm: 'Facebook DM',
  instagram_dm_escalation: 'Instagram DM (Escalated)',
  facebook_dm_escalation: 'Facebook DM (Escalated)',
  instagram_dm_manual: 'Instagram DM (Manual)',
  facebook_dm_manual: 'Facebook DM (Manual)',
  leadgen: 'Lead Ad',
  yara_call: 'Yara Voice Call',
};

const STATUS_OPTIONS = ['new', 'contacted', 'booked', 'closed', 'junk'];

export default function Admin() {
  // ── Auth ────────────────────────────────────────────────────────────────
  const [token, setToken] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
  });
  const [tokenInput, setTokenInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  // ── Tab + shared state ──────────────────────────────────────────────────
  const [tab, setTab] = useState<TabKey>('spins');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Spins state ─────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [phoneFilter, setPhoneFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ── Submissions state ───────────────────────────────────────────────────
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsCounts, setSubmissionsCounts] = useState<SourceCount[]>([]);
  const [subSearch, setSubSearch] = useState('');
  const [subSource, setSubSource] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [subFrom, setSubFrom] = useState('');
  const [subTo, setSubTo] = useState('');

  // ── Manual entry modal ──────────────────────────────────────────────────
  const [manualOpen, setManualOpen] = useState(false);

  // ── Re-engagement ────────────────────────────────────────────────────────
  const [reengageLoading, setReengageLoading] = useState(false);
  const [reengageResult, setReengageResult] = useState<{ sent: number; total: number } | null>(null);

  // ── Appointment reminders ─────────────────────────────────────────────────
  const [apptReminderLoading, setApptReminderLoading] = useState(false);
  const [apptReminderResult, setApptReminderResult] = useState<{ sent: number; total: number } | null>(null);

  // ── Post-booking follow-up ────────────────────────────────────────────────
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupResult, setFollowupResult] = useState<{ sent: number; total: number } | null>(null);

  // Separate abort controllers per dataset so a parallel hydration on login
  // doesn't make one fetch cancel the other.
  const spinsAbortRef = useRef<AbortController | null>(null);
  const subsAbortRef = useRef<AbortController | null>(null);

  const fetchSpins = async (
    tk: string,
    filters?: { phone?: string; from?: string; to?: string },
  ) => {
    if (spinsAbortRef.current) spinsAbortRef.current.abort();
    const ctrl = new AbortController();
    spinsAbortRef.current = ctrl;

    setLoading(true);
    setError('');
    try {
      const headers = { 'X-Admin-Token': tk };
      const params = new URLSearchParams();
      const f = filters ?? { phone: phoneFilter, from: fromDate, to: toDate };
      if (f.phone && f.phone.trim()) params.set('phone', f.phone.trim());
      if (f.from) params.set('from', f.from);
      if (f.to) params.set('to', f.to);
      const q = params.toString();

      const [leadsRes, statsRes] = await Promise.all([
        fetch(`/api/lucky/admin/leads${q ? `?${q}` : ''}`, { headers, signal: ctrl.signal }),
        fetch('/api/lucky/admin/stats', { headers, signal: ctrl.signal }),
      ]);

      if (ctrl.signal.aborted) return false;

      if (leadsRes.status === 401 || statsRes.status === 401) {
        setAuthError('Invalid admin token.');
        setAuthed(false);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return false;
      }
      if (leadsRes.status === 503) {
        const body = await leadsRes.json().catch(() => ({}));
        setError(body.error || 'Admin disabled. ADMIN_TOKEN env not set on server.');
        return false;
      }
      if (!leadsRes.ok || !statsRes.ok) {
        setError('Failed to load admin data.');
        return false;
      }

      const leadsBody = await leadsRes.json();
      const statsBody = await statsRes.json();
      if (ctrl.signal.aborted) return false;
      setLeads(leadsBody.leads ?? []);
      setStats(statsBody);
      return true;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return false;
      setError(e instanceof Error ? e.message : 'Network error');
      return false;
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  const fetchSubmissions = async (
    tk: string,
    filters?: { search?: string; source?: string; status?: string; from?: string; to?: string },
  ) => {
    if (subsAbortRef.current) subsAbortRef.current.abort();
    const ctrl = new AbortController();
    subsAbortRef.current = ctrl;

    setLoading(true);
    setError('');
    try {
      const headers = { 'X-Admin-Token': tk };
      const params = new URLSearchParams();
      const f = filters ?? { search: subSearch, source: subSource, status: subStatus, from: subFrom, to: subTo };
      if (f.search?.trim()) params.set('search', f.search.trim());
      if (f.source) params.set('source', f.source);
      if (f.status) params.set('status', f.status);
      if (f.from) params.set('from', f.from);
      if (f.to) params.set('to', f.to);

      const res = await fetch(`/api/admin/submissions${params.toString() ? `?${params.toString()}` : ''}`, {
        headers,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return false;
      if (res.status === 401) {
        setAuthError('Invalid admin token.');
        setAuthed(false);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return false;
      }
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Admin disabled.');
        return false;
      }
      if (!res.ok) {
        setError('Failed to load submissions.');
        return false;
      }
      const body = await res.json();
      setSubmissions(body.submissions ?? []);
      setSubmissionsCounts(body.counts ?? []);
      return true;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return false;
      setError(e instanceof Error ? e.message : 'Network error');
      return false;
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  const fetchActive = async (tk: string): Promise<void> => {
    if (tab === 'spins') { await fetchSpins(tk); return; }
    if (tab === 'submissions') { await fetchSubmissions(tk); return; }
    // campaigns panel self-fetches
  };

  // First mount — try token from storage
  useEffect(() => {
    let cancelled = false;
    if (token) {
      setCheckingAuth(true);
      // On boot, hydrate BOTH datasets so tab switching is instant.
      Promise.all([fetchSpins(token), fetchSubmissions(token)]).then((results) => {
        if (cancelled) return;
        if (results.some(Boolean)) setAuthed(true);
        setCheckingAuth(false);
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on tab change once authed
  useEffect(() => {
    if (authed && token) void fetchActive(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const tk = tokenInput.trim();
    if (tk.length < 8) {
      setAuthError('Token must be at least 8 characters.');
      return;
    }
    const [ok1, ok2] = await Promise.all([fetchSpins(tk), fetchSubmissions(tk)]);
    if (ok1 || ok2) {
      setToken(tk);
      localStorage.setItem(TOKEN_STORAGE_KEY, tk);
      setAuthed(true);
      setTokenInput('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setAuthed(false);
    setLeads([]);
    setStats(null);
    setSubmissions([]);
    setSubmissionsCounts([]);
  };

  // ── Spins handlers ──────────────────────────────────────────────────────
  const handleApplyFilters = () => { if (token) fetchSpins(token); };
  const handleResetFilters = () => {
    setPhoneFilter(''); setFromDate(''); setToDate('');
    if (token) fetchSpins(token, { phone: '', from: '', to: '' });
  };
  const handleExportCsv = () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (phoneFilter.trim()) params.set('phone', phoneFilter.trim());
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    params.set('format', 'csv');
    fetch(`/api/lucky/admin/leads?${params.toString()}`, { headers: { 'X-Admin-Token': token } })
      .then((r) => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lucky-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Export failed'));
  };

  // ── Submissions handlers ────────────────────────────────────────────────
  const handleApplySubFilters = () => { if (token) fetchSubmissions(token); };
  const handleResetSubFilters = () => {
    setSubSearch(''); setSubSource(''); setSubStatus(''); setSubFrom(''); setSubTo('');
    if (token) fetchSubmissions(token, { search: '', source: '', status: '', from: '', to: '' });
  };
  const handleExportSubCsv = () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (subSearch.trim()) params.set('search', subSearch.trim());
    if (subSource) params.set('source', subSource);
    if (subStatus) params.set('status', subStatus);
    if (subFrom) params.set('from', subFrom);
    if (subTo) params.set('to', subTo);
    params.set('format', 'csv');
    fetch(`/api/admin/submissions?${params.toString()}`, { headers: { 'X-Admin-Token': token } })
      .then((r) => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Export failed'));
  };

  const handleReengage = async () => {
    if (!token || reengageLoading) return;
    setReengageLoading(true);
    setReengageResult(null);
    try {
      const res = await fetch('/api/admin/inbox/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ daysBack: 30, minIdleHours: 48 }),
      });
      const data = await res.json();
      setReengageResult({ sent: data.sent ?? 0, total: data.total ?? 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-engagement failed');
    } finally {
      setReengageLoading(false);
    }
  };

  const handleApptReminders = async () => {
    if (!token || apptReminderLoading) return;
    setApptReminderLoading(true);
    setApptReminderResult(null);
    try {
      const res = await fetch('/api/admin/reminders/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      });
      const data = await res.json();
      setApptReminderResult({ sent: data.sent ?? 0, total: data.total ?? 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reminder send failed');
    } finally {
      setApptReminderLoading(false);
    }
  };

  const handleFollowup = async () => {
    if (!token || followupLoading) return;
    setFollowupLoading(true);
    setFollowupResult(null);
    try {
      const res = await fetch('/api/admin/reminders/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      });
      const data = await res.json();
      setFollowupResult({ sent: data.sent ?? 0, total: data.total ?? 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Follow-up send failed');
    } finally {
      setFollowupLoading(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    if (!token) return;
    setSubmissions((prev) => prev.map((s) => s.id === id ? { ...s, status: newStatus } : s));
    try {
      const res = await fetch(`/api/admin/submissions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
      // Reload to revert optimistic update on failure
      void fetchSubmissions(token);
    }
  };

  // ── Login screen ────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/30 mb-4">
              <Lock className="w-7 h-7 text-gold" />
            </div>
            <h1 className="font-serif text-3xl text-white mb-2">TransforM Egypt — Admin</h1>
            <p className="text-white/50 text-sm">
              Enter your admin token to view captured leads &amp; submissions. Token can be set via the <code className="text-gold">ADMIN_TOKEN</code> Replit secret.
            </p>
          </div>
          <form onSubmit={handleLogin} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Admin Token</label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => { setTokenInput(e.target.value); setAuthError(''); }}
                className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-4 py-3 text-white outline-none font-mono"
                placeholder="••••••••••••••••"
                autoFocus
                disabled={checkingAuth}
              />
              {authError && <p className="text-rose-400 text-xs mt-1.5">{authError}</p>}
            </div>
            <Button type="submit" disabled={checkingAuth || !tokenInput.trim()} className="w-full bg-gold text-black hover:bg-gold/90 disabled:opacity-50">
              {checkingAuth ? 'Checking…' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-black/60 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl">TransforM Egypt — Admin</h1>
            <p className="text-xs text-white/40 mt-0.5">Internal dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => token && fetchActive(token)} disabled={loading} className="border-white/20 text-white hover:bg-white/10 hover:text-white">
              <RefreshCw className={`w-4 h-4 me-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-white/20 text-white hover:bg-white/10 hover:text-white">
              <LogOut className="w-4 h-4 me-2" />
              Sign out
            </Button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 border-b border-white/10 -mb-px">
            <TabBtn active={tab === 'spins'} onClick={() => setTab('spins')} icon={<Trophy className="w-4 h-4" />} label="Lucky Spins" count={stats?.totalLeads} />
            <TabBtn active={tab === 'submissions'} onClick={() => setTab('submissions')} icon={<Inbox className="w-4 h-4" />} label="Submissions" count={submissionsCounts.reduce((a, c) => a + c.count, 0)} />
            <TabBtn active={tab === 'appointments'} onClick={() => setTab('appointments')} icon={<Calendar className="w-4 h-4" />} label="Appointments" />
            <TabBtn active={tab === 'clients'} onClick={() => setTab('clients')} icon={<Users className="w-4 h-4" />} label="Clients" />
            <TabBtn active={tab === 'inbox'} onClick={() => setTab('inbox')} icon={<MessageSquare className="w-4 h-4" />} label="Instagram Inbox" />
            <TabBtn active={tab === 'campaigns'} onClick={() => setTab('campaigns')} icon={<Zap className="w-4 h-4" />} label="Campaigns" />
            <TabBtn active={tab === 'ads'} onClick={() => setTab('ads')} icon={<Megaphone className="w-4 h-4" />} label="Ads" />
            <TabBtn active={tab === 'calls'} onClick={() => setTab('calls')} icon={<PhoneCall className="w-4 h-4" />} label="Calls" />
            <TabBtn active={tab === 'automation'} onClick={() => setTab('automation')} icon={<Bot className="w-4 h-4" />} label="Automation" />
            <TabBtn active={tab === 'social'} onClick={() => setTab('social')} icon={<Share2 className="w-4 h-4" />} label="Social AI" />
            <TabBtn active={tab === 'offers'} onClick={() => setTab('offers')} icon={<Sparkles className="w-4 h-4" />} label="Offers" />
            <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')} icon={<MessageSquare className="w-4 h-4" />} label="Chat Activity" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 mb-6 text-sm">{error}</div>
        )}

        {tab === 'spins' && (
          <SpinsPanel
            leads={leads}
            stats={stats}
            loading={loading}
            phoneFilter={phoneFilter} setPhoneFilter={setPhoneFilter}
            fromDate={fromDate} setFromDate={setFromDate}
            toDate={toDate} setToDate={setToDate}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            onExport={handleExportCsv}
          />
        )}

        {tab === 'submissions' && (
          <SubmissionsPanel
            submissions={submissions}
            counts={submissionsCounts}
            loading={loading}
            search={subSearch} setSearch={setSubSearch}
            source={subSource} setSource={setSubSource}
            status={subStatus} setStatus={setSubStatus}
            from={subFrom} setFrom={setSubFrom}
            to={subTo} setTo={setSubTo}
            onApply={handleApplySubFilters}
            onReset={handleResetSubFilters}
            onExport={handleExportSubCsv}
            onStatusChange={handleStatusChange}
            onAddManual={() => setManualOpen(true)}
            onReengage={handleReengage}
            reengageLoading={reengageLoading}
            reengageResult={reengageResult}
            onApptReminders={handleApptReminders}
            apptReminderLoading={apptReminderLoading}
            apptReminderResult={apptReminderResult}
            onFollowup={handleFollowup}
            followupLoading={followupLoading}
            followupResult={followupResult}
            token={token ?? ''}
          />
        )}

        {tab === 'appointments' && <AppointmentsPanel token={token ?? ''} />}
        {tab === 'clients' && <ClientsPanel token={token ?? ''} />}
        {tab === 'inbox' && <InboxPanel token={token} />}
        {tab === 'campaigns' && <CampaignsPanel token={token} />}
        {tab === 'ads' && <AdsPanel token={token} />}
        {tab === 'calls' && <CallsPanel token={token} />}
        {tab === 'automation' && <AutomationPanel token={token ?? ''} />}
        {tab === 'social' && <SocialPanel token={token ?? ''} />}
        {tab === 'offers' && <OffersPanel token={token ?? ''} />}
        {tab === 'chat' && <YaraChatPanel token={token ?? ''} />}
      </div>

      {manualOpen && (
        <ManualEntryModal
          token={token}
          onClose={() => setManualOpen(false)}
          onSaved={() => { setManualOpen(false); if (token) void fetchSubmissions(token); }}
        />
      )}
    </div>
  );
}

// ─── Yara Chat Activity Panel ──────────────────────────────────────────────────
type ChatEvent =
  | {
      type: 'booking';
      outcome: 'booked';
      id: string;
      dbId: number;
      name: string | null;
      phone: string;
      service: string;
      branch: string | null;
      scheduledAt: string | null;
      status: string;
      notes: string | null;
      customerMessage: string | null;
      yaraReply: string | null;
      createdAt: string | null;
    }
  | {
      type: 'escalation';
      outcome: 'escalated';
      id: string;
      dbId: number;
      name: string | null;
      phone: string | null;
      customerMessage: string | null;
      yaraReply: string | null;
      reason: string | null;
      sessionId: string | null;
      status: string;
      createdAt: string | null;
    }
  | {
      type: 'general';
      outcome: 'general';
      id: string;
      dbId: number;
      name: string | null;
      phone: string | null;
      customerMessage: string | null;
      yaraReply: string | null;
      status: string;
      createdAt: string | null;
    };

function YaraChatPanel({ token }: { token: string }) {
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'booking' | 'escalation'>('all');

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/chat-activity', {
        headers: { 'X-Admin-Token': token },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { events: ChatEvent[]; total: number };
      setEvents(json.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchEvents(); }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter);
  const bookingCount = events.filter((e) => e.type === 'booking').length;
  const escalationCount = events.filter((e) => e.type === 'escalation').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-serif text-white">Chat Activity</h2>
          <p className="text-xs text-white/50 mt-0.5">Bookings and escalations generated by Yara on the website</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchEvents}
          disabled={loading}
          className="border-white/20 text-white hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 me-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-2xl font-semibold text-white">{events.length}</div>
          <div className="text-xs text-white/50 mt-1">Total events</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-300">{bookingCount}</div>
          <div className="text-xs text-white/50 mt-1">Bookings via Yara</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
          <div className="text-2xl font-semibold text-amber-300">{escalationCount}</div>
          <div className="text-xs text-white/50 mt-1">Escalations</div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'booking', 'escalation'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-gold text-black'
                : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f === 'booking' ? 'Bookings' : 'Escalations'}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 text-sm">{error}</div>
      )}

      {/* Event list */}
      <div className="space-y-3">
        {loading && filtered.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-white/40 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading chat activity…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-white/40 text-sm">
            No {filter === 'all' ? '' : filter} events yet. Activity from Yara website chat will appear here.
          </div>
        )}
        {filtered.map((event) => (
          <ChatEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

function ChatEventCard({ event }: { event: ChatEvent }) {
  const [expanded, setExpanded] = useState(false);

  const ts = event.createdAt
    ? new Date(event.createdAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  if (event.type === 'booking') {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
              <Calendar className="w-3 h-3" /> Booked
            </span>
            <span className="text-xs text-white/40">{ts}</span>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
            event.status === 'scheduled' ? 'bg-sky-500/15 text-sky-300' :
            event.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-300' :
            event.status === 'completed' ? 'bg-violet-500/15 text-violet-300' :
            event.status === 'cancelled' ? 'bg-rose-500/15 text-rose-300' :
            'bg-white/10 text-white/50'
          }`}>{event.status}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
          <div>
            <span className="text-white/40 text-xs">Client</span>
            <div className="text-white">{event.name ?? '—'}</div>
          </div>
          <div>
            <span className="text-white/40 text-xs">Phone</span>
            <div className="text-white font-mono text-xs">{event.phone}</div>
          </div>
          <div>
            <span className="text-white/40 text-xs">Service</span>
            <div className="text-white">{event.service}</div>
          </div>
          {event.branch && (
            <div>
              <span className="text-white/40 text-xs">Branch</span>
              <div className="text-white">{event.branch}</div>
            </div>
          )}
          {event.scheduledAt && (
            <div>
              <span className="text-white/40 text-xs">Scheduled</span>
              <div className="text-white text-xs">
                {new Date(event.scheduledAt).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          )}
        </div>
        {event.notes && (
          <div className="mt-2 text-xs text-white/50 italic border-t border-white/10 pt-2">{event.notes}</div>
        )}
        {(event.customerMessage || event.yaraReply) && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? 'Hide' : 'Show'} conversation excerpt
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {event.customerMessage && (
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Customer said</div>
                    <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{event.customerMessage}</p>
                  </div>
                )}
                {event.yaraReply && (
                  <div className="rounded-lg bg-gold/5 border border-gold/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-gold/50 mb-1">Yara replied</div>
                    <p className="text-sm text-white/70 whitespace-pre-wrap break-words">{event.yaraReply}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Escalation card
  if (event.type === 'escalation') return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
            <AlertTriangle className="w-3 h-3" /> Escalated
          </span>
          <span className="text-xs text-white/40">{ts}</span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
          event.status === 'new' ? 'bg-sky-500/15 text-sky-300' :
          event.status === 'contacted' ? 'bg-emerald-500/15 text-emerald-300' :
          event.status === 'closed' ? 'bg-white/10 text-white/40' :
          'bg-white/10 text-white/50'
        }`}>{event.status}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {event.name && (
          <div>
            <span className="text-white/40 text-xs">Customer</span>
            <div className="text-white">{event.name}</div>
          </div>
        )}
        {event.phone && (
          <div>
            <span className="text-white/40 text-xs">Phone</span>
            <div className="text-white font-mono text-xs">{event.phone}</div>
          </div>
        )}
      </div>

      {event.reason && (
        <div className="mt-2 text-xs text-amber-200/70 bg-amber-500/10 rounded px-2.5 py-1.5 border border-amber-500/15">
          {event.reason}
        </div>
      )}

      {(event.customerMessage || event.yaraReply) && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide' : 'Show'} conversation excerpt
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {event.customerMessage && (
                <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Customer said</div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{event.customerMessage}</p>
                </div>
              )}
              {event.yaraReply && (
                <div className="rounded-lg bg-gold/5 border border-gold/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-gold/50 mb-1">Yara replied</div>
                  <p className="text-sm text-white/70 whitespace-pre-wrap break-words">{event.yaraReply}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // General / unknown outcome card
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/60">
          <MessageSquare className="w-3 h-3" /> General
        </span>
        <span className="text-xs text-white/40">{ts}</span>
      </div>
      {(event.customerMessage || event.yaraReply) && (
        <div className="space-y-2">
          {event.customerMessage && (
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Customer said</div>
              <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{event.customerMessage}</p>
            </div>
          )}
          {event.yaraReply && (
            <div className="rounded-lg bg-gold/5 border border-gold/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gold/50 mb-1">Yara replied</div>
              <p className="text-sm text-white/70 whitespace-pre-wrap break-words">{event.yaraReply}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${active ? 'border-gold text-gold' : 'border-transparent text-white/60 hover:text-white'}`}
    >
      {icon}
      {label}
      {typeof count === 'number' && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-gold/15 text-gold' : 'bg-white/10 text-white/60'}`}>{count}</span>
      )}
    </button>
  );
}

// ─── Spins Panel ──────────────────────────────────────────────────────────────
function SpinsPanel(props: {
  leads: Lead[]; stats: Stats | null; loading: boolean;
  phoneFilter: string; setPhoneFilter: (v: string) => void;
  fromDate: string; setFromDate: (v: string) => void;
  toDate: string; setToDate: (v: string) => void;
  onApply: () => void; onReset: () => void; onExport: () => void;
}) {
  const { leads, stats, loading, phoneFilter, setPhoneFilter, fromDate, setFromDate, toDate, setToDate, onApply, onReset, onExport } = props;
  return (
    <>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatBox icon={<Users className="w-4 h-4" />} label="Total leads" value={String(stats.totalLeads)} />
          <StatBox icon={<Calendar className="w-4 h-4" />} label="Today's spins" value={String(stats.todaySpins)} />
          <StatBox icon={<Trophy className="w-4 h-4" />} label="Grand winners (today)" value={`${stats.todayGrandAwarded} / ${stats.grandCap}`} highlight />
          <StatBox icon={<Trophy className="w-4 h-4" />} label="Total grand winners" value={String(stats.totalGrandAwarded)} />
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Phone (contains)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onApply(); }}
                placeholder="0100..."
                className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg pl-9 pr-3 py-2 text-white outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">From date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">To date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={onApply} disabled={loading} className="flex-1 bg-gold text-black hover:bg-gold/90 disabled:opacity-50">Apply</Button>
            <Button onClick={onReset} variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">Clear</Button>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={onExport} disabled={loading || leads.length === 0} className="bg-white/10 hover:bg-white/15 text-white border border-white/15">
            <Download className="w-4 h-4 me-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-sm">
          <span className="text-white/70">{leads.length} {leads.length === 1 ? 'lead' : 'leads'}</span>
          {loading && <span className="text-white/50 text-xs">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-start px-4 py-3 font-medium">Date</th>
                <th className="text-start px-4 py-3 font-medium">Name</th>
                <th className="text-start px-4 py-3 font-medium">Contact</th>
                <th className="text-start px-4 py-3 font-medium">Branch</th>
                <th className="text-start px-4 py-3 font-medium">Quiz</th>
                <th className="text-start px-4 py-3 font-medium">Prize</th>
                <th className="text-start px-4 py-3 font-medium">Code</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-12 text-white/40">No leads found.</td></tr>
              )}
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/70 whitespace-nowrap text-xs">
                    <div>{lead.spinDate}</div>
                    <div className="text-white/40">{new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-4 py-3 text-white whitespace-nowrap">{lead.name}</td>
                  <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs"><Phone className="w-3 h-3 text-white/40" />{lead.phone}</div>
                    {lead.email && <div className="flex items-center gap-1.5 text-xs text-white/60 mt-1"><Mail className="w-3 h-3 text-white/40" />{lead.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs whitespace-nowrap">{lead.branch ?? '—'}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {lead.quizGoal && <span className="px-1.5 py-0.5 rounded bg-white/5">{lead.quizGoal}</span>}
                      {lead.quizHair && <span className="px-1.5 py-0.5 rounded bg-white/5">{lead.quizHair}</span>}
                      {lead.quizTimeline && <span className="px-1.5 py-0.5 rounded bg-white/5">{lead.quizTimeline}</span>}
                      {lead.quizVibe && <span className="px-1.5 py-0.5 rounded bg-white/5">{lead.quizVibe}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="flex items-start gap-2">
                      {lead.isGrand && <Trophy className="w-3.5 h-3.5 text-gold mt-0.5 shrink-0" />}
                      <span className={`text-xs ${lead.isGrand ? 'text-gold font-semibold' : 'text-white/70'}`}>{lead.prizeLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gold whitespace-nowrap">{lead.prizeCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Submission message renderer ─────────────────────────────────────────────
// The `message` field is stored as JSON: { threadId, platform, capturedFrom, conversation }
// where `conversation` is a "Customer: …\nYara: …" chat log string.
// We parse it and display the conversation as a readable chat preview.
const CAPTURED_FROM_LABELS: Record<string, string> = {
  dm_phone_detection: "📞 Phone detected",
  operator_button: "👤 Manual capture",
  ai_escalation: "🤖 AI escalation",
};

function SubmissionMessage({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-white/30">—</span>;

  let parsed: { threadId?: string; platform?: string; capturedFrom?: string; conversation?: string } | null = null;
  try { parsed = JSON.parse(raw); } catch { /* plain text — render as-is */ }

  if (!parsed) {
    return <span className="whitespace-pre-wrap break-words">{raw}</span>;
  }

  const triggerLabel = parsed.capturedFrom ? (CAPTURED_FROM_LABELS[parsed.capturedFrom] ?? parsed.capturedFrom) : null;

  // Split conversation string ("Customer: …\nYara: …") into individual lines
  const lines = (parsed.conversation ?? "").split("\n").filter(Boolean);

  return (
    <div className="space-y-1.5">
      {triggerLabel && (
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-white/40 text-[10px] border border-white/10 mb-1">
          {triggerLabel}
          {parsed.platform && <span className="text-white/25"> · {parsed.platform}</span>}
        </div>
      )}
      {lines.length > 0 ? (
        <div className="space-y-1">
          {lines.map((line, i) => {
            const isYara = line.startsWith("Yara:");
            const isCustomer = line.startsWith("Customer:");
            const content = line.replace(/^(Yara|Customer):\s*/, "");
            return (
              <div key={i} className={`text-[11px] leading-snug ${isYara ? "text-gold/70" : isCustomer ? "text-white/70" : "text-white/50"}`}>
                {isYara && <span className="text-gold/40 font-medium mr-1">Yara:</span>}
                {isCustomer && <span className="text-white/40 font-medium mr-1">Customer:</span>}
                <span className="break-words">{content}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="text-white/30 text-[11px]">No conversation preview</span>
      )}
    </div>
  );
}

// ─── Submissions Panel ────────────────────────────────────────────────────────
function SubmissionsPanel(props: {
  submissions: Submission[]; counts: SourceCount[]; loading: boolean;
  search: string; setSearch: (v: string) => void;
  source: string; setSource: (v: string) => void;
  status: string; setStatus: (v: string) => void;
  from: string; setFrom: (v: string) => void;
  to: string; setTo: (v: string) => void;
  onApply: () => void; onReset: () => void; onExport: () => void;
  onStatusChange: (id: number, status: string) => void;
  onAddManual: () => void;
  onReengage: () => void;
  reengageLoading: boolean;
  reengageResult: { sent: number; total: number } | null;
  onApptReminders: () => void;
  apptReminderLoading: boolean;
  apptReminderResult: { sent: number; total: number } | null;
  onFollowup: () => void;
  followupLoading: boolean;
  followupResult: { sent: number; total: number } | null;
  token: string;
}) {
  const {
    submissions, counts, loading, search, setSearch, source, setSource, status, setStatus,
    from, setFrom, to, setTo, onApply, onReset, onExport, onStatusChange, onAddManual,
    onReengage, reengageLoading, reengageResult,
    onApptReminders, apptReminderLoading, apptReminderResult,
    onFollowup, followupLoading, followupResult,
    token,
  } = props;

  const [callingId, setCallingId] = useState<number | null>(null);
  const [callResult, setCallResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null);

  const handleCall = async (sub: Submission) => {
    if (!sub.phone) return;
    setCallingId(sub.id);
    setCallResult(null);
    try {
      const leadContext = sub.message
        ? (() => { try { const p = JSON.parse(sub.message); return p.conversation ?? sub.message; } catch { return sub.message; } })()
        : '';
      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: sub.phone, language: sub.language ?? 'ar', leadContext: String(leadContext).slice(0, 400) }),
      });
      const data = await res.json();
      setCallResult({ id: sub.id, ok: res.ok, msg: res.ok ? `Call initiated (ID: ${data.callId ?? '—'})` : (data.error ?? 'Failed') });
    } catch (e) {
      setCallResult({ id: sub.id, ok: false, msg: (e as Error).message });
    } finally {
      setCallingId(null);
    }
  };

  const total = counts.reduce((a, c) => a + c.count, 0);

  return (
    <>
      {/* Source breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        {Object.keys(SOURCE_LABELS).map((src) => {
          const c = counts.find((x) => x.source === src)?.count ?? 0;
          return (
            <div key={src} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-white/40">{SOURCE_LABELS[src]}</div>
              <div className="text-lg font-serif text-white mt-0.5">{c}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Search (name / phone / email)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onApply(); }}
                placeholder="Search…"
                className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg pl-9 pr-3 py-2 text-white outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm">
              <option value="">All</option>
              {Object.keys(SOURCE_LABELS).map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm">
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <div className="flex gap-2">
            <Button onClick={onApply} disabled={loading} className="bg-gold text-black hover:bg-gold/90 disabled:opacity-50">Apply</Button>
            <Button onClick={onReset} variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">Clear</Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={onAddManual} className="bg-gold/90 text-black hover:bg-gold">
              <Plus className="w-4 h-4 me-2" />
              Log New Lead
            </Button>
            <Button onClick={onExport} disabled={loading || submissions.length === 0} className="bg-white/10 hover:bg-white/15 text-white border border-white/15">
              <Download className="w-4 h-4 me-2" />
              Export CSV
            </Button>
            <Button
              onClick={onReengage}
              disabled={reengageLoading}
              title="Send a warm follow-up DM to cold leads who showed booking intent in the last 30 days but haven't been contacted in 48+ hours"
              className="bg-purple-900/60 hover:bg-purple-800/70 text-purple-200 border border-purple-500/30 disabled:opacity-50"
            >
              {reengageLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Sending…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  Re-engage Cold Leads
                </span>
              )}
            </Button>
          </div>
        </div>
        {reengageResult && (
          <div className={`mt-3 px-4 py-2 rounded-lg text-sm border ${reengageResult.sent > 0 ? 'bg-purple-900/20 border-purple-500/30 text-purple-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
            {reengageResult.sent > 0
              ? `✓ Re-engagement sent to ${reengageResult.sent} cold lead${reengageResult.sent > 1 ? 's' : ''}${reengageResult.total > reengageResult.sent ? ` (${reengageResult.total - reengageResult.sent} skipped — already contacted or too recent)` : ''}.`
              : `No cold leads found matching criteria (booking intent in 30 days, idle 48+ hours, not re-engaged in 7 days).`}
          </div>
        )}

        {/* Appointment reminders + post-booking follow-up */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            onClick={onApptReminders}
            disabled={apptReminderLoading}
            title="Email appointment reminders to clients with bookings in the next 24 hours (each booking only receives one reminder)"
            className="bg-teal-900/60 hover:bg-teal-800/70 text-teal-200 border border-teal-500/30 disabled:opacity-50"
          >
            {apptReminderLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Sending…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Send Appointment Reminders
              </span>
            )}
          </Button>
          <Button
            onClick={onFollowup}
            disabled={followupLoading}
            title="Send post-visit satisfaction DM / email to clients booked 3-4 days ago (each client only gets one follow-up)"
            className="bg-amber-900/60 hover:bg-amber-800/70 text-amber-200 border border-amber-500/30 disabled:opacity-50"
          >
            {followupLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Sending…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                Send Post-Visit Follow-ups
              </span>
            )}
          </Button>
        </div>
        {apptReminderResult && (
          <div className={`mt-2 px-4 py-2 rounded-lg text-sm border ${apptReminderResult.sent > 0 ? 'bg-teal-900/20 border-teal-500/30 text-teal-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
            {apptReminderResult.sent > 0
              ? `✓ Appointment reminder emailed to ${apptReminderResult.sent} client${apptReminderResult.sent > 1 ? 's' : ''}.`
              : `No upcoming appointments need a reminder right now (24 h window).`}
          </div>
        )}
        {followupResult && (
          <div className={`mt-2 px-4 py-2 rounded-lg text-sm border ${followupResult.sent > 0 ? 'bg-amber-900/20 border-amber-500/30 text-amber-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
            {followupResult.sent > 0
              ? `✓ Follow-up sent to ${followupResult.sent} client${followupResult.sent > 1 ? 's' : ''} (3-4 days post-visit).`
              : `No clients in the 3-4 day post-booking window at the moment.`}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-sm">
          <span className="text-white/70">{submissions.length} of {total} {submissions.length === 1 ? 'submission' : 'submissions'}</span>
          {loading && <span className="text-white/50 text-xs">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-start px-4 py-3 font-medium">When</th>
                <th className="text-start px-4 py-3 font-medium">Source</th>
                <th className="text-start px-4 py-3 font-medium">Name</th>
                <th className="text-start px-4 py-3 font-medium">Contact</th>
                <th className="text-start px-4 py-3 font-medium">Service / Branch</th>
                <th className="text-start px-4 py-3 font-medium">Message</th>
                <th className="text-start px-4 py-3 font-medium">Status</th>
                <th className="text-start px-4 py-3 font-medium">Call</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center py-12 text-white/40">No submissions found.</td></tr>
              )}
              {submissions.map((s) => (
                <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.02] align-top">
                  <td className="px-4 py-3 text-white/70 whitespace-nowrap text-xs">
                    <div>{new Date(s.createdAt).toISOString().slice(0, 10)}</div>
                    <div className="text-white/40">{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {s.language && <div className="text-white/30 mt-0.5 uppercase text-[10px]">{s.language}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">
                      {SOURCE_LABELS[s.source] ?? s.source}
                    </span>
                    {s.loggedBy && <div className="text-white/40 text-[10px] mt-1">by {s.loggedBy}</div>}
                  </td>
                  <td className="px-4 py-3 text-white whitespace-nowrap">{s.name ?? <span className="text-white/30">—</span>}</td>
                  <td className="px-4 py-3 text-white/80 whitespace-nowrap text-xs">
                    {s.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-white/40" />{s.phone}</div>}
                    {s.email && <div className="flex items-center gap-1.5 text-white/60 mt-1"><Mail className="w-3 h-3 text-white/40" />{s.email}</div>}
                    {!s.phone && !s.email && <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {s.service && <div>{s.service}</div>}
                    {s.branch && <div className="flex items-center gap-1 text-white/50 mt-0.5"><MapPin className="w-3 h-3" />{s.branch}</div>}
                    {!s.service && !s.branch && <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs max-w-[280px]"><SubmissionMessage raw={s.message} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={s.status}
                      onChange={(e) => onStatusChange(s.id, e.target.value)}
                      className="bg-black/50 border border-white/15 focus:border-gold rounded px-2 py-1 text-xs text-white outline-none"
                    >
                      {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.phone ? (
                      <div className="space-y-1">
                        <button
                          onClick={() => handleCall(s)}
                          disabled={callingId === s.id}
                          title={`Call ${s.phone} via Yara`}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {callingId === s.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <PhoneCall className="w-3 h-3" />
                          )}
                          Call
                        </button>
                        {callResult?.id === s.id && (
                          <div className={`text-[10px] ${callResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {callResult.msg}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-white/20 text-xs">No phone</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Manual Entry Modal ───────────────────────────────────────────────────────
function ManualEntryModal({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', branch: '', service: '', message: '', loggedBy: '', status: 'new',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/submissions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ source: 'manual', ...form }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="relative max-w-lg w-full rounded-2xl bg-black border border-gold/30 p-6">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 end-3 text-white/50 hover:text-white p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-gold">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-serif text-2xl text-white mb-1">Log a new lead</h2>
        <p className="text-xs text-white/50 mb-5">Walk-ins, phone calls, DMs — anything you want tracked.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="0100…" />
          </div>
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service" value={form.service} onChange={(v) => setForm({ ...form, service: v })} />
            <Field label="Branch" value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Notes</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Logged by" value={form.loggedBy} onChange={(v) => setForm({ ...form, loggedBy: v })} placeholder="Your name" />
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white text-sm outline-none">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-rose-400 text-xs" role="alert">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10 hover:text-white">Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-gold text-black hover:bg-gold/90 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white text-sm outline-none" />
    </div>
  );
}

function StatBox({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-gold/40 bg-gold/5' : 'border-white/10 bg-white/5'}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50 mb-1.5">
        <span className={highlight ? 'text-gold' : 'text-white/50'}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-serif text-white">{value}</div>
    </div>
  );
}

// ─── Instagram Inbox Panel ───────────────────────────────────────────────────
// G3: two-way Instagram + Facebook conversation management.
//   • DMs sub-tab     — list threads, view conversation, send reply via Graph
//   • Comments sub-tab — list IG/FB Page comments, reply, mark read
//   • Setup sub-tab    — webhook URL + verify token to paste in Meta App UI

interface IGThread {
  thread_id: string;
  thread_platform: 'instagram' | 'facebook';
  sender_username: string | null;
  customer_id: string | null;
  customer_username: string | null;
  text: string | null;
  attachment_type: string | null;
  direction: 'inbound' | 'outbound';
  received_at: string;
  unread_count: number;
  ai_draft: string | null;
  ai_draft_status: AIDraftStatus | null;
  ai_escalated: boolean;
}

type AIDraftStatus = 'pending' | 'sent' | 'dismissed' | 'auto_sent';

interface IGMessage {
  id: number;
  threadId: string;
  threadPlatform: 'instagram' | 'facebook';
  senderId: string;
  senderUsername: string | null;
  direction: 'inbound' | 'outbound';
  text: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  receivedAt: string;
  aiDraft: string | null;
  aiDraftStatus: AIDraftStatus | null;
  aiGeneratedAt: string | null;
  aiEscalated: boolean;
}

interface IGComment {
  id: number;
  metaCommentId: string;
  platform: 'instagram' | 'facebook';
  parentMediaId: string;
  parentMediaPermalink: string | null;
  fromUserId: string;
  fromUsername: string | null;
  text: string;
  isRead: boolean;
  repliedAt: string | null;
  receivedAt: string;
  aiDraft: string | null;
  aiDraftStatus: AIDraftStatus | null;
  aiGeneratedAt: string | null;
  aiEscalated: boolean;
}

interface SetupInfo {
  webhookCallbackUrl: string;
  verifyToken: string;
  pageId: string;
  instagramBusinessAccountId: string;
  subscribedFields: string[];
  instagram: {
    // true = IG account is subscribed and DMs/comments will flow in
    // false = subscription call worked but "messages" field isn't subscribed
    // null  = couldn't reach Meta (e.g. dev w/o internet) — treat as unknown
    messagesSubscribed: boolean | null;
    subscribedFields: string[] | null;
  };
  ai: {
    enabled: boolean;
    model: string;
    modeDms: 'off' | 'suggest' | 'auto';
    modeComments: 'off' | 'suggest' | 'auto';
    exemplarsCount: number;
  };
}

interface BackfillResult {
  ok: true;
  totalAfter: number;
  scanned: { conversations: number; messages: number };
  pairs: number;
  inserted: number;
  skippedTemplates: number;
  skippedDuplicates: number;
  byLanguage: { ar: number; en: number };
  errors: string[];
}

function InboxPanel({ token }: { token: string }) {
  const [sub, setSub] = useState<'dms' | 'comments' | 'setup'>('dms');
  return (
    <div>
      <div className="flex gap-1 border-b border-white/10 mb-6">
        <SubTab active={sub === 'dms'} onClick={() => setSub('dms')} label="Direct Messages" />
        <SubTab active={sub === 'comments'} onClick={() => setSub('comments')} label="Comments" />
        <SubTab active={sub === 'setup'} onClick={() => setSub('setup')} label="Setup" />
      </div>
      {sub === 'dms' && <DMsView token={token} />}
      {sub === 'comments' && <CommentsView token={token} />}
      {sub === 'setup' && <SetupView token={token} />}
    </div>
  );
}

function SubTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 transition-colors ${active ? 'border-gold text-gold' : 'border-transparent text-white/60 hover:text-white'}`}
    >
      {label}
    </button>
  );
}

function DMsView({ token }: { token: string }) {
  const [threads, setThreads] = useState<IGThread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<IGMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [aiBusy, setAiBusy] = useState<'approve' | 'regen' | 'dismiss' | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capBusy, setCapBusy] = useState(false);
  const [capPhone, setCapPhone] = useState('');
  const [capName, setCapName] = useState('');
  const [capBranch, setCapBranch] = useState('');
  const [capService, setCapService] = useState('');
  const [capMsg, setCapMsg] = useState('');

  // Find most recent inbound message in this thread with a pending AI draft.
  // The Replymind agent generates these on inbound webhooks; admin reviews here.
  const latestPendingDraft = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.direction === 'inbound' && m.aiDraftStatus === 'pending' && m.aiDraft) {
        return m;
      }
    }
    return null;
  })();

  function loadThreads() {
    setLoading(true);
    fetch('/api/admin/inbox/threads', { headers: { 'X-Admin-Token': token } })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j: { threads: IGThread[] }) => { setThreads(j.threads || []); setLoading(false); })
      .catch((e) => { setErr(`Failed to load threads (${e})`); setLoading(false); });
  }

  function loadMessages(threadId: string) {
    setSelected(threadId);
    fetch(`/api/admin/inbox/threads/${encodeURIComponent(threadId)}`, { headers: { 'X-Admin-Token': token } })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j: { messages: IGMessage[] }) => { setMessages(j.messages || []); loadThreads(); })
      .catch((e) => setErr(`Failed to load messages (${e})`));
  }

  async function sendReply() {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/inbox/threads/${encodeURIComponent(selected)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ text: reply.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setReply('');
      loadMessages(selected);
    } catch (e) {
      setErr(`Reply failed: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  // ── AI draft actions ─────────────────────────────────────────────────────
  async function aiApprove(messageId: number, text: string) {
    if (!selected || aiBusy) return;
    setAiBusy('approve');
    setErr('');
    try {
      const res = await fetch(`/api/admin/inbox/messages/${messageId}/ai-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      loadMessages(selected);
    } catch (e) {
      setErr(`Approve failed: ${(e as Error).message}`);
    } finally {
      setAiBusy(null);
    }
  }
  async function aiRegen(messageId: number) {
    if (!selected || aiBusy) return;
    setAiBusy('regen');
    setErr('');
    try {
      const res = await fetch(`/api/admin/inbox/messages/${messageId}/ai-regenerate`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      loadMessages(selected);
    } catch (e) {
      setErr(`Regenerate failed: ${(e as Error).message}`);
    } finally {
      setAiBusy(null);
    }
  }
  async function aiDismiss(messageId: number) {
    if (!selected || aiBusy) return;
    setAiBusy('dismiss');
    setErr('');
    try {
      await fetch(`/api/admin/inbox/messages/${messageId}/ai-dismiss`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      });
      loadMessages(selected);
    } catch (e) {
      setErr(`Dismiss failed: ${(e as Error).message}`);
    } finally {
      setAiBusy(null);
    }
  }

  function openCapture() {
    const t = threads.find((x) => x.thread_id === selected);
    setCapName(t?.customer_username ? `@${t.customer_username}` : '');
    setCapPhone(''); setCapBranch(''); setCapService(''); setCapMsg('');
    setCaptureOpen(true);
  }

  async function submitCapture() {
    if (!selected || capBusy) return;
    setCapBusy(true);
    setCapMsg('');
    try {
      const res = await fetch(`/api/admin/inbox/threads/${encodeURIComponent(selected)}/capture-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          phone: capPhone.trim() || undefined,
          name: capName.trim() || undefined,
          branch: capBranch.trim() || undefined,
          service: capService.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setCapMsg(j.message || 'Lead captured.');
      setTimeout(() => setCaptureOpen(false), 1200);
    } catch (e) {
      setCapMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setCapBusy(false);
    }
  }

  useEffect(() => { loadThreads(); }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[500px]">
      {/* Sidebar */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden md:col-span-1">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-medium">Conversations</h3>
          <button onClick={loadThreads} className="text-white/40 hover:text-white" aria-label="Refresh threads">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {threads.length === 0 && !loading && (
            <div className="p-6 text-center text-white/40 text-sm">
              No messages yet.<br/>Messenger DMs appear here in real time. Instagram DMs require App Review approval (see Setup tab).
            </div>
          )}
          {threads.map((t) => (
            <button
              key={t.thread_id}
              onClick={() => loadMessages(t.thread_id)}
              className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${selected === t.thread_id ? 'bg-white/10' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">
                  {t.customer_username
                    ? `@${t.customer_username}`
                    : `#${(t.customer_id || t.thread_id).slice(-8)}`}
                </span>
                {t.unread_count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gold text-black font-bold">{t.unread_count}</span>
                )}
              </div>
              <div className="text-xs text-white/50 truncate mt-0.5">
                {t.direction === 'outbound' && '↩ '}
                {t.text || (t.attachment_type ? `[${t.attachment_type}]` : '...')}
              </div>
              <div className="text-[10px] text-white/30 mt-1">
                {new Date(t.received_at).toLocaleString()} · {t.thread_platform}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation view */}
      <div className="rounded-xl border border-white/10 bg-white/5 md:col-span-2 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
            Select a conversation to view and reply.
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${m.direction === 'outbound' ? 'bg-gold text-black' : 'bg-white/10 text-white'}`}>
                    {m.text && <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>}
                    {m.attachmentUrl && (
                      <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 inline-block">
                        [{m.attachmentType || 'attachment'}]
                      </a>
                    )}
                    <div className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-black/50' : 'text-white/40'}`}>
                      {new Date(m.receivedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {latestPendingDraft && (
              <AIDraftCard
                draft={latestPendingDraft.aiDraft || ''}
                escalated={latestPendingDraft.aiEscalated}
                generatedAt={latestPendingDraft.aiGeneratedAt}
                busy={aiBusy}
                onApprove={(text) => aiApprove(latestPendingDraft.id, text)}
                onEditIntoInput={(text) => setReply(text)}
                onRegenerate={() => aiRegen(latestPendingDraft.id)}
                onDismiss={() => aiDismiss(latestPendingDraft.id)}
              />
            )}
            <div className="border-t border-white/10 p-3 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder="Type a reply…"
                disabled={sending}
                className="flex-1 bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white text-sm outline-none disabled:opacity-50"
              />
              <Button onClick={sendReply} disabled={sending || !reply.trim()} className="bg-gold text-black hover:bg-gold/90">
                <Send className="w-4 h-4 me-1" /> {sending ? 'Sending…' : 'Send'}
              </Button>
            </div>
            <div className="px-3 pb-3 flex justify-end">
              <button
                onClick={openCapture}
                className="text-xs text-gold/80 hover:text-gold underline underline-offset-2"
                title="Save this conversation as a lead in the Submissions tab"
              >
                + Capture as Lead
              </button>
            </div>
            {err && <div className="px-3 pb-3 text-xs text-rose-400">{err}</div>}
          </>
        )}
      </div>

      {captureOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !capBusy && setCaptureOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gold/30 bg-zinc-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-white mb-1">Capture as Lead</h3>
            <p className="text-xs text-white/50 mb-4">
              Saves this conversation to the Submissions tab so the team can follow up. Phone is optional — fill it in when the customer shares it.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Name / username</label>
                <input
                  value={capName}
                  onChange={(e) => setCapName(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Phone (optional)</label>
                <input
                  value={capPhone}
                  onChange={(e) => setCapPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Branch</label>
                  <input
                    value={capBranch}
                    onChange={(e) => setCapBranch(e.target.value)}
                    placeholder="City Stars / Sofitel / O Mall"
                    className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Service</label>
                  <input
                    value={capService}
                    onChange={(e) => setCapService(e.target.value)}
                    placeholder="Hair extension / Lashes…"
                    className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>
            </div>
            {capMsg && (
              <div className={`mt-3 text-xs ${capMsg.startsWith('Failed') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {capMsg}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setCaptureOpen(false)}
                disabled={capBusy}
                className="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white border border-white/10 hover:border-white/20 disabled:opacity-50"
              >
                Cancel
              </button>
              <Button onClick={submitCapture} disabled={capBusy} className="bg-gold text-black hover:bg-gold/90">
                {capBusy ? 'Saving…' : 'Save Lead'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentsView({ token }: { token: string }) {
  const [comments, setComments] = useState<IGComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [err, setErr] = useState('');
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [aiBusyId, setAiBusyId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/admin/inbox/comments${unreadOnly ? '?unread=1' : ''}`, { headers: { 'X-Admin-Token': token } })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j: { comments: IGComment[] }) => { setComments(j.comments || []); setLoading(false); })
      .catch((e) => { setErr(`Failed to load comments (${e})`); setLoading(false); });
  }

  useEffect(() => { load(); }, [unreadOnly]);

  async function submitReply(id: number) {
    if (!replyText.trim() || sending) return;
    setSending(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/inbox/comments/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setReplyingId(null);
      setReplyText('');
      load();
    } catch (e) {
      setErr(`Reply failed: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  async function markRead(id: number) {
    try {
      await fetch(`/api/admin/inbox/comments/${id}/read`, { method: 'POST', headers: { 'X-Admin-Token': token } });
      load();
    } catch { /* ignore */ }
  }

  // ── AI actions for a single comment ─────────────────────────────────────
  async function aiApproveComment(id: number, text: string) {
    if (aiBusyId) return;
    setAiBusyId(id);
    setErr('');
    try {
      const res = await fetch(`/api/admin/inbox/comments/${id}/ai-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      load();
    } catch (e) {
      setErr(`Approve failed: ${(e as Error).message}`);
    } finally {
      setAiBusyId(null);
    }
  }
  async function aiRegenComment(id: number) {
    if (aiBusyId) return;
    setAiBusyId(id);
    setErr('');
    try {
      const res = await fetch(`/api/admin/inbox/comments/${id}/ai-regenerate`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      load();
    } catch (e) {
      setErr(`Regenerate failed: ${(e as Error).message}`);
    } finally {
      setAiBusyId(null);
    }
  }
  async function aiDismissComment(id: number) {
    if (aiBusyId) return;
    setAiBusyId(id);
    setErr('');
    try {
      await fetch(`/api/admin/inbox/comments/${id}/ai-dismiss`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      });
      load();
    } catch (e) {
      setErr(`Dismiss failed: ${(e as Error).message}`);
    } finally {
      setAiBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="accent-gold" />
          Unread only
        </label>
        <button onClick={load} className="text-white/40 hover:text-white" aria-label="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {err && <div className="text-rose-400 text-sm mb-3">{err}</div>}
      {comments.length === 0 && !loading && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center text-white/40 text-sm">
          No comments yet.<br/>IG/FB comments will appear here once Meta webhooks are configured.
        </div>
      )}
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className={`rounded-xl border p-4 ${c.isRead ? 'border-white/10 bg-white/5' : 'border-gold/40 bg-gold/5'}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">@{c.fromUsername || c.fromUserId.slice(0, 8)}</span>
                  <span className="text-xs text-white/40">on {c.platform}</span>
                  {c.repliedAt && <span className="text-xs text-emerald-400 inline-flex items-center gap-1"><Check className="w-3 h-3" /> replied</span>}
                </div>
                <div className="text-xs text-white/40 mt-0.5">{new Date(c.receivedAt).toLocaleString()}</div>
              </div>
              {c.parentMediaPermalink && (
                <a href={c.parentMediaPermalink} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-gold" aria-label="Open post">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-sm text-white/90 whitespace-pre-wrap break-words mb-3">{c.text}</p>
            {c.aiDraftStatus === 'pending' && c.aiDraft && replyingId !== c.id && (
              <AIDraftCard
                draft={c.aiDraft}
                escalated={c.aiEscalated}
                generatedAt={c.aiGeneratedAt}
                compact
                busy={aiBusyId === c.id ? 'approve' : null}
                onApprove={(text) => aiApproveComment(c.id, text)}
                onEditIntoInput={(text) => { setReplyingId(c.id); setReplyText(text); }}
                onRegenerate={() => aiRegenComment(c.id)}
                onDismiss={() => aiDismissComment(c.id)}
              />
            )}
            {c.aiDraftStatus === 'auto_sent' && (
              <div className="text-xs text-emerald-400/80 inline-flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3 h-3" /> Auto-replied by Replymind
              </div>
            )}
            {replyingId === c.id ? (
              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to this comment…"
                  className="flex-1 bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white text-sm outline-none"
                  autoFocus
                />
                <Button onClick={() => submitReply(c.id)} disabled={sending || !replyText.trim()} className="bg-gold text-black hover:bg-gold/90">
                  <Send className="w-4 h-4 me-1" /> {sending ? '...' : 'Send'}
                </Button>
                <Button variant="outline" onClick={() => { setReplyingId(null); setReplyText(''); }} className="border-white/20 text-white hover:bg-white/10 hover:text-white">
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => { setReplyingId(c.id); setReplyText(''); }} size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">
                  <MessageSquare className="w-3.5 h-3.5 me-1" /> Reply
                </Button>
                {!c.isRead && (
                  <Button onClick={() => markRead(c.id)} size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">
                    Mark read
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupView({ token }: { token: string }) {
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [backfillErr, setBackfillErr] = useState('');

  useEffect(() => {
    fetch('/api/admin/inbox/setup-info', { headers: { 'X-Admin-Token': token } })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then(setInfo)
      .catch((e) => setErr(`Failed to load setup info (${e})`));
  }, []);

  async function runBackfill(sinceDays: number) {
    setBackfillBusy(true);
    setBackfillErr('');
    setBackfillResult(null);
    try {
      const r = await fetch('/api/admin/inbox/backfill-exemplars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token,
        },
        body: JSON.stringify({ sinceDays }),
      });
      const j = await r.json();
      if (!r.ok) {
        setBackfillErr(j.error || `HTTP ${r.status}`);
      } else {
        setBackfillResult(j as BackfillResult);
        // Refresh count in info
        setInfo((prev) => prev ? { ...prev, ai: { ...prev.ai, exemplarsCount: j.totalAfter } } : prev);
      }
    } catch (e) {
      setBackfillErr((e as Error).message);
    } finally {
      setBackfillBusy(false);
    }
  }

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (err) return <div className="text-rose-400 text-sm">{err}</div>;
  if (!info) return <div className="text-white/50 text-sm">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
        <h3 className="font-serif text-lg text-gold mb-2">Meta Webhook Configuration</h3>
        <p className="text-sm text-white/70 mb-4">
          Paste these values into your Meta App's Webhook configuration so Lead Ads, Instagram DMs, and comments flow into this dashboard.
        </p>
        <CopyRow label="Callback URL" value={info.webhookCallbackUrl} onCopy={copy} copied={copied === 'Callback URL'} />
        <CopyRow label="Verify Token" value={info.verifyToken} onCopy={copy} copied={copied === 'Verify Token'} />
        <div className="mt-4 text-xs text-white/60">
          <strong className="text-white">Subscribe these fields:</strong>{' '}
          {info.subscribedFields.join(', ')}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="font-medium text-white mb-3">Connected Accounts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Info label="Facebook Page ID" value={info.pageId} />
          <Info label="Instagram Business ID" value={info.instagramBusinessAccountId} />
        </div>
        {/* IG subscription status — surfaces the #1 cause of "I'm not seeing
            Instagram DMs": Meta's App-level webhook config doesn't have the
            'instagram' object enabled, so even though our IG account is
            subscribed, Meta never delivers the events. */}
        <div className="mt-4 pt-4 border-t border-white/10">
          {info.instagram.messagesSubscribed === true && (
            <div className="text-xs text-emerald-300 inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              Instagram DMs subscribed ({(info.instagram.subscribedFields ?? []).join(', ')})
            </div>
          )}
          {info.instagram.messagesSubscribed === false && (
            <div className="space-y-2">
              <div className="text-xs text-amber-300 inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                Instagram DMs require <code className="text-gold">instagram_manage_messaging</code> App Review approval
              </div>
              <div className="text-xs text-white/60 leading-relaxed">
                Messenger DMs (Facebook Page) are flowing into this inbox normally. Pure Instagram DMs (including "Reply to ad" messages) are dropped by Meta until your app is approved for the <code className="text-gold">instagram_manage_messaging</code> permission via App Review (typically 2-3 business days). Until then, customers messaging on Instagram must be replied to from the Instagram app directly.
              </div>
            </div>
          )}
          {info.instagram.messagesSubscribed === null && (
            <div className="text-xs text-white/40">
              Instagram subscription status unknown (couldn't reach Meta).
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gold" />
          <h3 className="font-medium text-white">Replymind — AI auto-reply agent</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${info.ai.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {info.ai.enabled ? 'Active' : 'Disabled'}
          </span>
        </div>
        {info.ai.enabled ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <Info label="Model" value={info.ai.model} />
              <Info label="DMs mode" value={info.ai.modeDms} />
              <Info label="Comments mode" value={info.ai.modeComments} />
            </div>
            <div className="text-xs text-white/60 leading-relaxed space-y-1.5">
              <p><strong className="text-white">suggest</strong> — drafts a reply on every inbound message; you Approve / Edit / Regenerate / Dismiss it from the inbox.</p>
              <p><strong className="text-white">auto</strong> — sends the draft immediately, no review. Complaints / refund / medical keywords always demote to suggest.</p>
              <p><strong className="text-white">off</strong> — disables drafting for that channel.</p>
              <p className="text-white/40 mt-2">Change modes via env vars <code>AI_REPLY_MODE_DMS</code> and <code>AI_REPLY_MODE_COMMENTS</code>.</p>
            </div>

            {/* ── Memory mode — historical exemplars for tone matching ── */}
            <div className="mt-5 pt-5 border-t border-white/10">
              <div className="flex items-start gap-3 mb-3">
                <Brain className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">Memory mode — learn from past conversations</div>
                  <div className="text-xs text-white/60 mt-1">
                    Pulls past customer DMs + your team's actual replies from Meta and uses them as voice examples. The agent then mimics your real tone, length, and emoji style instead of guessing.
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 mb-3">
                <div className="text-xs text-white/70">
                  <span className="text-gold font-semibold text-base">{info.ai.exemplarsCount}</span> example pairs stored
                </div>
                {info.ai.exemplarsCount > 0 && (
                  <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> Active
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => runBackfill(90)}
                  disabled={backfillBusy}
                  variant="outline"
                  className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
                  size="sm"
                >
                  {backfillBusy ? (
                    <><Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> Syncing past 90 days…</>
                  ) : (
                    <><Database className="w-3.5 h-3.5 me-1.5" /> Sync past 90 days</>
                  )}
                </Button>
                <Button
                  onClick={() => runBackfill(365)}
                  disabled={backfillBusy}
                  variant="outline"
                  className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                  size="sm"
                >
                  {backfillBusy ? '…' : 'Sync past 12 months'}
                </Button>
              </div>

              {backfillErr && (
                <div className="mt-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2">
                  Backfill failed: {backfillErr}
                </div>
              )}

              {backfillResult && (
                <div className="mt-3 text-xs text-white/70 bg-emerald-500/5 border border-emerald-500/20 rounded px-3 py-2 leading-relaxed">
                  Scanned <strong className="text-white">{backfillResult.scanned.conversations}</strong> conversations, <strong className="text-white">{backfillResult.scanned.messages}</strong> messages.
                  <br />
                  Stored <strong className="text-emerald-300">{backfillResult.inserted}</strong> new examples ({backfillResult.byLanguage.ar} Arabic + {backfillResult.byLanguage.en} English).
                  {backfillResult.skippedTemplates > 0 && (
                    <> Skipped <strong className="text-white">{backfillResult.skippedTemplates}</strong> templated replies.</>
                  )}
                  {backfillResult.skippedDuplicates > 0 && (
                    <> Skipped <strong className="text-white">{backfillResult.skippedDuplicates}</strong> already-stored.</>
                  )}
                  {backfillResult.errors.length > 0 && (
                    <div className="text-rose-300 mt-1.5">{backfillResult.errors.length} non-fatal warning(s) — check server logs.</div>
                  )}
                </div>
              )}

              <div className="text-xs text-white/40 mt-3 leading-relaxed">
                Re-running is safe (already-stored pairs are skipped). New replies you Approve in the inbox flow into the same memory automatically.
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs text-white/60">
            Anthropic AI integration not configured. The agent layer is dormant — drafts won't be generated until env vars are set.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-xs text-white/60 leading-relaxed">
        <h4 className="text-white text-sm font-medium mb-2">Setup steps</h4>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">developers.facebook.com/apps</a> → your App → <strong>Webhooks</strong>.</li>
          <li>Add the <strong>Callback URL</strong> + <strong>Verify Token</strong> shown above.</li>
          <li>Subscribe to the listed fields under both <code>page</code> and <code>instagram</code> objects.</li>
          <li>Server auto-subscribes the page to webhook events on every restart.</li>
        </ol>
      </div>
    </div>
  );
}

function CopyRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: (l: string, v: string) => void; copied: boolean }) {
  return (
    <div className="mb-3">
      <div className="text-xs uppercase tracking-wider text-white/50 mb-1.5">{label}</div>
      <div className="flex gap-2">
        <input readOnly value={value} className="flex-1 bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none" />
        <Button onClick={() => onCopy(label, value)} variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white">
          {copied ? <><Check className="w-4 h-4 me-1" /> Copied</> : <><Copy className="w-4 h-4 me-1" /> Copy</>}
        </Button>
      </div>
    </div>
  );
}

// ── Replymind — AI draft card ───────────────────────────────────────────────
// Shown above the DM input (one per thread, latest pending) and inline in
// each comment card. The draft is editable in place; Approve sends the
// edited text via Meta and marks the row 'sent'.
function AIDraftCard({
  draft,
  escalated,
  generatedAt,
  busy,
  compact,
  onApprove,
  onEditIntoInput,
  onRegenerate,
  onDismiss,
}: {
  draft: string;
  escalated: boolean;
  generatedAt: string | null;
  busy: 'approve' | 'regen' | 'dismiss' | null;
  compact?: boolean;
  onApprove: (text: string) => void;
  onEditIntoInput: (text: string) => void;
  onRegenerate: () => void;
  onDismiss: () => void;
}) {
  const [edited, setEdited] = useState(draft);
  // Reset local edit buffer whenever the underlying draft changes (e.g. after regen).
  useEffect(() => { setEdited(draft); }, [draft]);

  return (
    <div className={`mx-3 ${compact ? 'mb-3' : 'mt-3 mb-0'} rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 to-amber-500/5 p-3`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-xs font-medium text-gold uppercase tracking-wider">Replymind suggests</span>
          {generatedAt && (
            <span className="text-[10px] text-white/40">
              · {new Date(generatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        {escalated && (
          <span className="inline-flex items-center gap-1 text-xs text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-full" title="Sensitive content detected — review carefully before sending">
            <AlertTriangle className="w-3 h-3" /> Review
          </span>
        )}
      </div>
      <textarea
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
        rows={Math.max(2, Math.ceil(edited.length / 60))}
        maxLength={1000}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60 resize-y"
        dir="auto"
      />
      <div className="flex flex-wrap gap-2 mt-2">
        <Button
          size="sm"
          onClick={() => onApprove(edited.trim())}
          disabled={Boolean(busy) || edited.trim().length === 0}
          className="bg-gold text-black hover:bg-gold/90"
        >
          <Check className="w-3.5 h-3.5 me-1" />
          {busy === 'approve' ? 'Sending…' : 'Approve & send'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEditIntoInput(edited)}
          disabled={Boolean(busy)}
          className="border-white/20 text-white hover:bg-white/10 hover:text-white"
        >
          Move to input
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRegenerate}
          disabled={Boolean(busy)}
          className="border-white/20 text-white hover:bg-white/10 hover:text-white"
        >
          <RotateCw className={`w-3.5 h-3.5 me-1 ${busy === 'regen' ? 'animate-spin' : ''}`} />
          {busy === 'regen' ? 'Regenerating…' : 'Regenerate'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          disabled={Boolean(busy)}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-white/50 mb-1">{label}</div>
      <div className="text-sm font-mono text-white">{value}</div>
    </div>
  );
}
