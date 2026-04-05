import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  LayoutDashboard, BadgeCheck, TicketCheck, Users, LogOut,
  CheckCircle, XCircle, Clock, AlertTriangle, Shield,
  TrendingUp, Wrench, ChevronDown, ChevronUp,
  Search, RefreshCw, Menu, X, Star, FileText
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Avatar({ name, size = 'md' }) {
  const initials = (name || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sz} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

const DISPUTE_STATUS_LABEL = {
  open:     'Deschis',
  assigned: 'Alocat',
  resolved: 'Rezolvat',
  closed:   'Închis',
}

const HANDYMAN_STATUS_LABEL = {
  pending:  'În așteptare',
  approved: 'Aprobat',
  rejected: 'Respins',
}

// ─── Sidebar nav items ─────────────────────────────────────────────────────────

const NAV = [
  { id: 'overview',      label: 'Prezentare generală',  icon: LayoutDashboard },
  { id: 'certifications', label: 'Verificări Meșteri',   icon: BadgeCheck },
  { id: 'disputes',      label: 'Dispute & Conflicte',  icon: TicketCheck },
  { id: 'users',         label: 'Utilizatori',            icon: Users },
]

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Section: Overview ────────────────────────────────────────────────────────

function OverviewSection({ stats }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Prezentare Generală</h2>
        <p className="text-sm text-gray-500">Statistici platformă HandyConnect</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Clienți înregistrați"   value={stats.clients}      icon={Users}      color="bg-blue-50 text-blue-600"    sub="Total conturi active" />
        <StatCard label="Meșteri înregistrați"   value={stats.handymen}     icon={Wrench}     color="bg-purple-50 text-purple-600" sub="Total conturi active" />
        <StatCard label="Meșteri în așteptare"   value={stats.pending}      icon={Clock}      color="bg-yellow-50 text-yellow-600" sub="Necesită aprobare profil" />
        <StatCard label="Dispute deschise"       value={stats.openDisputes} icon={TicketCheck} color="bg-red-50 text-red-500"      sub="Necesită intervenție" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" /> Meșteri recenți neaprobați
        </h3>
        {stats.recentPending?.length > 0 ? (
          <div className="space-y-3">
            {stats.recentPending.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                <p className="text-sm text-gray-600 flex-1">
                  <strong>{item.profiles?.first_name} {item.profiles?.last_name}</strong> — profil meșter în așteptare
                </p>
                <span className="text-xs text-gray-400">{fmtDate(item.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Nu există meșteri în așteptare de aprobare.</p>
        )}
      </div>
    </div>
  )
}

// ─── Section: Certifications (handyman profile approval) ──────────────────────

function CertificationsSection() {
  const [handymen, setHandymen] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('handyman_profiles')
      .select(`
        user_id, bio, status, is_verified, specialties,
        experience_years, hourly_rate, primary_city,
        profiles!inner(first_name, last_name, email)
      `)
      .order('user_id')

    if (!error) setHandymen(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const matchesFilter = (h) => {
    if (filter === 'all') return true
    if (filter === 'approved') return h.is_verified === true || h.status === 'approved'
    if (filter === 'rejected') return h.status === 'rejected'
    // 'pending': is_verified false/null și status nu e 'approved' sau 'rejected'
    return !h.is_verified && h.status !== 'approved' && h.status !== 'rejected'
  }

  const filtered = handymen.filter(h => {
    const name = `${h.profiles?.first_name ?? ''} ${h.profiles?.last_name ?? ''}`.toLowerCase()
    const matchSearch = name.includes(search.toLowerCase()) || h.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter(h) && matchSearch
  })

  async function handleDecision(userId, approve) {
    const key = userId + (approve ? 'approve' : 'reject')
    setActionLoading(key)
    const { error } = await supabase
      .from('handyman_profiles')
      .update({
        status: approve ? 'approved' : 'rejected',
        is_verified: approve,
      })
      .eq('user_id', userId)
    if (!error) {
      showToast(approve ? 'Profil aprobat!' : 'Profil respins.', approve ? 'success' : 'error')
      load()
    }
    setActionLoading(null)
  }

  const statusBadge = (status, isVerified) => {
    if (status === 'approved' || isVerified) {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Aprobat</span>
    }
    if (status === 'rejected') {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Respins</span>
    }
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">În așteptare</span>
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Verificări Meșteri</h2>
          <p className="text-sm text-gray-500">Aprobă sau respinge profilurile meșterilor înregistrați</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition">
          <RefreshCw className="w-4 h-4" /> Actualizează
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Cum funcționează:</strong> Meșterii se înregistrează și completează profilul (specialități, experiență, zonă).
        Adminul aprobă profilul → meșterul devine vizibil pe platformă cu badge-ul <strong>Verificat</strong>.
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută după nume sau email..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {f === 'all' ? 'Toți' : HANDYMAN_STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BadgeCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Niciun meșter găsit</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(h => {
              const fullName = `${h.profiles?.first_name ?? ''} ${h.profiles?.last_name ?? ''}`.trim() || 'Necunoscut'
              const isOpen = expanded === h.user_id
              const isPending = !h.is_verified && h.status !== 'rejected'

              return (
                <div key={h.user_id} className="p-4">
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : h.user_id)}
                  >
                    <Avatar name={fullName} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{h.profiles?.email}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 text-xs text-gray-400">
                      <span>{h.primary_city ?? '—'}</span>
                      <span>{h.experience_years ? `${h.experience_years} ani exp.` : '—'}</span>
                    </div>
                    {statusBadge(h.status, h.is_verified)}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>

                  {isOpen && (
                    <div className="mt-4 pl-14 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs mb-0.5">Email</p>
                          <p className="font-medium text-gray-700 truncate">{h.profiles?.email ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-0.5">Tarif orar</p>
                          <p className="font-medium text-gray-700">{h.hourly_rate ? `${h.hourly_rate} RON/h` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-0.5">Experiență</p>
                          <p className="font-medium text-gray-700">{h.experience_years ? `${h.experience_years} ani` : '—'}</p>
                        </div>
                      </div>

                      {h.specialties?.length > 0 && (
                        <div>
                          <p className="text-gray-400 text-xs mb-1.5">Specialități declarate</p>
                          <div className="flex flex-wrap gap-1.5">
                            {h.specialties.map((s, i) => (
                              <span key={i} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {h.bio && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">Bio</p>
                          <p className="text-sm text-gray-700">{h.bio}</p>
                        </div>
                      )}

                      {isPending && (
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleDecision(h.user_id, true)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                          >
                            {actionLoading === h.user_id + 'approve'
                              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <CheckCircle className="w-4 h-4" />}
                            Aprobă profil
                          </button>
                          <button
                            onClick={() => handleDecision(h.user_id, false)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                          >
                            {actionLoading === h.user_id + 'reject'
                              ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              : <XCircle className="w-4 h-4" />}
                            Respinge
                          </button>
                        </div>
                      )}

                      {h.is_verified && (
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleDecision(h.user_id, false)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Revocă aprobare
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section: Disputes (task_disputes) ────────────────────────────────────────

function DisputesSection() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [resolutionNote, setResolutionNote] = useState({})
  const [actionLoading, setActionLoading] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('task_disputes')
      .select(`
        id, status, resolution_note,
        tasks(title, description, client_id,
          profiles!tasks_client_id_fkey(first_name, last_name, email)),
        rejection_reasons(name)
      `)
      .order('id')

    if (!error) setDisputes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = disputes.filter(d => {
    const matchStatus = filter === 'all' || d.status === filter
    const title = d.tasks?.title?.toLowerCase() ?? ''
    const client = `${d.tasks?.profiles?.first_name ?? ''} ${d.tasks?.profiles?.last_name ?? ''}`.toLowerCase()
    const matchSearch = title.includes(search.toLowerCase()) || client.includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  async function resolveDispute(id) {
    setActionLoading(id)
    const note = resolutionNote[id] || ''
    const { error } = await supabase
      .from('task_disputes')
      .update({ status: 'resolved', resolution_note: note })
      .eq('id', id)
    if (!error) {
      showToast('Disputa a fost rezolvată.')
      load()
    }
    setActionLoading(null)
  }

  async function closeDispute(id) {
    setActionLoading(id + 'close')
    const { error } = await supabase
      .from('task_disputes')
      .update({ status: 'closed' })
      .eq('id', id)
    if (!error) {
      showToast('Disputa a fost închisă.')
      load()
    }
    setActionLoading(null)
  }

  const statusBadge = (s) => {
    const map = {
      open:     'bg-red-100 text-red-700',
      assigned: 'bg-blue-100 text-blue-700',
      resolved: 'bg-green-100 text-green-700',
      closed:   'bg-gray-100 text-gray-600',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[s] ?? 'bg-gray-100 text-gray-600'}`}>
        {DISPUTE_STATUS_LABEL[s] ?? s}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white bg-green-600 transition">
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Dispute & Conflicte</h2>
          <p className="text-sm text-gray-500">Gestionează conflictele dintre clienți și meșteri</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition">
          <RefreshCw className="w-4 h-4" /> Actualizează
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută după titlu task sau client..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {['open', 'assigned', 'resolved', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2.5 font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {f === 'all' ? 'Toate' : DISPUTE_STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nicio dispută găsită</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(d => {
              const title = d.tasks?.title ?? 'Task necunoscut'
              const clientName = `${d.tasks?.profiles?.first_name ?? ''} ${d.tasks?.profiles?.last_name ?? ''}`.trim() || 'Client necunoscut'
              const isOpen = expanded === d.id

              return (
                <div key={d.id} className="p-4">
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : d.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{title}</p>
                      <p className="text-xs text-gray-500">Client: {clientName}</p>
                    </div>
                    {d.rejection_reasons?.name && (
                      <span className="hidden sm:inline text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {d.rejection_reasons.name}
                      </span>
                    )}
                    {statusBadge(d.status)}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>

                  {isOpen && (
                    <div className="mt-4 pl-14 space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs mb-0.5">Email client</p>
                          <p className="font-medium text-gray-700 truncate">{d.tasks?.profiles?.email ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-0.5">Motiv</p>
                          <p className="font-medium text-gray-700">{d.rejection_reasons?.name ?? '—'}</p>
                        </div>
                      </div>

                      {d.tasks?.description && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">Descriere task</p>
                          <p className="text-sm text-gray-700">{d.tasks.description}</p>
                        </div>
                      )}

                      {d.resolution_note && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs text-green-600 font-medium mb-1">Notă de rezolvare</p>
                          <p className="text-sm text-green-800">{d.resolution_note}</p>
                        </div>
                      )}

                      {(d.status === 'open' || d.status === 'assigned') && (
                        <div className="space-y-3">
                          <textarea
                            value={resolutionNote[d.id] ?? ''}
                            onChange={e => setResolutionNote(prev => ({ ...prev, [d.id]: e.target.value }))}
                            placeholder="Adaugă o notă de rezolvare (opțional)..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => resolveDispute(d.id)}
                              disabled={!!actionLoading}
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                            >
                              {actionLoading === d.id
                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <CheckCircle className="w-4 h-4" />}
                              Marchează rezolvat
                            </button>
                            <button
                              onClick={() => closeDispute(d.id)}
                              disabled={!!actionLoading}
                              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                            >
                              Închide
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section: Users ───────────────────────────────────────────────────────────

function UsersSection() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, first_name, last_name, email, is_active, created_at, onboarding_completed,
        user_roles(roles(name))
      `)
      .order('created_at', { ascending: false })

    if (!error) setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => {
    const fullName = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase()
    const matchSearch = fullName.includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const roles = u.user_roles?.map(r => r.roles?.name).filter(Boolean) || []
    const matchRole = roleFilter === 'all' || roles.includes(roleFilter)
    return matchSearch && matchRole
  })

  const roleTag = (u) => {
    const roles = u.user_roles?.map(r => r.roles?.name).filter(Boolean) || []
    const map = {
      client:   'bg-blue-100 text-blue-700',
      handyman: 'bg-purple-100 text-purple-700',
      admin:    'bg-gray-800 text-white',
    }
    const label = { client: 'Client', handyman: 'Meșter', admin: 'Admin' }
    return roles.map(r => (
      <span key={r} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[r] ?? 'bg-gray-100 text-gray-600'}`}>
        {label[r] ?? r}
      </span>
    ))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Utilizatori</h2>
          <p className="text-sm text-gray-500">Toți utilizatorii înregistrați pe platformă</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition">
          <RefreshCw className="w-4 h-4" /> Actualizează
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută după nume sau email..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {['all', 'client', 'handyman'].map(f => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`px-4 py-2.5 font-medium transition ${roleFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {f === 'all' ? 'Toți' : f === 'client' ? 'Clienți' : 'Meșteri'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Niciun utilizator găsit</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(u => {
              const fullName = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Necunoscut'
              return (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                  <Avatar name={fullName} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{fullName}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {roleTag(u)}
                  </div>
                  <div className="hidden sm:flex flex-col items-end text-xs text-gray-400">
                    <span>{fmtDate(u.created_at)}</span>
                    {u.onboarding_completed ? (
                      <span className="text-green-600 font-medium">Profil complet</span>
                    ) : (
                      <span className="text-yellow-600 font-medium">Onboarding</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main AdminDashboard ───────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [stats, setStats] = useState({
    clients: 0, handymen: 0, pending: 0, openDisputes: 0, recentPending: []
  })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single()
        if (data) setAdminName(`${data.first_name ?? ''} ${data.last_name ?? ''}`.trim())
      }

      // Get role IDs
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name')
      const clientRoleId = rolesData?.find(r => r.name === 'client')?.id
      const handymanRoleId = rolesData?.find(r => r.name === 'handyman')?.id

      const [clientsRes, handymenRes, pendingRes, disputesRes, recentRes] = await Promise.all([
        clientRoleId
          ? supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role_id', clientRoleId)
          : Promise.resolve({ count: 0 }),
        handymanRoleId
          ? supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role_id', handymanRoleId)
          : Promise.resolve({ count: 0 }),
        supabase.from('handyman_profiles').select('*', { count: 'exact', head: true }).eq('is_verified', false).neq('status', 'rejected'),
        supabase.from('task_disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('handyman_profiles')
          .select('user_id, profiles!inner(first_name, last_name)')
          .eq('is_verified', false)
          .neq('status', 'rejected')
          .limit(5),
      ])

      setStats({
        clients:      clientsRes.count ?? 0,
        handymen:     handymenRes.count ?? 0,
        pending:      pendingRes.count ?? 0,
        openDisputes: disputesRes.count ?? 0,
        recentPending: recentRes.data ?? [],
      })
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/hc-portal')
  }

  const ActiveSection = () => {
    if (activeSection === 'overview')       return <OverviewSection stats={stats} />
    if (activeSection === 'certifications') return <CertificationsSection />
    if (activeSection === 'disputes')       return <DisputesSection />
    if (activeSection === 'users')          return <UsersSection />
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-gray-950 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">HandyConnect</p>
              <p className="text-gray-500 text-xs">Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveSection(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${activeSection === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Admin info + logout */}
        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {adminName ? adminName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{adminName || 'Administrator'}</p>
              <p className="text-gray-500 text-xs">Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition"
          >
            <LogOut className="w-4 h-4" /> Deconectare
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-16 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-800">
              {NAV.find(n => n.id === activeSection)?.label}
            </h1>
          </div>
          {stats.pending > 0 && activeSection !== 'certifications' && (
            <button
              onClick={() => setActiveSection('certifications')}
              className="hidden sm:flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {stats.pending} meșteri în așteptare
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl w-full mx-auto">
          <ActiveSection />
        </main>
      </div>
    </div>
  )
}
