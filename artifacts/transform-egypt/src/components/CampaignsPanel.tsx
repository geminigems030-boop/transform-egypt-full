import { useEffect, useState } from 'react';
import {
  Zap, Users, Send, Mail, MessageSquare, Loader2, ChevronRight, Clock, BarChart3,
  CheckCircle, AlertTriangle, Brain, X, ArrowLeft, RefreshCw, Filter, Play, Plus,
  Download, Instagram, Facebook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SegmentPreview {
  segment: string;
  count: number;
  avgScore: number;
  topLead: SegmentedLead | null;
}

interface SegmentedLead {
  sourceTable: string;
  sourceId: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  segment: string;
  score: number;
  reason: string;
}

interface Campaign {
  id: number;
  name: string;
  segment: string;
  channel: 'email' | 'dm';
  status: string;
  totalLeads: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  scheduledAt: string | null;
  leadStats: Record<string, number>;
}

interface CampaignLead {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  leadScore: number;
  personalizedSubject: string | null;
  personalizedBody: string | null;
  sentAt: string | null;
  errorMessage: string | null;
}

const SEGMENT_LABELS: Record<string, string> = {
  no_booking: 'No Booking (Form submits)',
  lucky_spin: 'Lucky Spin Winners',
  warm_dm: 'Warm DMs (no booking)',
  post_booking: 'Post-Booking Re-engage',
  newsletter: 'Newsletter Opt-ins',
  abandoned_cart: 'Abandoned Carts',
};

const SEGMENT_ICONS: Record<string, React.ReactNode> = {
  no_booking: <Mail className="w-4 h-4" />,
  lucky_spin: <Zap className="w-4 h-4" />,
  warm_dm: <MessageSquare className="w-4 h-4" />,
  post_booking: <Users className="w-4 h-4" />,
  newsletter: <Mail className="w-4 h-4" />,
  abandoned_cart: <Zap className="w-4 h-4" />,
};

export default function CampaignsPanel({ token }: { token: string }) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [segments, setSegments] = useState<SegmentPreview[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create form state
  const [formName, setFormName] = useState('');
  const [formSegment, setFormSegment] = useState('no_booking');
  const [formChannel, setFormChannel] = useState<'email' | 'dm'>('email');
  const [formScheduled, setFormScheduled] = useState('');
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ campaign: Campaign; leadsAdded: number } | null>(null);

  // Action states
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  // Historical import state
  const [importPlatform, setImportPlatform] = useState<'instagram' | 'messenger' | 'both'>('both');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ conversations: number; messages: number; newContacts: number; errors: number } | null>(null);
  const [importError, setImportError] = useState('');

  const headers = { 'X-Admin-Token': token };

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns/segments', { headers });
      const data = await res.json();
      setSegments(data.segments ?? []);
    } catch (e) {
      setError('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns', { headers });
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } catch (e) {
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignLeads = async (campaignId: number) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/leads`, { headers });
      const data = await res.json();
      setCampaignLeads(data.leads ?? []);
    } catch (e) {
      setError('Failed to load campaign leads');
    }
  };

  const createCampaign = async () => {
    if (!formName) return;
    setCreating(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: formName,
        segment: formSegment,
        channel: formChannel,
      };
      if (formScheduled) body.scheduledAt = new Date(formScheduled).toISOString();
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setCreateResult(data);
      await fetchCampaigns();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const generateCopy = async (campaignId: number) => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      if (selectedCampaign) await fetchCampaignLeads(selectedCampaign.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const sendCampaign = async (campaignId: number) => {
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      await fetchCampaigns();
      if (selectedCampaign) await fetchCampaignLeads(selectedCampaign.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const runImport = async () => {
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await fetch('/api/admin/import/historical-dms', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: importPlatform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data.stats);
      await fetchSegments();
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    void fetchSegments();
    void fetchCampaigns();
  }, []);

  // ── Create view ─────────────────────────────────────────
  if (view === 'create') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setView('list'); setCreateResult(null); setError(''); }} className="text-white/60 hover:text-white text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to campaigns
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 mb-6 text-sm">{error}</div>
        )}

        {createResult ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-emerald-200 mb-1">Campaign created!</h3>
            <p className="text-sm text-emerald-300/80 mb-4">
              "{createResult.campaign.name}" with {createResult.leadsAdded} lead{createResult.leadsAdded !== 1 ? 's' : ''} added.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => { setSelectedCampaign(createResult.campaign); setView('detail'); }} className="bg-gold text-black hover:bg-gold/90">
                View Campaign
              </Button>
              <Button onClick={() => { setCreateResult(null); setFormName(''); setFormScheduled(''); }} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Create Another
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <h2 className="font-serif text-xl mb-6">New Re-engagement Campaign</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Campaign Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. May No-Booking Re-engage"
                  className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Lead Segment</label>
                  <select
                    value={formSegment}
                    onChange={(e) => setFormSegment(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm"
                  >
                    {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Channel</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormChannel('email')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${formChannel === 'email' ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/60 hover:text-white'}`}
                    >
                      <Mail className="w-4 h-4" /> Email
                    </button>
                    <button
                      onClick={() => setFormChannel('dm')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${formChannel === 'dm' ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/60 hover:text-white'}`}
                    >
                      <MessageSquare className="w-4 h-4" /> DM
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={formScheduled}
                  onChange={(e) => setFormScheduled(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 focus:border-gold rounded-lg px-3 py-2 text-white outline-none text-sm"
                />
                <p className="text-xs text-white/30 mt-1">Leave empty to save as draft.</p>
              </div>

              {/* Segment preview */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gold" /> Segment Preview
                </h4>
                {segments.length === 0 ? (
                  <p className="text-sm text-white/40">Loading segments...</p>
                ) : (
                  <div className="space-y-2">
                    {segments
                      .filter((s) => s.segment === formSegment)
                      .map((s) => (
                        <div key={s.segment} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-white/80">
                            {SEGMENT_ICONS[s.segment]}
                            {SEGMENT_LABELS[s.segment]}
                          </div>
                          <div className="flex items-center gap-4 text-white/60">
                            <span>{s.count} leads</span>
                            <span>avg score {s.avgScore}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  onClick={createCampaign}
                  disabled={creating || !formName}
                  className="bg-gold text-black hover:bg-gold/90 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Zap className="w-4 h-4 me-2" />}
                  Create Campaign
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────
  if (view === 'detail' && selectedCampaign) {
    const pending = campaignLeads.filter((l) => l.status === 'pending').length;
    const sent = campaignLeads.filter((l) => l.status === 'sent').length;
    const failed = campaignLeads.filter((l) => l.status === 'failed').length;

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-white/60 hover:text-white text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 mb-6 text-sm">{error}</div>
        )}

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-serif text-xl">{selectedCampaign.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
              <span className="flex items-center gap-1">{SEGMENT_ICONS[selectedCampaign.segment]} {SEGMENT_LABELS[selectedCampaign.segment]}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="flex items-center gap-1">{selectedCampaign.channel === 'email' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />} {selectedCampaign.channel}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className={`px-2 py-0.5 rounded text-xs ${selectedCampaign.status === 'running' ? 'bg-emerald-500/15 text-emerald-400' : selectedCampaign.status === 'scheduled' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/10 text-white/60'}`}>
                {selectedCampaign.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => generateCopy(selectedCampaign.id)}
              disabled={generating || pending === 0}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:text-white"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Brain className="w-4 h-4 me-2" />}
              AI Generate Copy
            </Button>
            <Button
              onClick={() => sendCampaign(selectedCampaign.id)}
              disabled={sending || pending === 0}
              className="bg-gold text-black hover:bg-gold/90"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Send className="w-4 h-4 me-2" />}
              Send {pending > 0 ? `(${pending})` : ''}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatBox icon={<Users className="w-4 h-4" />} label="Total leads" value={String(selectedCampaign.totalLeads)} />
          <StatBox icon={<Clock className="w-4 h-4" />} label="Pending" value={String(pending)} />
          <StatBox icon={<CheckCircle className="w-4 h-4" />} label="Sent" value={String(sent)} highlight />
          <StatBox icon={<AlertTriangle className="w-4 h-4" />} label="Failed" value={String(failed)} />
        </div>

        {/* Leads table */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-medium">Campaign Leads</h3>
            <button onClick={() => fetchCampaignLeads(selectedCampaign.id)} className="text-white/40 hover:text-white text-xs flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Contact</th>
                  <th className="text-left px-4 py-2">Score</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Subject / Preview</th>
                </tr>
              </thead>
              <tbody>
                {campaignLeads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-white/40">No leads loaded. Click Refresh.</td>
                  </tr>
                )}
                {campaignLeads.map((cl) => (
                  <tr key={cl.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white/80">{cl.name ?? '—'}</td>
                    <td className="px-4 py-3 text-white/60">
                      {cl.email && <div className="text-xs">{cl.email}</div>}
                      {cl.phone && <div className="text-xs">{cl.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cl.leadScore >= 80 ? 'bg-rose-500/15 text-rose-400' : cl.leadScore >= 60 ? 'bg-amber-500/15 text-amber-400' : 'bg-white/10 text-white/60'}`}>
                        {cl.leadScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cl.status === 'sent' ? 'bg-emerald-500/15 text-emerald-400' : cl.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-white/10 text-white/60'}`}>
                        {cl.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60 max-w-xs truncate">
                      {cl.personalizedSubject ?? cl.personalizedBody ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── List view (default) ─────────────────────────────────
  return (
    <div>
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 mb-6 text-sm">{error}</div>
      )}

      {/* Historical Import Card */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-white">Import Previous Contacts</h3>
            <p className="text-xs text-white/50 mt-0.5">Pull all historical DMs from Instagram and/or Facebook into the lead pool. Safe to re-run — duplicates are skipped automatically.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-xs text-white/50 uppercase tracking-wider">Source:</span>
          {(['instagram', 'messenger', 'both'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setImportPlatform(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${importPlatform === p ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/60 hover:text-white'}`}
            >
              {p === 'instagram' && <Instagram className="w-3 h-3" />}
              {p === 'messenger' && <Facebook className="w-3 h-3" />}
              {p === 'both' && <><Instagram className="w-3 h-3" /><Facebook className="w-3 h-3" /></>}
              {p === 'instagram' ? 'Instagram' : p === 'messenger' ? 'Facebook' : 'Both'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={runImport}
            disabled={importing}
            className="bg-violet-600 hover:bg-violet-500 text-white"
            size="sm"
          >
            {importing ? (
              <><Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> Importing — this may take a minute…</>
            ) : (
              <><Download className="w-3.5 h-3.5 me-1.5" /> Run Historical Import</>
            )}
          </Button>
        </div>

        {importError && (
          <div className="mt-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2">
            {importError}
          </div>
        )}

        {importResult && (
          <div className="mt-3 text-xs text-white/70 bg-emerald-500/5 border border-emerald-500/20 rounded px-3 py-2 leading-relaxed">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline me-1.5" />
            Scanned <strong className="text-white">{importResult.conversations}</strong> conversations,{' '}
            <strong className="text-white">{importResult.messages}</strong> messages found.{' '}
            <strong className="text-emerald-300">{importResult.newContacts}</strong> contacts added to lead pool.
            {importResult.errors > 0 && (
              <span className="text-rose-300 ms-1">({importResult.errors} non-fatal errors — check server logs.)</span>
            )}
          </div>
        )}
      </div>

      {/* Segments overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {segments.map((seg) => (
          <div
            key={seg.segment}
            className="rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer hover:border-gold/40 transition-colors"
            onClick={() => { setFormSegment(seg.segment); setView('create'); }}
          >
            <div className="flex items-center gap-2 text-gold mb-2">
              {SEGMENT_ICONS[seg.segment]}
              <span className="text-xs font-medium uppercase tracking-wider">{SEGMENT_LABELS[seg.segment]}</span>
            </div>
            <div className="text-2xl font-serif">{seg.count}</div>
            <div className="text-xs text-white/40 mt-1">avg score {seg.avgScore}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl">Campaigns</h2>
        <Button onClick={() => setView('create')} className="bg-gold text-black hover:bg-gold/90">
          <Plus className="w-4 h-4 me-2" /> New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>No campaigns yet. Create your first re-engagement campaign above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors"
              onClick={() => { setSelectedCampaign(c); setView('detail'); void fetchCampaignLeads(c.id); }}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.channel === 'email' ? 'bg-amber-500/15 text-amber-400' : 'bg-violet-500/15 text-violet-400'}`}>
                  {c.channel === 'email' ? <Mail className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                </div>
                <div>
                  <div className="font-medium text-white">{c.name}</div>
                  <div className="text-xs text-white/50 flex items-center gap-2 mt-0.5">
                    <span>{SEGMENT_LABELS[c.segment]}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${c.status === 'running' ? 'bg-emerald-500/15 text-emerald-400' : c.status === 'scheduled' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/10 text-white/60'}`}>
                      {c.status}
                    </span>
                    {c.scheduledAt && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(c.scheduledAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-white/80">{c.sentCount} / {c.totalLeads}</div>
                  <div className="text-xs text-white/40">sent</div>
                </div>
                <div className="text-right hidden md:block">
                  <div className="text-sm text-white/80">{c.leadStats?.pending ?? 0}</div>
                  <div className="text-xs text-white/40">pending</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-gold/30 bg-gold/5' : 'border-white/10 bg-white/5'}`}>
      <div className={`flex items-center gap-2 mb-2 ${highlight ? 'text-gold' : 'text-white/50'}`}>
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-serif">{value}</div>
    </div>
  );
}
