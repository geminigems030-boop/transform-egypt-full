import { useCallback, useEffect, useState } from 'react';
import {
  Share2, Instagram, Facebook, MessageCircle, RefreshCw, Loader2,
  CheckCircle, XCircle, AlertTriangle, Bot, Sparkles, Send, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type AIMode = 'off' | 'suggest' | 'auto';

interface SocialSettings {
  modeDms: AIMode;
  modeComments: AIMode;
}

interface PlatformStatus {
  manychat: boolean;
  meta: boolean;
  gemini: boolean;
  anthropic: boolean;
}

interface Props {
  token: string;
}

const MODE_INFO: Record<AIMode, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  off: {
    label: 'Off',
    desc: 'Yara does nothing — no drafts, no replies.',
    icon: <EyeOff className="w-4 h-4" />,
    color: 'text-white/50',
  },
  suggest: {
    label: 'Suggest',
    desc: 'Yara drafts a reply for you to approve in the Inbox.',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-amber-400',
  },
  auto: {
    label: 'Auto',
    desc: 'Yara sends replies instantly. Escalations always wait for review.',
    icon: <Send className="w-4 h-4" />,
    color: 'text-emerald-400',
  },
};

export default function SocialPanel({ token }: Props) {
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [platforms, setPlatforms] = useState<PlatformStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const headers = { 'X-Admin-Token': token, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/social/settings', {
        headers: { 'X-Admin-Token': token },
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setSettings(data.settings ?? null);
      setPlatforms(data.platforms ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const setMode = async (channel: 'dms' | 'comments', mode: AIMode) => {
    setSaving(channel);
    setSaveSuccess(false);
    setError('');
    try {
      const res = await fetch('/api/admin/social/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ channel, mode }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setSettings(data.settings ?? null);
      setPlatforms(data.platforms ?? null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
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
            <Share2 className="w-6 h-6 text-[#C9A84C]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Social AI Automation</h2>
            <p className="text-sm text-white/50">Yara's auto-reply on Instagram, Facebook & TikTok</p>
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
          Saved
        </div>
      )}

      {/* Channel mode controls */}
      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChannelCard
            icon={<MessageCircle className="w-5 h-5 text-pink-400" />}
            title="Direct Messages"
            description="Instagram, Facebook & TikTok DMs"
            current={settings.modeDms}
            saving={saving === 'dms'}
            onChange={(m) => setMode('dms', m)}
          />
          <ChannelCard
            icon={<MessageCircle className="w-5 h-5 text-blue-400" />}
            title="Post Comments"
            description="Replies to comments on your posts"
            current={settings.modeComments}
            saving={saving === 'comments'}
            onChange={(m) => setMode('comments', m)}
          />
        </div>
      )}

      {/* Platform connection status */}
      {platforms && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-white">Platform Connections</h3>
          </div>
          <p className="text-xs text-white/40 mb-4">
            Yara needs ManyChat (to receive & send IG/FB/TikTok DMs) and Claude (to write replies).
            Voice transcription of DM voice notes uses Gemini.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatusCard
              icon={<MessageCircle className="w-4 h-4" />}
              label="ManyChat"
              connected={platforms.manychat}
              hint="DM delivery"
            />
            <StatusCard
              icon={<Instagram className="w-4 h-4" />}
              label="Meta Graph"
              connected={platforms.meta}
              hint="Webhook + comments"
            />
            <StatusCard
              icon={<Bot className="w-4 h-4" />}
              label="Claude AI"
              connected={platforms.anthropic}
              hint="Reply drafting"
            />
            <StatusCard
              icon={<Facebook className="w-4 h-4" />}
              label="Gemini"
              connected={platforms.gemini}
              hint="Voice notes"
            />
          </div>
          {!platforms.anthropic && (
            <p className="mt-4 text-xs text-amber-400/80 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Claude is not connected — Yara can't generate replies until the AI integration is configured.
            </p>
          )}
          {!platforms.manychat && (
            <p className="mt-2 text-xs text-amber-400/80 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ManyChat is not connected — inbound DMs won't reach Yara and auto-replies can't be delivered.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ChannelCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  current: AIMode;
  saving: boolean;
  onChange: (mode: AIMode) => void;
}

function ChannelCard({ icon, title, description, current, saving, onChange }: ChannelCardProps) {
  const modes: AIMode[] = ['off', 'suggest', 'auto'];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-1.5 rounded-lg bg-white/[0.06]">{icon}</div>
        <div>
          <p className="text-sm font-medium text-white flex items-center gap-2">
            {title}
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A84C]" />}
          </p>
          <p className="text-xs text-white/40 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => {
          const info = MODE_INFO[m];
          const active = current === m;
          return (
            <button
              key={m}
              onClick={() => !active && onChange(m)}
              disabled={saving}
              className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                active
                  ? 'border-[#C9A84C]/60 bg-[#C9A84C]/10 text-white'
                  : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white hover:border-white/20'
              }`}
            >
              <span className={active ? info.color : ''}>{info.icon}</span>
              {info.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-white/40">{MODE_INFO[current].desc}</p>
    </div>
  );
}

interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  hint: string;
}

function StatusCard({ icon, label, connected, hint }: StatusCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-white/50">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      {connected ? (
        <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
          <CheckCircle className="w-3.5 h-3.5" /> Connected
        </span>
      ) : (
        <span className="flex items-center gap-1 text-rose-400/80 text-xs font-medium">
          <XCircle className="w-3.5 h-3.5" /> Not set
        </span>
      )}
      <p className="text-[10px] text-white/25">{hint}</p>
    </div>
  );
}
