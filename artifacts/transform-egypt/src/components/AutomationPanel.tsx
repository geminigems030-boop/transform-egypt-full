import { useCallback, useEffect, useState } from 'react';
import {
  Bot, Bell, Clock, MessageSquare, RefreshCw, Loader2,
  CheckCircle, XCircle, Play, Send, Settings, Link,
  ToggleLeft, ToggleRight, AlertTriangle, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AutomationSettings {
  id: number;
  enabled24h: boolean;
  enabled2h: boolean;
  enabledFollowup: boolean;
  enabledReengagement: boolean;
  reengagementWindowDays: number;
  reengagementCooldownDays: number;
  branchReviewLinks: Record<string, string>;
  updatedAt: string;
}

interface AutomationPreview {
  reminders24h: number;
  reminders2h: number;
  followupsPending: number;
  reengagementEligible: number;
  generatedAt: string;
}

interface AutomationLog {
  id: number;
  clientId: number | null;
  appointmentId: number | null;
  eventType: string;
  phone: string;
  messagePreview: string | null;
  sentAt: string;
  twilioSid: string | null;
  success: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  reminder_24h: '24h Reminder',
  reminder_2h: '2h Reminder',
  followup: 'Post-visit Follow-up',
  reengagement: 'Re-engagement',
  test: 'Test Send',
};

const EVENT_COLORS: Record<string, string> = {
  reminder_24h: 'text-blue-400',
  reminder_2h: 'text-cyan-400',
  followup: 'text-amber-400',
  reengagement: 'text-purple-400',
  test: 'text-gray-400',
};

interface Props {
  token: string;
}

export default function AutomationPanel({ token }: Props) {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResults, setTriggerResults] = useState<Record<string, number>>({});
  const [testPhone, setTestPhone] = useState('');
  const [testType, setTestType] = useState('reminder_24h');
  const [testSending, setTestSending] = useState(false);
  const [testReason, setTestReason] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const [branchName, setBranchName] = useState('');
  const [branchUrl, setBranchUrl] = useState('');

  const headers = { 'X-Admin-Token': token, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, logRes, previewRes] = await Promise.all([
        fetch('/api/admin/automation/settings', { headers: { 'X-Admin-Token': token } }),
        fetch('/api/admin/automation/log', { headers: { 'X-Admin-Token': token } }),
        fetch('/api/admin/automation/preview', { headers: { 'X-Admin-Token': token } }),
      ]);
      if (!settingsRes.ok || !logRes.ok) throw new Error('Failed to load');
      const [{ settings: s }, { logs: l }] = await Promise.all([settingsRes.json(), logRes.json()]);
      setSettings(s);
      setLogs(l ?? []);
      if (previewRes.ok) {
        const { preview: p } = await previewRes.json();
        setPreview(p ?? null);
        setPreviewError(false);
      } else {
        setPreviewError(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const save = async (updated: Partial<AutomationSettings>) => {
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/admin/automation/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error('Save failed');
      const { settings: s } = await res.json();
      setSettings(s);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof AutomationSettings) => {
    if (!settings) return;
    const newVal = !settings[key];
    setSettings((s) => s ? { ...s, [key]: newVal } : s);
    void save({ [key]: newVal });
  };

  const saveNumber = (key: keyof AutomationSettings, val: number) => {
    if (!settings) return;
    setSettings((s) => s ? { ...s, [key]: val } : s);
    void save({ [key]: val });
  };

  const addBranchLink = () => {
    if (!settings || !branchName.trim() || !branchUrl.trim()) return;
    const updated = { ...settings.branchReviewLinks, [branchName.trim()]: branchUrl.trim() };
    setSettings((s) => s ? { ...s, branchReviewLinks: updated } : s);
    void save({ branchReviewLinks: updated });
    setBranchName('');
    setBranchUrl('');
  };

  const removeBranchLink = (name: string) => {
    if (!settings) return;
    const updated = { ...settings.branchReviewLinks };
    delete updated[name];
    setSettings((s) => s ? { ...s, branchReviewLinks: updated } : s);
    void save({ branchReviewLinks: updated });
  };

  const trigger = async (job: string) => {
    setTriggering(job);
    try {
      const res = await fetch('/api/admin/automation/trigger', {
        method: 'POST',
        headers,
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      setTriggerResults((r) => ({ ...r, [job]: data.sent ?? 0 }));
      void load();
    } catch {
      setError('Trigger failed');
    } finally {
      setTriggering(null);
    }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) return;
    setTestSending(true);
    setTestResult(null);
    setTestReason(null);
    try {
      const res = await fetch('/api/admin/automation/test-send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: testPhone.trim(), eventType: testType }),
      });
      const data = await res.json();
      setTestResult(data.ok === true);
      setTestReason(data.reason ?? null);
      void load();
    } catch {
      setTestResult(false);
      setTestReason(null);
    } finally {
      setTestSending(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20">
            <Bot className="w-6 h-6 text-[#C9A84C]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">WhatsApp Automation</h2>
            <p className="text-sm text-white/50">Automated reminders, follow-ups & re-engagement</p>
          </div>
        </div>
        <Button
          onClick={load}
          variant="outline"
          size="sm"
          className="border-white/10 text-white/60 hover:text-white bg-transparent"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 p-3 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Settings saved
        </div>
      )}

      {/* Today's Pipeline */}
      {(preview || previewError) && (
        <div className="rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-white">Today's Pipeline</h3>
            {preview && (
              <span className="ml-auto text-xs text-white/30">
                as of {new Date(preview.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {previewError ? (
            <div className="flex items-center gap-2 text-xs text-amber-400/70 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Pipeline counts unavailable — click Refresh to try again
            </div>
          ) : preview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PipelineCard
                icon={<Bell className="w-4 h-4 text-blue-400" />}
                label="24h Reminders"
                count={preview.reminders24h}
                color="text-blue-400"
              />
              <PipelineCard
                icon={<Clock className="w-4 h-4 text-cyan-400" />}
                label="2h Nudges"
                count={preview.reminders2h}
                color="text-cyan-400"
              />
              <PipelineCard
                icon={<MessageSquare className="w-4 h-4 text-amber-400" />}
                label="Follow-ups"
                count={preview.followupsPending}
                color="text-amber-400"
              />
              <PipelineCard
                icon={<RefreshCw className="w-4 h-4 text-purple-400" />}
                label="Re-engagement"
                count={preview.reengagementEligible}
                color="text-purple-400"
              />
            </div>
          )}
        </div>
      )}

      {settings && (
        <>
          {/* Toggle Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ToggleCard
              icon={<Bell className="w-5 h-5 text-blue-400" />}
              title="24h Appointment Reminder"
              description="Sent the day before a confirmed appointment"
              enabled={settings.enabled24h}
              onToggle={() => toggle('enabled24h')}
              saving={saving}
              job="reminder_24h"
              onTrigger={trigger}
              triggering={triggering}
              triggerResult={triggerResults['reminder_24h']}
            />
            <ToggleCard
              icon={<Clock className="w-5 h-5 text-cyan-400" />}
              title="2h Appointment Nudge"
              description="Sent 2 hours before a confirmed appointment"
              enabled={settings.enabled2h}
              onToggle={() => toggle('enabled2h')}
              saving={saving}
              job="reminder_2h"
              onTrigger={trigger}
              triggering={triggering}
              triggerResult={triggerResults['reminder_2h']}
            />
            <ToggleCard
              icon={<MessageSquare className="w-5 h-5 text-amber-400" />}
              title="Post-visit Follow-up"
              description="Google review request, 24h after appointment completion"
              enabled={settings.enabledFollowup}
              onToggle={() => toggle('enabledFollowup')}
              saving={saving}
              job="followup"
              onTrigger={trigger}
              triggering={triggering}
              triggerResult={triggerResults['followup']}
            />
            <ToggleCard
              icon={<RefreshCw className="w-5 h-5 text-purple-400" />}
              title="Re-engagement Campaign"
              description={`Targets clients inactive for ${settings.reengagementWindowDays}+ days`}
              enabled={settings.enabledReengagement}
              onToggle={() => toggle('enabledReengagement')}
              saving={saving}
              job="reengagement"
              onTrigger={trigger}
              triggering={triggering}
              triggerResult={triggerResults['reengagement']}
            />
          </div>

          {/* Re-engagement Settings */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-white">Re-engagement Settings</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="Inactivity window (days)"
                description="Clients not seen in this many days get a message"
                value={settings.reengagementWindowDays}
                min={14}
                max={365}
                onSave={(v) => saveNumber('reengagementWindowDays', v)}
              />
              <NumberField
                label="Re-send cooldown (days)"
                description="Min days between re-engagement messages per client"
                value={settings.reengagementCooldownDays}
                min={7}
                max={180}
                onSave={(v) => saveNumber('reengagementCooldownDays', v)}
              />
            </div>
          </div>

          {/* Branch Google Review Links */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Link className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-white">Google Review Links (per branch)</h3>
            </div>
            <p className="text-xs text-white/40 mb-4">
              Used in post-visit follow-up messages. If no branch matches, the first link is used.
            </p>
            <div className="space-y-2 mb-4">
              {Object.entries(settings.branchReviewLinks ?? {}).length === 0 && (
                <p className="text-xs text-white/30 italic">No branch links configured yet.</p>
              )}
              {Object.entries(settings.branchReviewLinks ?? {}).map(([name, url]) => (
                <div key={name} className="flex items-center gap-3 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2">
                  <span className="text-xs font-medium text-[#C9A84C] w-28 shrink-0">{name}</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/60 hover:text-white truncate flex-1"
                  >
                    {url}
                  </a>
                  <button
                    onClick={() => removeBranchLink(name)}
                    className="text-white/30 hover:text-rose-400 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Branch name"
                className="flex-1 min-w-[120px] rounded-lg bg-white/[0.06] border border-white/10 text-white text-xs px-3 py-2 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40"
              />
              <input
                value={branchUrl}
                onChange={(e) => setBranchUrl(e.target.value)}
                placeholder="https://g.page/r/..."
                className="flex-[2] min-w-[200px] rounded-lg bg-white/[0.06] border border-white/10 text-white text-xs px-3 py-2 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40"
              />
              <Button
                onClick={addBranchLink}
                size="sm"
                disabled={!branchName.trim() || !branchUrl.trim() || saving}
                className="bg-[#C9A84C] hover:bg-[#b8953f] text-black text-xs"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Test Send */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Send className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-white">Test Send</h3>
            </div>
            <p className="text-xs text-white/40 mb-4">
              Send a test WhatsApp message to a specific phone number to verify your setup.
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+201009780008"
                className="flex-1 min-w-[160px] rounded-lg bg-white/[0.06] border border-white/10 text-white text-xs px-3 py-2 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40"
              />
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="rounded-lg bg-white/[0.06] border border-white/10 text-white text-xs px-3 py-2 focus:outline-none"
              >
                {Object.entries(EVENT_LABELS).filter(([k]) => k !== 'test').map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <Button
                onClick={sendTest}
                size="sm"
                disabled={!testPhone.trim() || testSending}
                className="bg-[#C9A84C] hover:bg-[#b8953f] text-black text-xs"
              >
                {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-1">Send</span>
              </Button>
            </div>
            {testResult !== null && (
              <div className={`mt-3 flex items-start gap-2 text-xs ${testResult ? 'text-emerald-400' : 'text-rose-400'}`}>
                {testResult ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span>{testReason ?? (testResult ? 'Test message sent successfully' : 'Send failed — check WhatsApp configuration')}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Message Log */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Messages (last 50)</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-white/30 italic text-center py-8">No messages sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="text-left py-2 pr-4">Time</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2 pr-4">Phone</th>
                  <th className="text-left py-2 pr-4">Preview</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 pr-4 text-white/40 whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className={`py-2 pr-4 font-medium whitespace-nowrap ${EVENT_COLORS[log.eventType] ?? 'text-white/60'}`}>
                      {EVENT_LABELS[log.eventType] ?? log.eventType}
                    </td>
                    <td className="py-2 pr-4 text-white/60 font-mono">{log.phone}</td>
                    <td className="py-2 pr-4 text-white/50 max-w-[260px] truncate">
                      {log.messagePreview ?? '—'}
                    </td>
                    <td className="py-2">
                      {log.success
                        ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="w-3 h-3" />Sent</span>
                        : <span className="flex items-center gap-1 text-rose-400"><XCircle className="w-3 h-3" />Failed</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── PipelineCard ───────────────────────────────────────────────────────────────

interface PipelineCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}

function PipelineCard({ icon, label, count, color }: PipelineCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-white/50">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{count}</p>
      <p className="text-[10px] text-white/25">
        {count === 1 ? 'message pending' : 'messages pending'}
      </p>
    </div>
  );
}

interface ToggleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  saving: boolean;
  job: string;
  onTrigger: (job: string) => void;
  triggering: string | null;
  triggerResult?: number;
}

function ToggleCard({
  icon, title, description, enabled, onToggle, saving, job, onTrigger, triggering, triggerResult,
}: ToggleCardProps) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${enabled ? 'border-white/15 bg-white/[0.04]' : 'border-white/8 bg-white/[0.02] opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-white/[0.06]">{icon}</div>
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            <p className="text-xs text-white/40 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={saving}
          className="shrink-0 mt-0.5 transition-colors"
          title={enabled ? 'Disable' : 'Enable'}
        >
          {enabled
            ? <ToggleRight className="w-8 h-8 text-[#C9A84C]" />
            : <ToggleLeft className="w-8 h-8 text-white/30" />}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onTrigger(job)}
          disabled={triggering === job}
          className="text-xs border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:border-white/20"
        >
          {triggering === job
            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            : <Play className="w-3 h-3 mr-1" />}
          Run now
        </Button>
        {triggerResult !== undefined && (
          <span className="text-xs text-emerald-400">{triggerResult} sent</span>
        )}
      </div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onSave: (v: number) => void;
}

function NumberField({ label, description, value, min, max, onSave }: NumberFieldProps) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);

  const commit = () => {
    const n = parseInt(local, 10);
    if (!isNaN(n) && n >= min && n <= max) onSave(n);
    else setLocal(String(value));
  };

  return (
    <div>
      <label className="text-xs font-medium text-white/60 block mb-1">{label}</label>
      <p className="text-xs text-white/30 mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={local}
          min={min}
          max={max}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-24 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm px-3 py-1.5 focus:outline-none focus:border-[#C9A84C]/40"
        />
        <span className="text-xs text-white/30">days</span>
      </div>
    </div>
  );
}
