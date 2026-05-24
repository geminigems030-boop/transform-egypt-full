import { useEffect, useState, useCallback } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall,
  Loader2, RefreshCw, ChevronDown, ChevronUp, Plus, Pause, Play,
  Trash2, Users, CheckCircle, XCircle, Clock, BarChart3, X,
  AlertTriangle, Upload, MessageCircle, Search, Zap, ExternalLink,
  CheckSquare, Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface YaraCall {
  id: number;
  phone: string;
  direction: 'inbound' | 'outbound' | 'campaign';
  campaignId: number | null;
  twilioCallSid: string | null;
  elevenLabsConvId: string | null;
  status: string;
  duration: number | null;
  language: string | null;
  transcript: string | null;
  summary: string | null;
  bookingIntent: string | null;
  submissionId: number | null;
  createdAt: string;
}

interface CallStats {
  totalCallsThisWeek: number;
  bookingsFromCalls: number;
  answerRate: number;
  directionBreakdown: Record<string, number>;
}

interface CallCampaign {
  id: number;
  name: string;
  pitchGoal: string;
  status: string;
  callLimitPerDay: number;
  totalContacts: number;
  calledCount: number;
  answeredCount: number;
  interestedCount: number;
  bookedCount: number;
  createdAt: string;
}

interface CampaignContact {
  id: number;
  campaignId: number;
  phone: string;
  name: string | null;
  status: string;
  callId: number | null;
  attempts: number;
  createdAt: string;
}

interface CrmClient {
  id: number;
  name: string | null;
  phone: string;
  preferredBranch: string | null;
  lastVisit: string | null;
  visitCount: number;
}

interface WhatsAppSetup {
  configured: boolean;
  agentId?: string;
  agentName?: string;
  dashboardUrl?: string;
  setupSteps?: { step: number; title: string; detail: string }[];
  reason?: string;
}

type SubTab = 'log' | 'campaigns' | 'batch' | 'whatsapp';

// ── Status badges ─────────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-500/15 text-emerald-400';
    case 'in-progress': return 'bg-blue-500/15 text-blue-400';
    case 'ringing': return 'bg-amber-500/15 text-amber-400';
    case 'no-answer': return 'bg-white/10 text-white/40';
    case 'failed': return 'bg-rose-500/15 text-rose-400';
    case 'voicemail': return 'bg-violet-500/15 text-violet-400';
    case 'active': return 'bg-emerald-500/15 text-emerald-400';
    case 'paused': return 'bg-amber-500/15 text-amber-400';
    case 'draft': return 'bg-white/10 text-white/50';
    case 'completed_camp': return 'bg-emerald-500/15 text-emerald-400';
    case 'cancelled': return 'bg-rose-500/15 text-rose-400';
    default: return 'bg-white/10 text-white/40';
  }
}

function directionIcon(dir: string) {
  if (dir === 'inbound') return <PhoneIncoming className="w-3.5 h-3.5 text-blue-400" />;
  if (dir === 'outbound') return <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400" />;
  return <PhoneCall className="w-3.5 h-3.5 text-violet-400" />;
}

function fmtDuration(secs: number | null): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function fmtDate(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CallsPanel({ token }: { token: string }) {
  const [subTab, setSubTab] = useState<SubTab>('log');
  const headers = { 'X-Admin-Token': token };

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'log', label: 'Call Log', icon: <Phone className="w-3.5 h-3.5" /> },
    { key: 'campaigns', label: 'Cold Calling', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'batch', label: 'Batch Call CRM', icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'whatsapp', label: 'WhatsApp AI', icon: <MessageCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div>
      <div className="flex items-center gap-0.5 mb-6 border-b border-white/10 -mt-2 pb-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors -mb-px whitespace-nowrap ${subTab === t.key ? 'border-gold text-gold' : 'border-transparent text-white/50 hover:text-white'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'log' && <CallLogTab headers={headers} />}
      {subTab === 'campaigns' && <CampaignsTab headers={headers} />}
      {subTab === 'batch' && <BatchCallTab headers={headers} />}
      {subTab === 'whatsapp' && <WhatsAppSetupTab headers={headers} />}
    </div>
  );
}

// ── Call Log Tab ──────────────────────────────────────────────────────────────

function CallLogTab({ headers }: { headers: Record<string, string> }) {
  const [calls, setCalls] = useState<YaraCall[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const qs = direction ? `?direction=${direction}` : '';
      const [callsRes, statsRes] = await Promise.all([
        fetch(`/api/admin/calls${qs}`, { headers }),
        fetch('/api/admin/calls/stats', { headers }),
      ]);
      const callsData = await callsRes.json();
      const statsData = await statsRes.json();
      setCalls(callsData.calls ?? []);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [direction]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox icon={<Phone className="w-4 h-4" />} label="Calls This Week" value={String(stats.totalCallsThisWeek)} />
          <StatBox icon={<CheckCircle className="w-4 h-4" />} label="Bookings from Calls" value={String(stats.bookingsFromCalls)} highlight />
          <StatBox icon={<BarChart3 className="w-4 h-4" />} label="Answer Rate" value={`${stats.answerRate}%`} />
          <StatBox icon={<PhoneIncoming className="w-4 h-4" />} label="Inbound" value={String(stats.directionBreakdown['inbound'] ?? 0)} />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
          {['', 'inbound', 'outbound', 'campaign'].map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${direction === d ? 'bg-gold text-black' : 'text-white/50 hover:text-white'}`}
            >
              {d === '' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={load} className="text-white/40 hover:text-white text-xs flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin me-2" /> Loading calls…
        </div>
      ) : calls.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-white/40">
          <Phone className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No calls yet.</p>
          <p className="text-xs mt-1 text-white/30">
            Inbound calls appear here when customers call the salon's Twilio number.
            Outbound calls appear when you click the Call button on a lead.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left px-4 py-3">Direction</th>
                <th className="text-left px-4 py-3">Number</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Lang</th>
                <th className="text-left px-4 py-3">Booking</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <>
                  <tr key={call.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {directionIcon(call.direction)}
                        <span className="text-xs text-white/60 capitalize">{call.direction}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/80 text-xs">{call.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(call.status)}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">{fmtDuration(call.duration)}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{call.language?.toUpperCase() ?? '—'}</td>
                    <td className="px-4 py-3">
                      {call.bookingIntent === 'captured' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Captured</span>
                      ) : (
                        <span className="text-xs text-white/25">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">{fmtDate(call.createdAt)}</td>
                    <td className="px-4 py-3">
                      {(call.transcript || call.summary) && (
                        <button onClick={() => toggleExpand(call.id)} className="text-white/30 hover:text-white">
                          {expanded.has(call.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded.has(call.id) && (call.transcript || call.summary) && (
                    <tr key={`${call.id}-exp`} className="border-b border-white/5 bg-black/20">
                      <td colSpan={8} className="px-4 py-4 space-y-3">
                        {call.summary && (
                          <div>
                            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Summary</p>
                            <p className="text-sm text-white/80 leading-relaxed">{call.summary}</p>
                          </div>
                        )}
                        {call.transcript && (
                          <div>
                            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Transcript</p>
                            <pre className="text-xs text-white/60 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto bg-black/30 rounded p-3">
                              {call.transcript}
                            </pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Batch Call from CRM Tab ───────────────────────────────────────────────────

function BatchCallTab({ headers }: { headers: Record<string, string> }) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [campaignName, setCampaignName] = useState('');
  const [pitchGoal, setPitchGoal] = useState('');
  const [limitPerDay, setLimitPerDay] = useState('30');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/admin/calls/crm-clients${qs}`, { headers });
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch {
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { void fetchClients(); }, 300);
    return () => clearTimeout(t);
  }, [fetchClients]);

  const toggleAll = () => {
    if (selected.size === clients.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(clients.map((c) => c.id)));
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const createBatchCampaign = async () => {
    if (!campaignName || !pitchGoal || selected.size === 0) return;
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const selectedClients = clients.filter((c) => selected.has(c.id));
      const contacts = selectedClients.map((c) => ({
        name: c.name ?? undefined,
        phone: c.phone,
      }));

      const res = await fetch('/api/admin/calls/campaigns', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          pitchGoal,
          callLimitPerDay: Number(limitPerDay),
          contacts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create campaign');

      setSuccess(`Campaign created with ${contacts.length} clients. Go to the Cold Calling tab to start it.`);
      setSelected(new Set());
      setCampaignName('');
      setPitchGoal('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-medium text-white mb-1">Batch Call from CRM</h2>
        <p className="text-xs text-white/40">
          Select clients from your CRM, set a pitch goal, and Yara will call all of them automatically — one at a time, respecting the daily limit.
        </p>
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 text-sm">{error}</div>}
      {success && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 p-4 text-sm flex items-start gap-2">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {/* Campaign config */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h3 className="text-sm font-medium text-white/80">Campaign Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Campaign Name</label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Summer Reactivation"
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Calls Per Day Limit</label>
            <input
              type="number" min={1} max={200}
              value={limitPerDay}
              onChange={(e) => setLimitPerDay(e.target.value)}
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">
            What should Yara say?
          </label>
          <textarea
            value={pitchGoal}
            onChange={(e) => setPitchGoal(e.target.value)}
            placeholder="e.g. Check in with clients we haven't seen in 3 months. Mention our new autumn hair extension collection. Offer a 10% loyalty discount. Goal is to get them to book an appointment."
            rows={3}
            className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm resize-none"
          />
        </div>
      </div>

      {/* Client picker */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white outline-none focus:border-gold placeholder:text-white/30"
            />
          </div>
          <span className="text-xs text-white/40 whitespace-nowrap">
            {selected.size} selected
          </span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
              <th className="px-4 py-3 w-10">
                <button onClick={toggleAll} className="text-white/40 hover:text-gold transition-colors">
                  {selected.size > 0 && selected.size === clients.length
                    ? <CheckSquare className="w-4 h-4 text-gold" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Branch</th>
              <th className="text-left px-4 py-3">Last Visit</th>
              <th className="text-left px-4 py-3">Visits</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/30 text-sm">
                  No clients found. Import clients from the CRM tab first.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`border-b border-white/5 cursor-pointer transition-colors ${selected.has(c.id) ? 'bg-gold/10' : 'hover:bg-white/5'}`}
                >
                  <td className="px-4 py-3">
                    {selected.has(c.id)
                      ? <CheckSquare className="w-4 h-4 text-gold" />
                      : <Square className="w-4 h-4 text-white/20" />}
                  </td>
                  <td className="px-4 py-3 text-white/80">{c.name ?? <span className="text-white/25">—</span>}</td>
                  <td className="px-4 py-3 font-mono text-white/60 text-xs">{c.phone}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{c.preferredBranch ?? '—'}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">{fmtDate(c.lastVisit)}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">{c.visitCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Launch button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={createBatchCampaign}
          disabled={creating || selected.size === 0 || !campaignName || !pitchGoal}
          className="bg-gold text-black hover:bg-gold/90 disabled:opacity-50"
        >
          {creating
            ? <><Loader2 className="w-4 h-4 me-1.5 animate-spin" /> Creating campaign…</>
            : <><Zap className="w-4 h-4 me-1.5" /> Create Campaign ({selected.size} clients)</>}
        </Button>
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())} className="text-xs text-white/40 hover:text-white flex items-center gap-1">
            <X className="w-3 h-3" /> Clear selection
          </button>
        )}
      </div>
      <p className="text-xs text-white/30">
        After creating, go to the <span className="text-gold">Cold Calling</span> tab to start the campaign. Yara will call each client one at a time.
      </p>
    </div>
  );
}

// ── ElevenLabs WhatsApp Setup Tab ─────────────────────────────────────────────

function WhatsAppSetupTab({ headers }: { headers: Record<string, string> }) {
  const [setup, setSetup] = useState<WhatsAppSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/admin/calls/whatsapp-setup', { headers })
      .then((r) => r.json())
      .then((d) => setSetup(d as WhatsAppSetup))
      .catch(() => setSetup({ configured: false, reason: 'Could not connect to server' }))
      .finally(() => setLoading(false));
  }, []);

  const toggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin me-2" /> Checking ElevenLabs…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="font-medium text-white mb-1">Yara on WhatsApp</h2>
        <p className="text-xs text-white/40">
          Connect Yara's AI agent directly to a WhatsApp number so she handles every incoming WhatsApp message — fully bilingual, 24/7, with appointment booking capability.
        </p>
      </div>

      {/* Status banner */}
      {setup?.configured ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Yara agent is ready</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              Agent: <span className="font-mono">{setup.agentName}</span>
            </p>
            <p className="text-xs text-emerald-400/70">
              ID: <span className="font-mono text-xs">{setup.agentId}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">ElevenLabs not configured</p>
            <p className="text-xs text-amber-400/70 mt-0.5">{setup?.reason}</p>
          </div>
        </div>
      )}

      {/* What you get */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-medium text-white/80 mb-4">What Yara does on WhatsApp</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Answers in Arabic & English', sub: 'Detects language automatically' },
            { label: 'Books appointments', sub: 'Captures name, service, date, branch' },
            { label: 'Answers service questions', sub: 'Prices, hair extensions, treatments' },
            { label: 'Escalates when needed', sub: 'Notifies the team on complex queries' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-gold mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-white/80">{item.label}</p>
                <p className="text-xs text-white/35">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Setup steps */}
      {setup?.configured && setup.setupSteps && (
        <div>
          <h3 className="text-sm font-medium text-white/80 mb-4">Setup Checklist</h3>
          <div className="space-y-3">
            {setup.setupSteps.map((s) => (
              <div
                key={s.step}
                onClick={() => toggleStep(s.step)}
                className={`rounded-xl border px-5 py-4 cursor-pointer transition-colors ${completedSteps.has(s.step) ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${completedSteps.has(s.step) ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/50'}`}>
                    {completedSteps.has(s.step) ? '✓' : s.step}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${completedSteps.has(s.step) ? 'text-emerald-300 line-through decoration-emerald-500/50' : 'text-white'}`}>
                      {s.title}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Important note on plan */}
      <div className="rounded-xl border border-white/10 bg-black/30 px-5 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-white/80 mb-1">ElevenLabs Plan Note</p>
            <p className="text-xs text-white/50 leading-relaxed">
              WhatsApp deployment requires your ElevenLabs workspace to be verified with Meta as a WhatsApp Business partner.
              This is done inside the ElevenLabs dashboard under <span className="text-white/70">Deploy → WhatsApp</span>.
              You may need to upgrade your plan if the WhatsApp option is not visible yet.
            </p>
          </div>
        </div>
      </div>

      {/* Batch calling note */}
      <div className="rounded-xl border border-white/10 bg-black/30 px-5 py-4">
        <div className="flex items-start gap-3">
          <Zap className="w-4 h-4 text-gold mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-white/80 mb-1">ElevenLabs Native Batch Calling</p>
            <p className="text-xs text-white/50 leading-relaxed">
              The ElevenLabs dashboard (Deploy → Outbound → Batch Calling) can provision phone numbers and run bulk outbound calls without Twilio.
              This requires a higher ElevenLabs plan. In the meantime, use the <span className="text-gold">Batch Call CRM</span> tab to run batch campaigns through the existing Twilio integration.
            </p>
          </div>
        </div>
      </div>

      {/* Open dashboard link */}
      {setup?.configured && (
        <a
          href={setup.dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 bg-gold text-black text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gold/90 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open ElevenLabs Dashboard
        </a>
      )}
    </div>
  );
}

// ── Cold Calling Campaigns Tab ────────────────────────────────────────────────

function CampaignsTab({ headers }: { headers: Record<string, string> }) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [campaigns, setCampaigns] = useState<CallCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CallCampaign | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string>('');

  // Create form
  const [formName, setFormName] = useState('');
  const [formGoal, setFormGoal] = useState('');
  const [formLimit, setFormLimit] = useState('20');
  const [formContacts, setFormContacts] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/calls/campaigns', { headers });
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } catch {
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/calls/campaigns/${id}/contacts`, { headers });
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } catch {
      setError('Failed to load contacts');
    }
  };

  useEffect(() => { void fetchCampaigns(); }, []);

  const createCampaign = async () => {
    if (!formName || !formGoal || !formContacts.trim()) return;
    setCreating(true);
    setError('');
    try {
      const lines = formContacts.split('\n').map((l) => l.trim()).filter(Boolean);
      const contacts = lines.map((line) => {
        const parts = line.split(/[,\t]/).map((p) => p.trim());
        if (parts.length >= 2) return { name: parts[0], phone: parts[1]! };
        return { phone: parts[0]! };
      });

      const res = await fetch('/api/admin/calls/campaigns', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, pitchGoal: formGoal, callLimitPerDay: Number(formLimit), contacts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Create failed');

      await fetchCampaigns();
      setView('list');
      setFormName(''); setFormGoal(''); setFormContacts(''); setFormLimit('20');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startCampaign = async (id: number) => {
    setActionLoading(`start-${id}`);
    setError('');
    try {
      const res = await fetch(`/api/admin/calls/campaigns/${id}/start`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Start failed');
      await fetchCampaigns();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading('');
    }
  };

  const pauseCampaign = async (id: number) => {
    setActionLoading(`pause-${id}`);
    try {
      await fetch(`/api/admin/calls/campaigns/${id}/pause`, { method: 'POST', headers });
      await fetchCampaigns();
    } catch {
      setError('Failed to pause');
    } finally {
      setActionLoading('');
    }
  };

  const deleteCampaign = async (id: number) => {
    if (!confirm('Delete this campaign and all its contacts?')) return;
    setActionLoading(`del-${id}`);
    try {
      await fetch(`/api/admin/calls/campaigns/${id}`, { method: 'DELETE', headers });
      await fetchCampaigns();
      if (selected?.id === id) { setView('list'); setSelected(null); }
    } catch {
      setError('Failed to delete');
    } finally {
      setActionLoading('');
    }
  };

  if (view === 'detail' && selected) {
    const convRate = selected.calledCount > 0
      ? Math.round((selected.bookedCount / selected.calledCount) * 100)
      : 0;

    return (
      <div>
        <button onClick={() => setView('list')} className="text-white/60 hover:text-white text-sm flex items-center gap-1 mb-6">
          ← Back to campaigns
        </button>
        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 mb-6 text-sm">{error}</div>}

        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="font-serif text-xl">{selected.name}</h2>
            <p className="text-sm text-white/50 mt-1 max-w-2xl">{selected.pitchGoal}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(selected.status)}`}>{selected.status}</span>
              <span className="text-xs text-white/40">Limit: {selected.callLimitPerDay}/day</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.status === 'active' ? (
              <Button onClick={() => pauseCampaign(selected.id)} disabled={actionLoading === `pause-${selected.id}`} variant="outline" className="border-white/20 text-white hover:bg-white/10" size="sm">
                {actionLoading === `pause-${selected.id}` ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <Pause className="w-4 h-4 me-1.5" />} Pause
              </Button>
            ) : selected.status !== 'completed' && selected.status !== 'cancelled' ? (
              <Button onClick={() => startCampaign(selected.id)} disabled={actionLoading === `start-${selected.id}`} className="bg-gold text-black hover:bg-gold/90" size="sm">
                {actionLoading === `start-${selected.id}` ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <Play className="w-4 h-4 me-1.5" />}
                {selected.status === 'paused' ? 'Resume' : 'Start'} Campaign
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatBox icon={<Users className="w-4 h-4" />} label="Total Contacts" value={String(selected.totalContacts)} />
          <StatBox icon={<PhoneCall className="w-4 h-4" />} label="Called" value={String(selected.calledCount)} />
          <StatBox icon={<CheckCircle className="w-4 h-4" />} label="Answered" value={String(selected.answeredCount)} />
          <StatBox icon={<BarChart3 className="w-4 h-4" />} label="Interested" value={String(selected.interestedCount)} highlight />
          <StatBox icon={<Phone className="w-4 h-4" />} label="Booked" value={String(selected.bookedCount)} highlight />
        </div>
        {selected.calledCount > 0 && (
          <p className="text-xs text-white/40 mb-6">Conversion rate: {convRate}% booked from calls made</p>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Campaign Contacts</h3>
          <button onClick={() => fetchContacts(selected.id)} className="text-white/40 hover:text-white text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Load contacts
          </button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Attempts</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30 text-xs">Click "Load contacts" to view the contact list.</td></tr>
              ) : contacts.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white/80">{c.name ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-white/60 text-xs">{c.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${contactStatusBadge(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">{c.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div>
        <button onClick={() => { setView('list'); setError(''); }} className="text-white/60 hover:text-white text-sm flex items-center gap-1 mb-6">← Back</button>
        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 mb-6 text-sm">{error}</div>}
        <h2 className="font-serif text-xl mb-6">New Cold Calling Campaign</h2>
        <div className="max-w-2xl space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Campaign Name</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Summer Hair Extension Promo"
              className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">
              Pitch Goal <span className="text-white/30 normal-case ms-2">— what should Yara pitch on this call?</span>
            </label>
            <textarea value={formGoal} onChange={(e) => setFormGoal(e.target.value)}
              placeholder="e.g. Promote our summer hair extension offer — 60cm Indian hair at 11,000 EGP. Goal is to get them to book a free consultation."
              rows={3} className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Daily Call Limit</label>
            <input type="number" min={1} max={200} value={formLimit} onChange={(e) => setFormLimit(e.target.value)}
              className="w-32 bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm" />
            <p className="text-xs text-white/30 mt-1">Max calls Yara makes per day for this campaign.</p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">
              Contact List <span className="text-white/30 normal-case ms-2">— one per line. Format: "Name, Phone" or just a phone number.</span>
            </label>
            <textarea value={formContacts} onChange={(e) => setFormContacts(e.target.value)}
              placeholder={"Nour, +201012345678\n+201098765432\nSarah, 01009999999"}
              rows={8} className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm font-mono resize-none" />
            <p className="text-xs text-white/30 mt-1">{formContacts.split('\n').filter((l) => l.trim()).length} contact(s) detected</p>
          </div>
          <div className="pt-2">
            <Button onClick={createCampaign} disabled={creating || !formName || !formGoal || !formContacts.trim()} className="bg-gold text-black hover:bg-gold/90 disabled:opacity-50">
              {creating ? <><Loader2 className="w-4 h-4 me-1.5 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4 me-1.5" /> Create Campaign</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 mb-6 text-sm">{error}</div>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-medium text-white">Cold Calling Campaigns</h2>
          <p className="text-xs text-white/40 mt-0.5">Yara calls contacts automatically, pitches your offer, and logs each outcome.</p>
        </div>
        <Button onClick={() => { setView('create'); setError(''); }} className="bg-gold text-black hover:bg-gold/90" size="sm">
          <Plus className="w-4 h-4 me-1.5" /> New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40"><Loader2 className="w-5 h-5 animate-spin me-2" /> Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
          <PhoneCall className="w-8 h-8 mx-auto mb-3 text-white/20" />
          <p className="text-sm text-white/50">No cold calling campaigns yet.</p>
          <p className="text-xs text-white/30 mt-1">Create a campaign to have Yara automatically call a list of prospects.</p>
          <Button onClick={() => setView('create')} className="bg-gold text-black hover:bg-gold/90 mt-4" size="sm">
            <Plus className="w-4 h-4 me-1.5" /> Create First Campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((camp) => {
            const convRate = camp.calledCount > 0 ? Math.round((camp.bookedCount / camp.calledCount) * 100) : 0;
            return (
              <div key={camp.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-white">{camp.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(camp.status)}`}>{camp.status}</span>
                    </div>
                    <p className="text-xs text-white/40 line-clamp-1 mb-2">{camp.pitchGoal}</p>
                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <span>{camp.totalContacts} contacts</span>
                      <span>{camp.calledCount} called</span>
                      <span>{camp.bookedCount} booked</span>
                      {camp.calledCount > 0 && <span className="text-gold">{convRate}% conversion</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setSelected(camp); setView('detail'); fetchContacts(camp.id); }}
                      className="text-xs text-white/50 hover:text-white px-2 py-1 border border-white/15 rounded">Details</button>
                    {camp.status === 'active' ? (
                      <button onClick={() => pauseCampaign(camp.id)} disabled={actionLoading === `pause-${camp.id}`}
                        className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 border border-amber-400/30 rounded flex items-center gap-1">
                        {actionLoading === `pause-${camp.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />} Pause
                      </button>
                    ) : camp.status !== 'completed' && camp.status !== 'cancelled' ? (
                      <button onClick={() => startCampaign(camp.id)} disabled={actionLoading === `start-${camp.id}`}
                        className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 border border-emerald-400/30 rounded flex items-center gap-1">
                        {actionLoading === `start-${camp.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        {camp.status === 'paused' ? 'Resume' : 'Start'}
                      </button>
                    ) : null}
                    <button onClick={() => deleteCampaign(camp.id)} disabled={actionLoading === `del-${camp.id}`} className="text-white/20 hover:text-rose-400 p-1">
                      {actionLoading === `del-${camp.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactStatusBadge(status: string): string {
  switch (status) {
    case 'booked': return 'bg-emerald-500/15 text-emerald-400';
    case 'interested': return 'bg-blue-500/15 text-blue-400';
    case 'calling': return 'bg-amber-500/15 text-amber-400';
    case 'answered': return 'bg-emerald-500/10 text-emerald-300';
    case 'not-interested': return 'bg-rose-500/15 text-rose-400';
    case 'no-answer': return 'bg-white/10 text-white/40';
    case 'callback-requested': return 'bg-violet-500/15 text-violet-400';
    case 'failed': return 'bg-rose-500/15 text-rose-400';
    default: return 'bg-white/10 text-white/50';
  }
}

function StatBox({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className={`flex items-center gap-1.5 text-xs mb-1 ${highlight ? 'text-gold' : 'text-white/40'}`}>
        {icon} {label}
      </div>
      <div className={`text-xl font-semibold ${highlight ? 'text-gold' : 'text-white'}`}>{value}</div>
    </div>
  );
}
