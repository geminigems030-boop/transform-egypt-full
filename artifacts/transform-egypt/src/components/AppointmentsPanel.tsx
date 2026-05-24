import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar, Search, RefreshCw, Loader2, Upload, CheckCircle, XCircle,
  Clock, AlertTriangle, ChevronDown, ChevronUp, Plus, X, User, Phone,
  Scissors, MapPin, Star, ExternalLink, TrendingUp, DatabaseZap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Appointment {
  id: number;
  clientId: number;
  clientName: string | null;
  clientPhone: string;
  service: string;
  branch: string | null;
  stylist: string | null;
  scheduledAt: string;
  durationMinutes: number | null;
  price: string | null;
  status: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
}

interface ApptListResult {
  appointments: Appointment[];
  total: number;
  page: number;
  pages: number;
}

interface UploadResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
  total: number;
}

interface SyncResult {
  clientsCreated: number;
  clientsMatched: number;
  appointmentsImported: number;
  skipped: number;
  total: number;
}

interface ClientVisit {
  id: number;
  service: string;
  branch: string | null;
  stylist: string | null;
  scheduledAt: string;
  price: string | null;
  status: string;
  source: string | null;
}

interface ClientProfile {
  client: {
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
  };
  visits: ClientVisit[];
}

const STATUS_BADGE: Record<string, string> = {
  lead: 'bg-yellow-500/15 text-yellow-400',
  scheduled: 'bg-sky-500/15 text-sky-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-violet-500/15 text-violet-400',
  cancelled: 'bg-rose-500/15 text-rose-400',
  rescheduled: 'bg-amber-500/15 text-amber-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[status] ?? 'bg-white/10 text-white/40'}`}>
      {status}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtPrice(p: string | null) {
  if (!p) return '—';
  const n = parseFloat(p);
  return isNaN(n) ? p : `EGP ${n.toLocaleString()}`;
}

export default function AppointmentsPanel({ token }: { token: string }) {
  const headers = { 'X-Admin-Token': token };

  const [data, setData] = useState<ApptListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const [addOpen, setAddOpen] = useState(false);

  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const openClientProfile = useCallback(async (clientId: number) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as ClientProfile;
      setClientProfile(json);
    } catch {
      // silently ignore — profile panel just won't open
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  const fetchData = useCallback(async (pg = page) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(pg), limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (branchFilter) params.set('branch', branchFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    try {
      const res = await fetch(`/api/admin/appointments?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as ApptListResult;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, branchFilter, sourceFilter, dateFrom, dateTo, page, token]);

  useEffect(() => { void fetchData(1); }, []);

  const applyFilters = () => { setPage(1); void fetchData(1); };
  const resetFilters = () => {
    setSearch(''); setStatusFilter(''); setBranchFilter(''); setSourceFilter(''); setDateFrom(''); setDateTo('');
    setPage(1);
    setTimeout(() => void fetchData(1), 0);
  };

  const doAction = async (id: number, action: string, body?: Record<string, unknown>) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/appointments/${id}/${action}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((j.error as string) ?? `HTTP ${res.status}`);
      }
      void fetchData(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncBookings = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError('');
    try {
      const res = await fetch('/api/admin/appointments/sync-bookings', {
        method: 'POST',
        headers,
      });
      const json = await res.json() as SyncResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSyncResult(json);
      void fetchData(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/appointments/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
      const json = await res.json() as UploadResult;
      setUploadResult(json);
      void fetchData(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const appointments = data?.appointments ?? [];

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Appointments</h2>
          {data && <p className="text-xs text-white/40 mt-0.5">{data.total} total</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSyncBookings} disabled={syncing}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">
            {syncing
              ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" />
              : <DatabaseZap className="w-3.5 h-3.5 me-1.5" />}
            {syncing ? 'Syncing…' : 'Sync Legacy Bookings'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">
            <Upload className="w-3.5 h-3.5 me-1.5" /> Upload Sheet
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}
            className="bg-gold text-black hover:bg-gold/90">
            <Plus className="w-3.5 h-3.5 me-1.5" /> Add
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchData(page)} disabled={loading}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          <button className="ml-auto text-rose-400 hover:text-rose-200" onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Sync result banner */}
      {syncResult && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-white flex items-center gap-2">
              <DatabaseZap className="w-4 h-4 text-gold" /> Legacy Sync Complete
            </p>
            <button onClick={() => setSyncResult(null)}><X className="w-4 h-4 text-white/40 hover:text-white" /></button>
          </div>
          <div className="flex gap-4 text-xs flex-wrap">
            <span className="text-emerald-400">✓ {syncResult.appointmentsImported} appointments imported</span>
            <span className="text-sky-400">+ {syncResult.clientsCreated} new clients</span>
            <span className="text-white/50">~ {syncResult.clientsMatched} existing clients matched</span>
            {syncResult.skipped > 0 && (
              <span className="text-amber-400">↺ {syncResult.skipped} already synced / skipped</span>
            )}
            <span className="text-white/30">({syncResult.total} bookings total)</span>
          </div>
        </div>
      )}

      {/* Upload result banner */}
      {uploadResult && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-white">Upload Complete</p>
            <button onClick={() => setUploadResult(null)}><X className="w-4 h-4 text-white/40 hover:text-white" /></button>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-emerald-400">✓ {uploadResult.created} created</span>
            <span className="text-amber-400">↺ {uploadResult.updated} updated</span>
            {uploadResult.errors.length > 0 && (
              <span className="text-rose-400">✗ {uploadResult.errors.length} errors</span>
            )}
          </div>
          {uploadResult.errors.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {uploadResult.errors.map((e) => (
                <p key={e.row} className="text-xs text-rose-300">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              placeholder="Name, phone, service…"
              className="w-full bg-black/40 border border-white/15 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-gold/60 placeholder:text-white/30"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60">
            <option value="">All statuses</option>
            {['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'].map(s => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60">
            <option value="">All</option>
            <option value="booking_form">Website Booking</option>
            <option value="admin">Admin</option>
            <option value="upload">Upload</option>
            <option value="legacy">Legacy</option>
            <option value="yara">Yara</option>
            <option value="yara-call">Yara Call</option>
          </select>
          <input
            value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            placeholder="Branch…"
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60 placeholder:text-white/30"
          />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60"
            placeholder="From" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60"
            placeholder="To" />
          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters} className="bg-gold text-black hover:bg-gold/90 flex-1">Apply</Button>
            <Button size="sm" variant="outline" onClick={resetFilters}
              className="border-white/20 text-white hover:bg-white/10 hover:text-white">Reset</Button>
          </div>
        </div>
      </div>

      {/* Appointments list */}
      {loading && appointments.length === 0 ? (
        <div className="flex justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin me-2" /> Loading…
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center text-white/40">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No appointments found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((appt) => {
            const isOpen = expanded === appt.id;
            const isActing = actionLoading === appt.id;
            return (
              <div key={appt.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpanded(isOpen ? null : appt.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{appt.clientName ?? appt.clientPhone}</span>
                      <StatusBadge status={appt.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40 flex-wrap">
                      <span>{appt.service}</span>
                      {appt.branch && <><span>·</span><span>{appt.branch}</span></>}
                      {appt.stylist && <><span>·</span><span>{appt.stylist}</span></>}
                      <span>·</span>
                      <span>{fmtDate(appt.scheduledAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {appt.price && <span className="text-xs text-gold font-medium">{fmtPrice(appt.price)}</span>}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-white/10 px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <InfoBox icon={<Phone className="w-3 h-3" />} label="Phone" value={appt.clientPhone} />
                      <InfoBox icon={<Scissors className="w-3 h-3" />} label="Service" value={appt.service} />
                      {appt.branch && <InfoBox icon={<MapPin className="w-3 h-3" />} label="Branch" value={appt.branch} />}
                      {appt.stylist && <InfoBox icon={<User className="w-3 h-3" />} label="Stylist" value={appt.stylist} />}
                      {appt.price && <InfoBox icon={<Star className="w-3 h-3" />} label="Price" value={fmtPrice(appt.price)} />}
                      {appt.durationMinutes && <InfoBox icon={<Clock className="w-3 h-3" />} label="Duration" value={`${appt.durationMinutes} min`} />}
                    </div>
                    {appt.notes && (
                      <p className="text-xs text-white/50 bg-black/20 rounded-lg px-3 py-2">{appt.notes}</p>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      {/* View full client profile */}
                      <Button size="sm" variant="outline" disabled={profileLoading}
                        onClick={() => openClientProfile(appt.clientId)}
                        className="border-gold/30 text-gold hover:bg-gold/10 hover:text-gold">
                        {profileLoading ? <Loader2 className="w-3.5 h-3.5 me-1 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 me-1" />}
                        View Client Profile
                      </Button>
                      {/* Action buttons */}
                      {!['completed', 'cancelled'].includes(appt.status) && (
                        <div className="flex flex-wrap gap-2">
                          {appt.status !== 'confirmed' && (
                            <Button size="sm" disabled={isActing} onClick={() => doAction(appt.id, 'confirm')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white">
                              <CheckCircle className="w-3.5 h-3.5 me-1" />
                              {isActing ? 'Working…' : 'Confirm'}
                            </Button>
                          )}
                          <Button size="sm" disabled={isActing} onClick={() => doAction(appt.id, 'complete')}
                            className="bg-violet-600 hover:bg-violet-500 text-white">
                            <Star className="w-3.5 h-3.5 me-1" />
                            {isActing ? 'Working…' : 'Mark Done'}
                          </Button>
                          <RescheduleButton disabled={isActing} onReschedule={(dt) => doAction(appt.id, 'reschedule', { scheduledAt: dt })} />
                          <Button size="sm" variant="outline" disabled={isActing}
                            onClick={() => doAction(appt.id, 'cancel')}
                            className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
                            <XCircle className="w-3.5 h-3.5 me-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void fetchData(p); }}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">Prev</Button>
          <span className="text-xs text-white/40">Page {page} of {data.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => { const p = page + 1; setPage(p); void fetchData(p); }}
            className="border-white/20 text-white hover:bg-white/10 hover:text-white">Next</Button>
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <UploadModal
          uploading={uploading}
          onClose={() => setUploadOpen(false)}
          onFile={handleFileUpload}
          fileRef={fileRef}
        />
      )}

      {/* Add appointment modal */}
      {addOpen && (
        <AddAppointmentModal
          token={token}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); void fetchData(1); }}
        />
      )}

      {/* Client profile slide-over */}
      {clientProfile && (
        <ClientProfileSlideOver
          profile={clientProfile}
          onClose={() => setClientProfile(null)}
        />
      )}
    </div>
  );
}

function InfoBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-black/20 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 text-white/40 mb-1">{icon}<span className="uppercase tracking-wider text-[9px]">{label}</span></div>
      <div className="text-white text-xs font-medium">{value}</div>
    </div>
  );
}

function RescheduleButton({ disabled, onReschedule }: { disabled: boolean; onReschedule: (dt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dt, setDt] = useState('');

  if (!open) {
    return (
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}
        className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
        <Clock className="w-3.5 h-3.5 me-1" /> Reschedule
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)}
        className="bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-gold/60" />
      <Button size="sm" disabled={disabled || !dt} onClick={() => { onReschedule(new Date(dt).toISOString()); setOpen(false); }}
        className="bg-amber-600 hover:bg-amber-500 text-white">Save</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="text-white/40 hover:text-white hover:bg-white/10">
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function UploadModal({ uploading, onClose, onFile, fileRef }: {
  uploading: boolean;
  onClose: () => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Upload Appointment Sheet</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-white/40 hover:text-white" /></button>
        </div>
        <p className="text-sm text-white/50 mb-4">
          Upload a CSV or Excel file. Required columns: <code className="text-gold">phone</code>, <code className="text-gold">service</code>, <code className="text-gold">date</code>.
          Optional: name, branch, stylist, time, price, notes.
        </p>
        <div
          className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-gold/40 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gold mb-2" />
          ) : (
            <Upload className="w-8 h-8 mx-auto text-white/30 mb-2" />
          )}
          <p className="text-sm text-white/50">{uploading ? 'Uploading…' : 'Click to select or drag & drop'}</p>
          <p className="text-xs text-white/30 mt-1">CSV, XLS, XLSX</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => { onFile(e); onClose(); }} />
      </div>
    </div>
  );
}

function AddAppointmentModal({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ clientName: '', clientPhone: '', service: '', branch: '', stylist: '', scheduledAt: '', price: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const body = { ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined };
      const res = await fetch('/api/admin/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify(body),
      });
      const j = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((j.error as string) ?? 'Save failed');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">New Appointment</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-white/40 hover:text-white" /></button>
        </div>
        {err && <p className="text-rose-400 text-xs mb-3">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client Name" value={form.clientName} onChange={set('clientName')} placeholder="Sara Mohamed" />
            <Field label="Phone *" value={form.clientPhone} onChange={set('clientPhone')} placeholder="+201234567890" required />
          </div>
          <Field label="Service *" value={form.service} onChange={set('service')} placeholder="Hair Extensions" required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Branch" value={form.branch} onChange={set('branch')} placeholder="Zamalek" />
            <Field label="Stylist" value={form.stylist} onChange={set('stylist')} placeholder="Nadia" />
          </div>
          <Field label="Date & Time *" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} required />
          <Field label="Price (EGP)" value={form.price} onChange={set('price')} placeholder="1500" />
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60 resize-none placeholder:text-white/30"
              placeholder="Any special requests…" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="bg-gold text-black hover:bg-gold/90 flex-1">
              {saving ? 'Saving…' : 'Save Appointment'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}
              className="border-white/20 text-white hover:bg-white/10 hover:text-white">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, type = 'text' }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/60 placeholder:text-white/30"
      />
    </div>
  );
}

const STATUS_BADGE_SLIDE: Record<string, string> = {
  lead: 'bg-yellow-500/15 text-yellow-400',
  scheduled: 'bg-sky-500/15 text-sky-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-violet-500/15 text-violet-400',
  cancelled: 'bg-rose-500/15 text-rose-400',
  rescheduled: 'bg-amber-500/15 text-amber-400',
};

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website',
  'legacy-sync': 'Legacy',
  legacy_booking: 'Legacy',
  upload: 'Upload',
  admin: 'Admin',
  yara: 'Yara',
  'yara-call': 'Yara Call',
};

const SOURCE_BADGE_STYLE: Record<string, string> = {
  website: 'bg-sky-500/15 text-sky-400',
  'legacy-sync': 'bg-amber-500/15 text-amber-400',
  legacy_booking: 'bg-amber-500/15 text-amber-400',
  upload: 'bg-violet-500/15 text-violet-400',
  admin: 'bg-white/10 text-white/50',
  yara: 'bg-gold/15 text-gold',
  'yara-call': 'bg-yellow-500/20 text-yellow-300',
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const label = SOURCE_LABEL[source] ?? source;
  const style = SOURCE_BADGE_STYLE[source] ?? 'bg-white/10 text-white/40';
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style}`}>
      {label}
    </span>
  );
}

function fmtDateShort(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ClientProfileSlideOver({ profile, onClose }: { profile: ClientProfile; onClose: () => void }) {
  const { client, visits } = profile;
  const spend = parseFloat(client.totalSpend ?? '0');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-md bg-neutral-900 border-l border-white/10 h-full overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-white/10 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-semibold text-white">{client.name ?? 'Unknown Client'}</h3>
            <p className="text-xs text-white/40 mt-0.5">{client.phone}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Visits</p>
              <p className="text-xl font-bold text-white">{client.visitCount}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-3 text-center col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Total Spend</p>
              <p className="text-xl font-bold text-gold">
                {isNaN(spend) ? '—' : `EGP ${spend.toLocaleString()}`}
              </p>
            </div>
          </div>

          {/* Contact details */}
          <div className="space-y-2">
            {client.email && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <TrendingUp className="w-3.5 h-3.5 text-white/30 shrink-0" />
                {client.email}
              </div>
            )}
            {client.preferredBranch && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <MapPin className="w-3.5 h-3.5 text-white/30 shrink-0" />
                Preferred branch: {client.preferredBranch}
              </div>
            )}
            {client.firstVisit && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Calendar className="w-3.5 h-3.5 text-white/30 shrink-0" />
                First visit: {fmtDateShort(client.firstVisit)}
                {client.lastVisit && <> · Last: {fmtDateShort(client.lastVisit)}</>}
              </div>
            )}
            {client.notes && (
              <p className="text-xs text-white/50 bg-black/20 rounded-lg px-3 py-2 mt-1">{client.notes}</p>
            )}
          </div>

          {/* Visit history */}
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">
              Visit History ({visits.length})
            </p>
            {visits.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-6">No visits recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {visits.map((v) => (
                  <div key={v.id} className="bg-black/20 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white font-medium">{v.service}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <SourceBadge source={v.source} />
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE_SLIDE[v.status] ?? 'bg-white/10 text-white/40'}`}>
                          {v.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-white/40 flex-wrap">
                      <span>{fmtDateShort(v.scheduledAt)}</span>
                      {v.branch && <><span>·</span><span>{v.branch}</span></>}
                      {v.stylist && <><span>·</span><span>{v.stylist}</span></>}
                      {v.price && (
                        <>
                          <span>·</span>
                          <span className="text-gold">
                            {`EGP ${parseFloat(v.price).toLocaleString()}`}
                          </span>
                        </>
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
