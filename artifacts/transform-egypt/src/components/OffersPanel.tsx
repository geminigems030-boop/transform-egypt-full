import { useCallback, useEffect, useState } from 'react';
import {
  Tag, RefreshCw, Loader2, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Offer {
  id: number;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

interface Props {
  token: string;
}

export default function OffersPanel({ token }: Props) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');

  const headers = { 'X-Admin-Token': token, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/offers', { headers: { 'X-Admin-Token': token } });
      if (!res.ok) throw new Error('Failed to load offers');
      const data = await res.json();
      setOffers(data.offers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 2500); };

  const create = async () => {
    if (!title.trim()) return;
    setBusy('new');
    setError('');
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          titleAr: titleAr.trim() || undefined,
          description: description.trim() || undefined,
          descriptionAr: descriptionAr.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      setTitle(''); setTitleAr(''); setDescription(''); setDescriptionAr('');
      flash('Offer added — live on the site & Yara now');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (o: Offer) => {
    setBusy(o.id);
    try {
      const res = await fetch(`/api/admin/offers/${o.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ active: !o.active }),
      });
      if (!res.ok) throw new Error('Update failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: number) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/offers/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Delete failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20">
            <Tag className="w-6 h-6 text-[#C9A84C]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Offers & Promotions</h2>
            <p className="text-sm text-white/50">Add a promo — it shows on the website and Yara starts recommending it instantly</p>
          </div>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="border-white/10 text-white/60 hover:text-white bg-transparent" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-4 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 p-3 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* New offer form */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-[#C9A84C]" /> New Offer</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (English) *"
            className="rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm px-3 py-2 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40" />
          <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="العنوان (بالعربي)" dir="rtl"
            className="rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm px-3 py-2 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (English)"
            className="rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm px-3 py-2 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40" />
          <input value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} placeholder="الوصف (بالعربي)" dir="rtl"
            className="rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm px-3 py-2 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40" />
        </div>
        <Button onClick={create} size="sm" disabled={!title.trim() || busy === 'new'} className="bg-[#C9A84C] hover:bg-[#b8953f] text-black text-xs">
          {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          Add Offer
        </Button>
      </div>

      {/* Offers list */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white mb-4">All Offers</h3>
        {offers.length === 0 ? (
          <p className="text-xs text-white/30 italic text-center py-8">No offers yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {offers.map((o) => (
              <div key={o.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${o.active ? 'border-[#C9A84C]/30 bg-[#C9A84C]/[0.04]' : 'border-white/10 bg-white/[0.02] opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{o.title}</span>
                    {o.titleAr && <span className="text-sm text-white/50" dir="rtl">{o.titleAr}</span>}
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${o.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
                      {o.active ? 'Live' : 'Off'}
                    </span>
                  </div>
                  {o.description && <p className="text-xs text-white/50 mt-1">{o.description}</p>}
                  {o.descriptionAr && <p className="text-xs text-white/40 mt-0.5" dir="rtl">{o.descriptionAr}</p>}
                </div>
                <button onClick={() => toggle(o)} disabled={busy === o.id} title={o.active ? 'Disable' : 'Enable'} className="shrink-0">
                  {o.active ? <ToggleRight className="w-7 h-7 text-[#C9A84C]" /> : <ToggleLeft className="w-7 h-7 text-white/30" />}
                </button>
                <button onClick={() => remove(o.id)} disabled={busy === o.id} title="Delete" className="shrink-0 text-white/30 hover:text-rose-400 transition-colors mt-0.5">
                  {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
