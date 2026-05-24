import { useCallback, useEffect, useState } from 'react';
import {
  Users, Search, RefreshCw, Loader2, X, AlertTriangle,
  Phone, Mail, MapPin, Calendar, TrendingUp, Clock, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Client {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  preferredBranch: string | null;
  notes: string | null;
  firstVisit: string | null;
  lastVisit: string | null;
  totalSpend: string;
  visitCount: number;
  createdAt: string;
}

interface Appointment {
  id: number;
  service: string;
  branch: string | null;
  stylist: string | null;
  scheduledAt: string;
  price: string | null;
  status: string;
}

interface ClientsResult {
  clients: Client[];
  total: number;
  page: number;
  pages: number;
}

interface ClientProfile {
  client: Client;
  visits: Appointment[];
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-sky-500/15 text-sky-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-violet-500/15 text-violet-400',
  cancelled: 'bg-rose-500/15 text-rose-400',
  rescheduled: 'bg-amber-500/15 text-amber-400',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtPrice(p: string | null) {
  if (!p) return '—';
  const n = parseFloat(p);
  return isNaN(n) ? p : `EGP ${n.toLocaleString()}`;
}

function fmtSpend(p: string) {
  const n = parseFloat(p ?? '0');
  return isNaN(n) ? '—' : `EGP ${n.toLocaleString()}`;
}

export default function ClientsPanel({ token }: { token: string }) {
  const headers = { 'X-Admin-Token': token };

  const [data, setData] = useState<ClientsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<ClientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchData = useCallback(async (pg = page, q = search) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(pg), limit: '50' });
    if (q.trim()) params.set('search', q.trim());
    try {
      const res = await fetch(`/api/admin/clients?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as ClientsResult;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [page, search, token]);

  useEffect(() => { void fetchData(1, ''); }, []);

  const applySearch = () => { setPage(1); void fetchData(1, search); };
  const resetSearch = () => { setSearch(''); setPage(1); void fetchData(1, ''); };

  const openProfile = async (id: number) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as ClientProfile;
      setSelected(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setProfileLoading(false);
    }
  };

  const clients = data?.clients ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Client CRM</h2>
          {data && <p className="text-xs text-white/40 mt-0.5">{data.total} clients</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(page)} disabled={loading}
          className="border-white/20 text-white hover:bg-white/10 hover:text-white">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          <button className="ml-auto text-rose-400 hover:text-rose-200" onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Search */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySearch()}
              placeholder="Search by name, phone, or email…"
              className="w-full bg-black/40 border border-white/15 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-gold/60 placeholder:text-white/30"
            />
          </div>
          <Button size="sm" onClick={applySearch} className="bg-gold text-black hover:bg-gold/90">Search</Button>
          <Button size="sm" variant="outline" onClick={resetSearch}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">Reset</Button>
        </div>
      </div>

      {/* Client list */}
      {loading && clients.length === 0 ? (
        <div className="flex justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin me-2" /> Loading…
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center text-white/40">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No clients found. Clients are created automatically when appointments are imported.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/40">Client</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/40 hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/40 hidden lg:table-cell">Last Visit</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/40 hidden sm:table-cell">Visits</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/40 hidden sm:table-cell">Total Spend</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id}
                  className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                  onClick={() => openProfile(c.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{c.name ?? '—'}</div>
                    <div className="text-xs text-white/40 md:hidden">{c.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-white/60 hidden md:table-cell">{c.phone}</td>
                  <td className="px-4 py-3 text-white/60 hidden lg:table-cell">{fmtDate(c.lastVisit)}</td>
                  <td className="px-4 py-3 text-right text-white hidden sm:table-cell">{c.visitCount}</td>
                  <td className="px-4 py-3 text-right text-gold font-medium hidden sm:table-cell">{fmtSpend(c.totalSpend)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-white/30 hover:text-white">View →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); void fetchData(p); }}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">Prev</Button>
          <span className="text-xs text-white/40">Page {page} of {data.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages}
            onClick={() => { const p = page + 1; setPage(p); void fetchData(p); }}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">Next</Button>
        </div>
      )}

      {/* Profile slide-over */}
      {selected && (
        <ClientProfileModal
          profile={selected}
          loading={profileLoading}
          onClose={() => setSelected(null)}
        />
      )}

      {profileLoading && !selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      )}
    </div>
  );
}

function ClientProfileModal({ profile, loading, onClose }: { profile: ClientProfile; loading: boolean; onClose: () => void }) {
  const { client, visits } = profile;
  const completedVisits = visits.filter(v => v.status === 'completed');

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 cursor-pointer" onClick={onClose} />
      <div className="w-full max-w-md bg-neutral-900 border-l border-white/10 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">{client.name ?? 'Unknown Client'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-white/40 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gold" /></div>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Calendar className="w-4 h-4" />} label="Total Visits" value={String(client.visitCount)} />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Spend" value={fmtSpend(client.totalSpend)} gold />
            <StatCard icon={<Clock className="w-4 h-4" />} label="Last Visit" value={fmtDate(client.lastVisit)} small />
          </div>

          {/* Contact info */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Contact Info</p>
            <InfoRow icon={<Phone className="w-3.5 h-3.5" />} value={client.phone} />
            {client.email && <InfoRow icon={<Mail className="w-3.5 h-3.5" />} value={client.email} />}
            {client.preferredBranch && <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} value={client.preferredBranch} />}
            {client.firstVisit && <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="First visit" value={fmtDate(client.firstVisit)} />}
            {client.notes && <InfoRow icon={<Star className="w-3.5 h-3.5" />} label="Notes" value={client.notes} />}
          </div>

          {/* Visit history */}
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">
              Visit History ({completedVisits.length} completed)
            </p>
            {visits.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-6">No appointments yet.</p>
            ) : (
              <div className="space-y-2">
                {visits.map((v) => (
                  <div key={v.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{v.service}</span>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full capitalize ${STATUS_BADGE[v.status] ?? 'bg-white/10 text-white/40'}`}>
                            {v.status}
                          </span>
                        </div>
                        <div className="text-xs text-white/40 mt-1 flex flex-wrap gap-2">
                          <span>{fmtDate(v.scheduledAt)}</span>
                          {v.branch && <><span>·</span><span>{v.branch}</span></>}
                          {v.stylist && <><span>·</span><span>{v.stylist}</span></>}
                        </div>
                      </div>
                      {v.price && (
                        <span className="text-xs text-gold font-medium shrink-0">{fmtPrice(v.price)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, gold, small }: { icon: React.ReactNode; label: string; value: string; gold?: boolean; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <div className={`flex justify-center mb-1 ${gold ? 'text-gold' : 'text-white/40'}`}>{icon}</div>
      <div className={`font-semibold ${small ? 'text-xs' : 'text-base'} ${gold ? 'text-gold' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label?: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-white/40 mt-0.5 shrink-0">{icon}</span>
      <span className="text-white/70">{label ? <><span className="text-white/40">{label}: </span>{value}</> : value}</span>
    </div>
  );
}
