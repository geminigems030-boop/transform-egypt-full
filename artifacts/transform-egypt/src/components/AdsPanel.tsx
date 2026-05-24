import { useEffect, useState } from 'react';
import {
  BarChart3, Megaphone, Palette, Plus, Loader2, CheckCircle, AlertTriangle,
  Trash2, Edit3, X, Copy, Check, ChevronDown, ChevronUp, RefreshCw, ExternalLink,
  TrendingUp, Eye, MousePointer, DollarSign, Tag, Calendar, Users, CreditCard,
  MessageSquare, Zap, Image, UserCog, Phone, Bell, BellOff, Send, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdInsight {
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  cpp?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
}

interface AdAdset {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights?: { data?: AdInsight[] };
}

interface AdAd {
  id?: string;
  name?: string;
  effective_status?: string;
  configured_status?: string;
  issues_info?: Array<{ level: string; error_code: number; title: string; message: string }>;
  insights?: { data?: AdInsight[] };
}

interface AdCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  insights?: { data?: AdInsight[] };
  adsets?: AdAdset[];
  ads?: AdAd[];
}

interface AdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  amount_spent?: string;
  balance?: string;
  spend_cap?: string;
  funding_source_details?: { display_string?: string; type?: number };
  campaigns: AdCampaign[];
}

interface Promotion {
  id: number;
  title: string;
  titleAr: string | null;
  description: string | null;
  service: string | null;
  discountType: string;
  discountValue: number | null;
  packagePrice: number | null;
  originalPrice: number | null;
  validFrom: string | null;
  validUntil: string | null;
  targetAudience: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface GeneratedCopy {
  headline: string;
  headlineAr?: string;
  primaryText: string;
  primaryTextAr?: string;
  caption: string;
  captionAr?: string;
  ctaButton: string;
  hashtags: string[];
  hashtagsAr?: string[];
  imagePrompt: string;
}

type SubTab = 'live' | 'promotions' | 'mediakit' | 'team';

const SERVICE_OPTIONS = [
  { value: 'hair_extensions', label: 'Hair Extensions' },
  { value: 'lash_extensions', label: 'Lash Extensions' },
  { value: 'microblading', label: 'Microblading / Powder Brows' },
  { value: 'bridal', label: 'Bridal Package' },
  { value: 'skincare', label: 'Skincare / Facials' },
  { value: 'nails', label: 'Nails' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'keratin', label: 'Keratin Treatment' },
];

export default function AdsPanel({ token }: { token: string }) {
  const [subTab, setSubTab] = useState<SubTab>('live');
  const headers = { 'X-Admin-Token': token };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 -mt-2 pb-0">
        {([
          { key: 'live', label: 'Live Meta Ads', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { key: 'promotions', label: 'Promotions', icon: <Tag className="w-3.5 h-3.5" /> },
          { key: 'mediakit', label: 'Media Kit', icon: <Palette className="w-3.5 h-3.5" /> },
          { key: 'team', label: 'Team Alerts', icon: <UserCog className="w-3.5 h-3.5" /> },
        ] as { key: SubTab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors -mb-px ${subTab === t.key ? 'border-gold text-gold' : 'border-transparent text-white/50 hover:text-white'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'live' && <LiveAdsTab headers={headers} />}
      {subTab === 'promotions' && <PromotionsTab headers={headers} />}
      {subTab === 'mediakit' && <MediaKitTab headers={headers} />}
      {subTab === 'team' && <TeamAlertsTab headers={headers} />}
    </div>
  );
}

// ── Live Meta Ads ─────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last_7d', label: '7 Days' },
  { key: 'last_30d', label: '30 Days' },
  { key: 'last_90d', label: '90 Days' },
  { key: 'lifetime', label: 'Lifetime' },
] as const;

function statusBadge(status: string) {
  const s = status?.toUpperCase();
  if (s === 'ACTIVE') return 'bg-emerald-500/15 text-emerald-400';
  if (s === 'PAUSED') return 'bg-amber-500/15 text-amber-400';
  if (s === 'ARCHIVED' || s === 'DELETED') return 'bg-rose-500/15 text-rose-400';
  return 'bg-white/10 text-white/40';
}

function fmt(n: number | string | undefined, decimals = 2) {
  const v = parseFloat(String(n ?? '0'));
  return isNaN(v) ? '—' : v.toFixed(decimals);
}
function fmtInt(n: number | string | undefined) {
  const v = parseInt(String(n ?? '0'), 10);
  return isNaN(v) ? '—' : v.toLocaleString();
}
function dmCount(actions?: Array<{ action_type: string; value: string }>) {
  const types = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply', 'onsite_conversion.messaging_welcome_message_view'];
  return (actions ?? []).filter(a => types.includes(a.action_type)).reduce((s, a) => s + parseInt(a.value, 10), 0);
}

function LiveAdsTab({ headers }: { headers: Record<string, string> }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ configured: boolean; datePreset?: string; accounts: AdAccount[]; error?: string } | null>(null);
  const [datePreset, setDatePreset] = useState('last_7_days');
  const [expandedCamps, setExpandedCamps] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());
  const [expandedAds, setExpandedAds] = useState<Set<string>>(new Set());

  const load = async (preset = datePreset) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ads/meta?date_preset=${preset}`, { headers });
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const switchPreset = (p: string) => {
    setDatePreset(p);
    void load(p);
  };

  const toggleSet = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-white/40">
      <Loader2 className="w-5 h-5 animate-spin me-2" /> Loading Meta Ads data…
    </div>
  );
  if (!data?.configured) return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
      <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Meta credentials not configured on the server.</p>
    </div>
  );
  if (data.error) return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-200 mb-1">Could not load Meta Ads</p>
          <p className="text-xs text-amber-300/70">{data.error}</p>
        </div>
      </div>
    </div>
  );
  if (data.accounts.length === 0) return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
      <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm">No ad accounts found.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Date range selector + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
          {DATE_PRESETS.map(p => (
            <button key={p.key} onClick={() => switchPreset(p.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${datePreset === p.key ? 'bg-gold text-black' : 'text-white/50 hover:text-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={() => load()} className="text-white/40 hover:text-white text-xs flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {data.accounts.map((account) => {
        const totalSpend = account.campaigns.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend ?? '0'), 0);
        const totalImpressions = account.campaigns.reduce((s, c) => s + parseInt(c.insights?.data?.[0]?.impressions ?? '0', 10), 0);
        const totalReach = account.campaigns.reduce((s, c) => s + parseInt(c.insights?.data?.[0]?.reach ?? '0', 10), 0);
        const totalDMs = account.campaigns.reduce((s, c) => s + dmCount(c.insights?.data?.[0]?.actions), 0);
        const activeCampaigns = account.campaigns.filter(c => c.status === 'ACTIVE').length;
        const amtSpent = parseFloat(account.amount_spent ?? '0') / 100;
        const balance = parseFloat(account.balance ?? '0') / 100;

        return (
          <div key={account.id} className="space-y-4">
            {/* Account summary bar */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{account.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">{account.id} · {account.currency} · {activeCampaigns}/{account.campaigns.length} active</p>
                </div>
                <a href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${account.id.replace('act_', '')}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gold hover:underline inline-flex items-center gap-1">
                  Open Ads Manager <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricBox icon={<DollarSign className="w-3.5 h-3.5" />} label="Total Spend (all time)" value={`${account.currency} ${amtSpent.toFixed(2)}`} highlight />
                <MetricBox icon={<CreditCard className="w-3.5 h-3.5" />} label="Prepaid Funds" value={`${account.currency} ${balance.toFixed(2)}`} />
                <MetricBox icon={<Eye className="w-3.5 h-3.5" />} label={`Impressions (${DATE_PRESETS.find(p => p.key === datePreset)?.label})`} value={fmtInt(totalImpressions)} />
                <MetricBox icon={<Users className="w-3.5 h-3.5" />} label={`Reach (${DATE_PRESETS.find(p => p.key === datePreset)?.label})`} value={fmtInt(totalReach)} />
              </div>
              {account.funding_source_details?.display_string && (
                <p className="text-xs text-white/30 mt-3 flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3" /> Billing: {account.funding_source_details.display_string}
                  {account.spend_cap && parseInt(account.spend_cap) > 0
                    ? ` · Cap: ${account.currency} ${(parseInt(account.spend_cap) / 100).toFixed(0)}`
                    : ' · No spend cap'}
                </p>
              )}
            </div>

            {/* Period summary */}
            {(totalSpend > 0 || totalDMs > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricBox icon={<DollarSign className="w-3.5 h-3.5" />} label="Period Spend" value={`${account.currency} ${totalSpend.toFixed(2)}`} highlight />
                <MetricBox icon={<Eye className="w-3.5 h-3.5" />} label="Impressions" value={fmtInt(totalImpressions)} />
                <MetricBox icon={<Users className="w-3.5 h-3.5" />} label="Reach" value={fmtInt(totalReach)} />
                <MetricBox icon={<MessageSquare className="w-3.5 h-3.5" />} label="DM Conversations" value={fmtInt(totalDMs)} highlight={totalDMs > 0} />
              </div>
            )}

            {/* Campaigns */}
            <div className="space-y-3">
              {account.campaigns.length === 0 ? (
                <p className="text-sm text-white/40 px-1">No campaigns found.</p>
              ) : account.campaigns.map((camp) => {
                const ci = camp.insights?.data?.[0];
                const spend = parseFloat(ci?.spend ?? '0');
                const impressions = parseInt(ci?.impressions ?? '0', 10);
                const reach = parseInt(ci?.reach ?? '0', 10);
                const clicks = parseInt(ci?.clicks ?? '0', 10);
                const ctr = parseFloat(ci?.ctr ?? '0');
                const cpm = parseFloat(ci?.cpm ?? '0');
                const cpc = parseFloat(ci?.cpc ?? '0');
                const frequency = parseFloat(ci?.frequency ?? '0');
                const dms = dmCount(ci?.actions);
                const campOpen = expandedCamps.has(camp.id);
                const adsetsOpen = expandedAdsets.has(camp.id);
                const adsOpen = expandedAds.has(camp.id);
                const budget = camp.daily_budget
                  ? `${account.currency} ${(parseInt(camp.daily_budget) / 100).toFixed(0)}/day`
                  : camp.lifetime_budget
                  ? `${account.currency} ${(parseInt(camp.lifetime_budget) / 100).toFixed(0)} lifetime`
                  : 'CBO';
                const issues = (camp.ads ?? []).flatMap(a => a.issues_info ?? []);

                return (
                  <div key={camp.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    {/* Campaign header */}
                    <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5"
                      onClick={() => setExpandedCamps(prev => toggleSet(prev, camp.id))}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">{camp.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${statusBadge(camp.status)}`}>{camp.status}</span>
                          {issues.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 shrink-0">⚠ {issues.length} issue{issues.length !== 1 ? 's' : ''}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 flex-wrap">
                          <span>{camp.objective?.replace(/_/g, ' ')}</span>
                          <span>·</span>
                          <span>{budget}</span>
                          {camp.start_time && <><span>·</span><span>Started {new Date(camp.start_time).toLocaleDateString()}</span></>}
                          {camp.stop_time && <><span>·</span><span className="text-amber-400">Ends {new Date(camp.stop_time).toLocaleDateString()}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <div className="text-sm font-semibold text-gold">{account.currency} {spend.toFixed(2)}</div>
                          <div className="text-[10px] text-white/30">{fmtInt(impressions)} impr.</div>
                        </div>
                        <a href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${account.id.replace('act_', '')}&selected_campaign_ids=${camp.id}`}
                          target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-white/30 hover:text-gold">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {campOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                    </div>

                    {campOpen && (
                      <div className="border-t border-white/10 px-4 py-4 space-y-4">
                        {/* Full metrics grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <MetricBox icon={<DollarSign className="w-3.5 h-3.5" />} label="Spend" value={`${account.currency} ${spend.toFixed(2)}`} highlight={spend > 0} />
                          <MetricBox icon={<Eye className="w-3.5 h-3.5" />} label="Impressions" value={fmtInt(impressions)} />
                          <MetricBox icon={<Users className="w-3.5 h-3.5" />} label="Reach" value={fmtInt(reach)} />
                          <MetricBox icon={<Zap className="w-3.5 h-3.5" />} label="Frequency" value={reach > 0 ? fmt(frequency || impressions / reach) : '—'} />
                          <MetricBox icon={<MousePointer className="w-3.5 h-3.5" />} label="Clicks" value={fmtInt(clicks)} />
                          <MetricBox icon={<TrendingUp className="w-3.5 h-3.5" />} label="CTR" value={`${fmt(ctr)}%`} />
                          <MetricBox icon={<DollarSign className="w-3.5 h-3.5" />} label="CPM" value={`${account.currency} ${fmt(cpm)}`} />
                          <MetricBox icon={<DollarSign className="w-3.5 h-3.5" />} label="CPC" value={clicks > 0 ? `${account.currency} ${fmt(cpc)}` : '—'} />
                        </div>

                        {/* DM actions */}
                        {ci?.actions && ci.actions.length > 0 && (
                          <div>
                            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Conversions & Actions</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {ci.actions.slice(0, 6).map(a => (
                                <MetricBox key={a.action_type}
                                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                                  label={a.action_type.replace(/onsite_conversion\.|_/g, ' ').replace('messaging ', 'DM: ').trim()}
                                  value={fmtInt(parseInt(a.value, 10))}
                                  highlight={parseInt(a.value, 10) > 0}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Issues */}
                        {issues.length > 0 && (
                          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 space-y-1">
                            {issues.map((issue, i) => (
                              <div key={i} className="text-xs text-rose-300">
                                <span className="font-medium">[{issue.level}] {issue.title}</span>
                                {issue.message && <span className="text-rose-300/60"> — {issue.message}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Adsets section */}
                        {(camp.adsets ?? []).length > 0 && (
                          <div>
                            <button onClick={() => setExpandedAdsets(prev => toggleSet(prev, camp.id))}
                              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-2">
                              {adsetsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Adsets ({camp.adsets!.length})
                            </button>
                            {adsetsOpen && (
                              <div className="space-y-2">
                                {camp.adsets!.map((adset) => {
                                  const ai = adset.insights?.data?.[0];
                                  const adb = adset.daily_budget
                                    ? `${account.currency} ${(parseInt(adset.daily_budget) / 100).toFixed(0)}/day`
                                    : adset.lifetime_budget
                                    ? `${account.currency} ${(parseInt(adset.lifetime_budget) / 100).toFixed(0)} lifetime`
                                    : 'budget via CBO';
                                  return (
                                    <div key={adset.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-medium text-white">{adset.name}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${statusBadge(adset.effective_status ?? adset.status ?? '')}`}>
                                              {adset.effective_status ?? adset.status}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-white/30 mt-0.5">{adb}</p>
                                        </div>
                                        {adset.id && (
                                          <a href={`https://business.facebook.com/adsmanager/manage/adsets?act=${account.id.replace('act_', '')}&selected_adset_ids=${adset.id}`}
                                            target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-gold">
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-4 gap-2">
                                        <MetricBox icon={<DollarSign className="w-3 h-3" />} label="Spend" value={`${account.currency} ${fmt(parseFloat(ai?.spend ?? '0'))}`} small />
                                        <MetricBox icon={<Eye className="w-3 h-3" />} label="Impr." value={fmtInt(ai?.impressions)} small />
                                        <MetricBox icon={<Users className="w-3 h-3" />} label="Reach" value={fmtInt(ai?.reach)} small />
                                        <MetricBox icon={<TrendingUp className="w-3 h-3" />} label="CTR" value={`${fmt(parseFloat(ai?.ctr ?? '0'))}%`} small />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Ads section */}
                        {(camp.ads ?? []).length > 0 && (
                          <div>
                            <button onClick={() => setExpandedAds(prev => toggleSet(prev, camp.id))}
                              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-2">
                              {adsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Individual Ads ({camp.ads!.length})
                            </button>
                            {adsOpen && (
                              <div className="space-y-2">
                                {camp.ads!.map((ad) => {
                                  const adi = ad.insights?.data?.[0];
                                  const hasIssues = (ad.issues_info ?? []).length > 0;
                                  return (
                                    <div key={ad.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                          <Image className="w-3 h-3 text-white/30 shrink-0" />
                                          <span className="text-xs font-medium text-white truncate">{ad.name}</span>
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${statusBadge(ad.effective_status ?? '')}`}>
                                            {ad.effective_status}
                                          </span>
                                          {hasIssues && <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 shrink-0">⚠ issue</span>}
                                        </div>
                                        {ad.id && (
                                          <a href={`https://business.facebook.com/adsmanager/manage/ads?act=${account.id.replace('act_', '')}&selected_ad_ids=${ad.id}`}
                                            target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-gold shrink-0 ml-2">
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                      {hasIssues && (ad.issues_info ?? []).map((iss, i) => (
                                        <p key={i} className="text-[10px] text-rose-400 mb-2">⚠ {iss.title}: {iss.message}</p>
                                      ))}
                                      <div className="grid grid-cols-4 gap-2">
                                        <MetricBox icon={<DollarSign className="w-3 h-3" />} label="Spend" value={`${account.currency} ${fmt(parseFloat(adi?.spend ?? '0'))}`} small />
                                        <MetricBox icon={<Eye className="w-3 h-3" />} label="Impr." value={fmtInt(adi?.impressions)} small />
                                        <MetricBox icon={<MousePointer className="w-3 h-3" />} label="Clicks" value={fmtInt(adi?.clicks)} small />
                                        <MetricBox icon={<TrendingUp className="w-3 h-3" />} label="CTR" value={`${fmt(parseFloat(adi?.ctr ?? '0'))}%`} small />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricBox({ icon, label, value, highlight, small }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-lg bg-black/30 px-3 ${small ? 'py-1.5' : 'py-2'}`}>
      <div className={`flex items-center gap-1 text-white/40 mb-0.5 ${small ? 'text-[10px]' : 'text-xs'}`}>
        {icon} <span className="truncate">{label}</span>
      </div>
      <div className={`font-medium ${small ? 'text-xs' : 'text-sm'} ${highlight ? 'text-gold' : 'text-white'}`}>{value}</div>
    </div>
  );
}

// ── Promotions CRUD ───────────────────────────────────────────────────────────

function PromotionsTab({ headers }: { headers: Record<string, string> }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '', titleAr: '', description: '', service: '',
    discountType: 'percent', discountValue: '', packagePrice: '',
    originalPrice: '', validFrom: '', validUntil: '',
    targetAudience: '', status: 'active', notes: '',
  });

  const resetForm = () => setForm({
    title: '', titleAr: '', description: '', service: '',
    discountType: 'percent', discountValue: '', packagePrice: '',
    originalPrice: '', validFrom: '', validUntil: '',
    targetAudience: '', status: 'active', notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/promotions', { headers });
      const data = await res.json();
      setPromotions(data.promotions ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      title: p.title, titleAr: p.titleAr ?? '', description: p.description ?? '',
      service: p.service ?? '', discountType: p.discountType,
      discountValue: p.discountValue ? String(p.discountValue) : '',
      packagePrice: p.packagePrice ? String(p.packagePrice) : '',
      originalPrice: p.originalPrice ? String(p.originalPrice) : '',
      validFrom: p.validFrom ? p.validFrom.split('T')[0] : '',
      validUntil: p.validUntil ? p.validUntil.split('T')[0] : '',
      targetAudience: p.targetAudience ?? '', status: p.status, notes: p.notes ?? '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        ...form,
        discountValue: form.discountValue ? Number(form.discountValue) : null,
        packagePrice: form.packagePrice ? Number(form.packagePrice) : null,
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      const url = editing ? `/api/admin/promotions/${editing.id}` : '/api/admin/promotions';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Save failed');
      await load();
      setShowForm(false);
      setEditing(null);
      resetForm();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this promotion?')) return;
    await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE', headers });
    await load();
  };

  const DISCOUNT_LABEL: Record<string, string> = {
    percent: '% Off', amount: 'EGP Off', package: 'Package Price',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-white/50">{promotions.length} promotion{promotions.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { resetForm(); setEditing(null); setShowForm(true); }} className="bg-gold text-black hover:bg-gold/90" size="sm">
          <Plus className="w-3.5 h-3.5 me-1.5" /> New Promotion
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editing ? 'Edit Promotion' : 'New Promotion'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 mb-4">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Title (EN)" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="e.g. 20% Off Hair Extensions" />
            <Field label="Title (AR)" value={form.titleAr} onChange={(v) => setForm((f) => ({ ...f, titleAr: v }))} placeholder="خصم ٢٠٪ على وصلات الشعر" dir="rtl" />
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Service</label>
              <select value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold">
                <option value="">All services</option>
                {SERVICE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Discount Type</label>
              <div className="flex gap-2">
                {(['percent', 'amount', 'package'] as const).map((t) => (
                  <button key={t} onClick={() => setForm((f) => ({ ...f, discountType: t }))}
                    className={`flex-1 py-2 rounded-lg border text-xs transition-colors ${form.discountType === t ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/60 hover:text-white'}`}>
                    {DISCOUNT_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            {form.discountType !== 'package' && (
              <Field label={form.discountType === 'percent' ? 'Discount %' : 'Discount EGP'} value={form.discountValue} onChange={(v) => setForm((f) => ({ ...f, discountValue: v }))} type="number" placeholder="e.g. 20" />
            )}
            {form.discountType === 'package' && (
              <>
                <Field label="Original Price (EGP)" value={form.originalPrice} onChange={(v) => setForm((f) => ({ ...f, originalPrice: v }))} type="number" placeholder="e.g. 3500" />
                <Field label="Package Price (EGP)" value={form.packagePrice} onChange={(v) => setForm((f) => ({ ...f, packagePrice: v }))} type="number" placeholder="e.g. 2800" />
              </>
            )}
            <Field label="Valid From" value={form.validFrom} onChange={(v) => setForm((f) => ({ ...f, validFrom: v }))} type="date" />
            <Field label="Valid Until" value={form.validUntil} onChange={(v) => setForm((f) => ({ ...f, validUntil: v }))} type="date" />
            <Field label="Target Audience" value={form.targetAudience} onChange={(v) => setForm((f) => ({ ...f, targetAudience: v }))} placeholder="e.g. New clients, brides" />
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Briefly describe the offer..."
              className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold resize-none" />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Notes (internal)</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Internal notes for the team..."
              className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold resize-none" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="bg-gold text-black hover:bg-gold/90" size="sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <CheckCircle className="w-3.5 h-3.5 me-1.5" />}
              {editing ? 'Save Changes' : 'Create Promotion'}
            </Button>
            <Button onClick={() => { setShowForm(false); setEditing(null); }} variant="outline" className="border-white/20 text-white hover:bg-white/10" size="sm">Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40"><Loader2 className="w-5 h-5 animate-spin me-2" /> Loading…</div>
      ) : promotions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
          <Megaphone className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No promotions yet. Create one to use in your ad campaigns.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promotions.map((p) => {
            const isExpired = p.validUntil && new Date(p.validUntil) < new Date();
            return (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-white">{p.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.status === 'active' && !isExpired ? 'bg-emerald-500/15 text-emerald-400' : p.status === 'draft' ? 'bg-white/10 text-white/40' : 'bg-rose-500/15 text-rose-400'}`}>
                      {isExpired ? 'expired' : p.status}
                    </span>
                    {p.service && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold">{SERVICE_OPTIONS.find((s) => s.value === p.service)?.label ?? p.service}</span>}
                  </div>
                  {p.titleAr && <p className="text-xs text-white/40 mb-1" dir="rtl">{p.titleAr}</p>}
                  {p.description && <p className="text-xs text-white/50 mb-2 truncate">{p.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-white/40">
                    {p.discountType === 'percent' && p.discountValue && <span className="text-gold font-medium">{p.discountValue}% OFF</span>}
                    {p.discountType === 'amount' && p.discountValue && <span className="text-gold font-medium">EGP {p.discountValue} OFF</span>}
                    {p.discountType === 'package' && p.packagePrice && <span className="text-gold font-medium">Package EGP {p.packagePrice}{p.originalPrice ? ` (was ${p.originalPrice})` : ''}</span>}
                    {p.validFrom && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(p.validFrom).toLocaleDateString()}</span>}
                    {p.validUntil && <span>→ {new Date(p.validUntil).toLocaleDateString()}</span>}
                    {p.targetAudience && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.targetAudience}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => del(p.id)} className="p-1.5 text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', dir }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; dir?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={dir}
        className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold placeholder:text-white/20" />
    </div>
  );
}

// ── Media Kit Builder ─────────────────────────────────────────────────────────

function MediaKitTab({ headers }: { headers: Record<string, string> }) {
  const [form, setForm] = useState({
    service: 'hair_extensions',
    promotion: '',
    audience: 'women in Cairo interested in beauty',
    tone: 'luxury, warm, confident',
    platform: 'instagram',
    language: 'both',
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedCopy | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/ads/generate-copy', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data.copy);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        <h3 className="font-serif text-lg">Generate Ad Copy</h3>
        <div>
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Service</label>
          <select value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
            className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold">
            {SERVICE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Active Promotion (optional)</label>
          <input value={form.promotion} onChange={(e) => setForm((f) => ({ ...f, promotion: e.target.value }))}
            placeholder="e.g. 20% off for new clients this month"
            className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold placeholder:text-white/20" />
        </div>
        <div>
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Target Audience</label>
          <input value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
            placeholder="e.g. brides in Cairo aged 22-35"
            className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold placeholder:text-white/20" />
        </div>
        <div>
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Tone</label>
          <input value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
            placeholder="e.g. luxury, warm, confident"
            className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold placeholder:text-white/20" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Platform</label>
            <div className="flex gap-2">
              {(['instagram', 'facebook', 'both'] as const).map((p) => (
                <button key={p} onClick={() => setForm((f) => ({ ...f, platform: p }))}
                  className={`flex-1 py-2 rounded-lg border text-xs capitalize transition-colors ${form.platform === p ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/60 hover:text-white'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Language</label>
            <div className="flex gap-2">
              {(['both', 'en', 'ar'] as const).map((l) => (
                <button key={l} onClick={() => setForm((f) => ({ ...f, language: l }))}
                  className={`flex-1 py-2 rounded-lg border text-xs transition-colors ${form.language === l ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/60 hover:text-white'}`}>
                  {l === 'both' ? 'Both' : l === 'en' ? 'EN' : 'عر'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button onClick={generate} disabled={generating} className="w-full bg-gold text-black hover:bg-gold/90">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin me-2" /> Generating copy…</> : <><Palette className="w-4 h-4 me-2" /> Generate Ad Copy</>}
        </Button>
        {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2">{error}</div>}
      </div>

      {/* Results */}
      <div>
        {!result && !generating && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/30 h-full flex flex-col items-center justify-center">
            <Palette className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">Fill in the form and generate ad copy — the AI will write headlines, captions, and image descriptions for your campaign.</p>
          </div>
        )}
        {generating && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40 h-full flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mb-3" />
            <p className="text-sm">Writing your ad copy…</p>
          </div>
        )}
        {result && (
          <div className="space-y-4">
            <CopyBlock title="Headline (EN)" text={result.headline} onCopy={() => copy(result.headline, 'headline')} copied={copied === 'headline'} />
            {result.headlineAr && <CopyBlock title="Headline (AR)" text={result.headlineAr} onCopy={() => copy(result.headlineAr!, 'headlineAr')} copied={copied === 'headlineAr'} dir="rtl" />}
            <CopyBlock title="Primary Text (EN)" text={result.primaryText} onCopy={() => copy(result.primaryText, 'primary')} copied={copied === 'primary'} multiline />
            {result.primaryTextAr && <CopyBlock title="Primary Text (AR)" text={result.primaryTextAr} onCopy={() => copy(result.primaryTextAr!, 'primaryAr')} copied={copied === 'primaryAr'} multiline dir="rtl" />}
            <CopyBlock title="Caption (EN)" text={result.caption} onCopy={() => copy(result.caption, 'caption')} copied={copied === 'caption'} multiline />
            {result.captionAr && <CopyBlock title="Caption (AR)" text={result.captionAr} onCopy={() => copy(result.captionAr!, 'captionAr')} copied={copied === 'captionAr'} multiline dir="rtl" />}
            <CopyBlock title="CTA Button" text={result.ctaButton} onCopy={() => copy(result.ctaButton, 'cta')} copied={copied === 'cta'} />
            <CopyBlock title="Hashtags (EN)" text={result.hashtags.join(' ')} onCopy={() => copy(result.hashtags.join(' '), 'hashtags')} copied={copied === 'hashtags'} />
            {result.hashtagsAr && result.hashtagsAr.length > 0 && <CopyBlock title="Hashtags (AR)" text={result.hashtagsAr.join(' ')} onCopy={() => copy(result.hashtagsAr!.join(' '), 'hashtagsAr')} copied={copied === 'hashtagsAr'} dir="rtl" />}
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <p className="text-xs text-violet-300 font-medium mb-1 flex items-center gap-1"><Palette className="w-3 h-3" /> Image Description</p>
              <p className="text-xs text-white/60 leading-relaxed">{result.imagePrompt}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Team Alerts (WhatsApp Notifications) ─────────────────────────────────────

interface TeamMember {
  id: number;
  name: string;
  role: string;
  phone: string;
  whatsappPhone: string | null;
  active: boolean;
  notifyOnEscalation: boolean;
  notifyOnLead: boolean;
  notifyOnBooking: boolean;
  notifyOnDmLead: boolean;
  notifyOnCall: boolean;
  createdAt: string;
}

const ROLE_OPTIONS = ['owner', 'manager', 'receptionist', 'staff'];

function TeamAlertsTab({ headers }: { headers: Record<string, string> }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [metaWhatsAppConfigured, setMetaWhatsAppConfigured] = useState(false);
  const [whatsAppConfigured, setWhatsAppConfigured] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const emptyForm = {
    name: '', role: 'staff', phone: '', whatsappPhone: '',
    active: true,
    notifyOnEscalation: true, notifyOnLead: true,
    notifyOnBooking: true, notifyOnDmLead: true, notifyOnCall: true,
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/team', { headers });
      const data = await res.json();
      setMembers(data.members ?? []);
      setTwilioConfigured(data.twilioConfigured ?? false);
      setMetaWhatsAppConfigured(data.metaWhatsAppConfigured ?? false);
      setWhatsAppConfigured(data.whatsAppConfigured ?? false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setForm({
      name: m.name, role: m.role, phone: m.phone,
      whatsappPhone: m.whatsappPhone ?? '',
      active: m.active,
      notifyOnEscalation: m.notifyOnEscalation,
      notifyOnLead: m.notifyOnLead,
      notifyOnBooking: m.notifyOnBooking,
      notifyOnDmLead: m.notifyOnDmLead,
      notifyOnCall: m.notifyOnCall,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.phone.trim()) { setError('Phone is required'); return; }
    setSaving(true); setError('');
    try {
      const body = {
        ...form,
        whatsappPhone: form.whatsappPhone.trim() || null,
      };
      const url = editing ? `/api/admin/team/${editing.id}` : '/api/admin/team';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      await load();
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/admin/team/${id}`, { method: 'DELETE', headers });
    await load();
  };

  const toggleActive = async (m: TeamMember) => {
    await fetch(`/api/admin/team/${m.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    });
    await load();
  };

  const sendTest = async () => {
    if (!testPhone.trim()) return;
    setTestSending(true); setTestResult(null);
    try {
      const res = await fetch('/api/admin/team/test-wa', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });
      const d = await res.json();
      if (!res.ok) setTestResult({ ok: false, msg: d.error || 'Failed' });
      else setTestResult({ ok: true, msg: 'Test message sent! ✅' });
    } catch (e) {
      setTestResult({ ok: false, msg: (e as Error).message });
    } finally {
      setTestSending(false);
    }
  };

  const NotifyToggle = ({
    member, field, label, icon,
  }: {
    member: TeamMember;
    field: 'notifyOnEscalation' | 'notifyOnLead' | 'notifyOnBooking' | 'notifyOnDmLead' | 'notifyOnCall';
    label: string;
    icon: React.ReactNode;
  }) => {
    const active = member[field];
    return (
      <button
        onClick={async () => {
          await fetch(`/api/admin/team/${member.id}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: !active }),
          });
          await load();
        }}
        title={`${active ? 'Disable' : 'Enable'} ${label}`}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${active ? 'bg-emerald-500/15 text-emerald-400 hover:bg-rose-500/15 hover:text-rose-400' : 'bg-white/5 text-white/25 hover:bg-emerald-500/15 hover:text-emerald-400'}`}
      >
        {icon} {label}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* WhatsApp status banner */}
      {!whatsAppConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-200 mb-1">WhatsApp Not Configured</p>
            <p className="text-xs text-amber-300/70 mb-2">
              Add <code className="bg-amber-900/40 px-1 rounded">META_WHATSAPP_PHONE_NUMBER_ID</code> to
              activate free WhatsApp alerts via Meta Cloud API (1,000 messages/month free).
            </p>
            <p className="text-xs text-amber-300/50">
              Find your Phone Number ID in Meta Business Manager → WhatsApp → API Setup.
            </p>
          </div>
        </div>
      )}
      {whatsAppConfigured && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          {metaWhatsAppConfigured
            ? 'Meta WhatsApp Cloud API active (free) — team members will receive alerts on their phones.'
            : 'Twilio WhatsApp active — team members will receive alerts on their phones.'}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
        <Button
          onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }}
          className="bg-gold text-black hover:bg-gold/90" size="sm"
        >
          <Plus className="w-3.5 h-3.5 me-1.5" /> Add Member
        </Button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editing ? 'Edit Member' : 'Add Team Member'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 mb-4">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Nour Ahmed" />
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold capitalize">
                {ROLE_OPTIONS.map((r) => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <Field label="Phone (E.164, e.g. +201009780008)" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+201009780008" />
            <Field label="WhatsApp Number (if different)" value={form.whatsappPhone} onChange={(v) => setForm((f) => ({ ...f, whatsappPhone: v }))} placeholder="Leave blank to use Phone" />
          </div>
          <div className="mb-4">
            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Notify on</p>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'notifyOnEscalation', label: 'Escalations', icon: <ShieldAlert className="w-3 h-3" /> },
                { key: 'notifyOnDmLead', label: 'DM Leads', icon: <MessageSquare className="w-3 h-3" /> },
                { key: 'notifyOnBooking', label: 'Bookings', icon: <Calendar className="w-3 h-3" /> },
                { key: 'notifyOnLead', label: 'Form Leads', icon: <Users className="w-3 h-3" /> },
                { key: 'notifyOnCall', label: 'Call Summaries', icon: <Phone className="w-3 h-3" /> },
              ] as { key: keyof typeof form; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => {
                const isActive = form[key] as boolean;
                return (
                  <button key={key} type="button"
                    onClick={() => setForm((f) => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${isActive ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-white/40 hover:text-white'}`}>
                    {icon} {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4 accent-gold" />
              <span className="text-sm text-white/70">Active</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="bg-gold text-black hover:bg-gold/90" size="sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <CheckCircle className="w-3.5 h-3.5 me-1.5" />}
              {editing ? 'Save Changes' : 'Add Member'}
            </Button>
            <Button onClick={() => { setShowForm(false); setEditing(null); }} variant="outline" className="border-white/20 text-white hover:bg-white/10" size="sm">Cancel</Button>
          </div>
        </div>
      )}

      {/* Member list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin me-2" /> Loading…
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
          <UserCog className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No team members yet. Add members to start receiving WhatsApp alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className={`rounded-xl border bg-white/5 p-4 ${m.active ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-white">{m.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold capitalize">{m.role}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/30'}`}>
                      {m.active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40 mb-3 flex-wrap">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>
                    {m.whatsappPhone && m.whatsappPhone !== m.phone && (
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-emerald-400" />{m.whatsappPhone}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <NotifyToggle member={m} field="notifyOnEscalation" label="Escalations" icon={<ShieldAlert className="w-3 h-3" />} />
                    <NotifyToggle member={m} field="notifyOnDmLead" label="DM Leads" icon={<MessageSquare className="w-3 h-3" />} />
                    <NotifyToggle member={m} field="notifyOnBooking" label="Bookings" icon={<Calendar className="w-3 h-3" />} />
                    <NotifyToggle member={m} field="notifyOnLead" label="Form Leads" icon={<Users className="w-3 h-3" />} />
                    <NotifyToggle member={m} field="notifyOnCall" label="Call Summaries" icon={<Phone className="w-3 h-3" />} />
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(m)} title={m.active ? 'Deactivate' : 'Activate'}
                    className={`p-1.5 rounded-lg transition-colors ${m.active ? 'text-emerald-400 hover:bg-rose-500/10 hover:text-rose-400' : 'text-white/30 hover:bg-emerald-500/10 hover:text-emerald-400'}`}>
                    {m.active ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => openEdit(m)} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => del(m.id)} className="p-1.5 text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test WhatsApp */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mt-2">
        <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Send className="w-3.5 h-3.5" /> Send Test WhatsApp
        </p>
        <div className="flex gap-2">
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+201009780008"
            className="flex-1 bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold placeholder:text-white/20"
          />
          <Button onClick={sendTest} disabled={testSending || !testPhone.trim()} className="bg-white/10 text-white hover:bg-white/20 border-white/20" variant="outline" size="sm">
            {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
        {testResult && (
          <p className={`text-xs mt-2 ${testResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{testResult.msg}</p>
        )}
      </div>
    </div>
  );
}

function CopyBlock({ title, text, onCopy, copied, multiline, dir }: {
  title: string; text: string; onCopy: () => void; copied: boolean; multiline?: boolean; dir?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 uppercase tracking-wider">{title}</span>
        <button onClick={onCopy} className="text-white/30 hover:text-gold transition-colors flex items-center gap-1 text-xs">
          {copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
      <p className={`text-sm text-white/80 leading-relaxed ${multiline ? 'whitespace-pre-wrap' : ''}`} dir={dir}>{text}</p>
    </div>
  );
}
