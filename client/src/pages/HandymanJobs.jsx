import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import HandymanNavbar from '../components/handyman-dashboard/HandymanNavbar'
import JobRequestModal from '../components/handyman-dashboard/JobRequestModal'
import CompletedJobModal from '../components/handyman-dashboard/CompletedJobModal'
import {
  Search, Calendar, MapPin, Camera, CheckCircle,
  XCircle, MessageSquare, Play, RefreshCw, Loader2,
  AlertTriangle, Zap, Clock, Briefcase, Tag,
  TrendingDown, DollarSign, CalendarClock, ChevronRight,
  Star, User
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr, timeStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const label = d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
    return timeStr ? `${label} · ${timeStr}` : label
  } catch { return dateStr }
}
function fmtDateLong(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtPrice(val) {
  if (!val && val !== 0) return '—'
  return `${Number(val).toLocaleString('ro-RO')} RON`
}

function normaliseBooking(b) {
  const statusMap = { pending: 'new', accepted: 'accepted', in_progress: 'in_progress', completed: 'completed', cancelled: 'cancelled' }
  return {
    _type: 'booking', _id: b.id, _raw: b,
    title: b.handyman_services?.title ?? `Rezervare #${b.id.slice(0, 6)}`,
    client: b.contact_name || 'Client',
    clientId: b.client_id,
    description: b.handyman_notes ?? '',
    date: fmtDate(b.scheduled_date, b.scheduled_time),
    photos: [],
    address: b.service_address ?? '',
    price: fmtPrice(b.total ?? b.subtotal),
    urgency: b.urgency ?? 'normal',
    uiStatus: statusMap[b.status] ?? 'new',
    created_at: b.created_at,
    category: null,
  }
}
function normaliseTask(t) {
  const clientName = t.profiles
    ? `${t.profiles.first_name ?? ''} ${t.profiles.last_name ?? ''}`.trim() || t.contact_name || 'Client'
    : t.contact_name || 'Client'
  const statusMap = { open: 'new', assigned: 'accepted', in_progress: 'in_progress', completed: 'completed' }
  return {
    _type: 'task', _id: t.id, _raw: t,
    title: t.title ?? '—',
    client: clientName, clientId: t.client_id,
    description: t.description ?? '',
    date: fmtDate(t.scheduled_date, t.scheduled_time),
    photos: Array.isArray(t.photos) ? t.photos : [],
    address: [t.service_address, t.address_city].filter(Boolean).join(', '),
    price: fmtPrice(t.budget),
    urgency: t.urgency ?? 'normal',
    uiStatus: statusMap[t.status] ?? 'new',
    created_at: t.created_at,
    category: t.categories ?? null,
  }
}

// ─── badges ───────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  if (type === 'task')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200"><Briefcase className="w-2.5 h-2.5" />Task</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200"><Tag className="w-2.5 h-2.5" />Rezervare</span>
}
function UrgencyBadge({ urgency }) {
  const map = {
    high:   { label: 'Urgent', cls: 'bg-red-100 text-red-700', Icon: AlertTriangle },
    medium: { label: 'Mediu',  cls: 'bg-yellow-100 text-yellow-700', Icon: Zap },
    normal: { label: 'Normal', cls: 'bg-green-100 text-green-700', Icon: Clock },
    low:    { label: 'Normal', cls: 'bg-green-100 text-green-700', Icon: Clock },
  }
  const { label, cls, Icon } = map[urgency] ?? map.normal
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}><Icon className="w-2.5 h-2.5" />{label}</span>
}
function StatusBadge({ status }) {
  const map = {
    new:         { label: 'Nou',        cls: 'bg-blue-100 text-blue-700' },
    accepted:    { label: 'Acceptat',   cls: 'bg-yellow-100 text-yellow-700' },
    in_progress: { label: 'În Progres', cls: 'bg-purple-100 text-purple-700' },
    completed:   { label: 'Finalizat',  cls: 'bg-green-100 text-green-700' },
  }
  const { label, cls } = map[status] ?? map.new
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { id: 'all',          label: 'Toate' },
  { id: 'new',          label: 'Noi' },
  { id: 'accepted',     label: 'Acceptate' },
  { id: 'in_progress',  label: 'În Progres' },
  { id: 'completed',    label: 'Finalizate' },
  { id: 'negotiations', label: 'Negocieri' },
  { id: 'reschedule',   label: 'Reprogramate' },
]
const URGENCY_OPTIONS = ['Toate', 'Urgent', 'Mediu', 'Normal']
const URGENCY_MAP     = { Urgent: 'high', Mediu: 'medium', Normal: 'normal' }
const DAY_MS          = 86_400_000

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function HandymanJobs() {
  const [userId,        setUserId]        = useState(null)
  const [jobs,          setJobs]          = useState([])
  const [negotiations,  setNegotiations]  = useState([])   // task_offers by this handyman
  const [reschedules,   setReschedules]   = useState([])   // reschedule_requests by this handyman
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [activeTab,     setActiveTab]     = useState('all')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('Toate')
  const [selectedJob,   setSelectedJob]   = useState(null)
  const [completedJob,  setCompletedJob]  = useState(null)
  const [startingId,    setStartingId]    = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [])

  const fetchJobs = useCallback(async (quiet = false) => {
    if (!userId) return
    quiet ? setRefreshing(true) : setLoading(true)
    try {
      const [bRes, aRes, pRes, negRes, reschedRes] = await Promise.all([
        // Bookings assigned to this handyman
        supabase.from('bookings')
          .select('*, handyman_services(title)')
          .eq('handyman_id', userId)
          .neq('status', 'cancelled'),

        // Tasks assigned to this handyman
        supabase.from('tasks')
          .select('*, profiles!tasks_client_id_fkey(first_name,last_name,avatar_url), categories(id,name,icon)')
          .eq('handyman_id', userId),

        // Tasks proposed to this handyman (open)
        supabase.from('tasks')
          .select('*, profiles!tasks_client_id_fkey(first_name,last_name,avatar_url), categories(id,name,icon)')
          .contains('proposed_to', [userId])
          .in('status', ['open']),

        // task_offers: ALL offers sent by this handyman (all statuses for full history)
        supabase.from('task_offers')
          .select(`
            *,
            task:task_id (
              id, title, budget, status, contact_name, scheduled_date, scheduled_time,
              profiles!tasks_client_id_fkey(first_name, last_name, avatar_url)
            )
          `)
          .eq('handyman_id', userId)
          .eq('sent_by', 'handyman')
          .order('created_at', { ascending: false }),

        // Reschedule requests sent by this handyman (all statuses to show history)
        supabase.from('reschedule_requests')
          .select('*')
          .eq('handyman_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      if (bRes.error) console.error('[HandymanJobs] bookings:', bRes.error)
      if (aRes.error) console.error('[HandymanJobs] assigned tasks:', aRes.error)
      if (pRes.error) console.error('[HandymanJobs] proposed tasks:', pRes.error)
      if (negRes.error) console.error('[HandymanJobs] task_offers:', negRes.error)
      if (reschedRes.error) console.error('[HandymanJobs] reschedule_requests:', reschedRes.error)

      const bookings = (bRes.data ?? []).map(normaliseBooking)
      const taskMap = new Map()
      ;[...(aRes.data ?? []), ...(pRes.data ?? [])].forEach(t => {
        if (!taskMap.has(t.id)) taskMap.set(t.id, t)
      })
      const tasks = [...taskMap.values()].map(normaliseTask)
      const all = [...bookings, ...tasks].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )
      setJobs(all)
      // Deduplicate: one entry per task_id — keep the LATEST handyman offer per task
      const negMap = new Map()
      ;(negRes.data ?? []).forEach(row => {
        // Since ordered desc, first seen = most recent per task
        if (!negMap.has(row.task_id)) negMap.set(row.task_id, row)
      })
      setNegotiations([...negMap.values()])
      setReschedules(reschedRes.data ?? [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userId])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleStartJob = async (job, e) => {
    e.stopPropagation()
    setStartingId(job._id)
    const table = job._type === 'booking' ? 'bookings' : 'tasks'
    await supabase.from(table).update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', job._id)
    await fetchJobs(true)
    setStartingId(null)
  }

  const yesterday = Date.now() - DAY_MS

  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'new') {
      if (job.uiStatus !== 'new') return false
      if (new Date(job.created_at).getTime() < yesterday) return false
    } else if (activeTab === 'negotiations' || activeTab === 'reschedule') {
      return false
    } else if (activeTab !== 'all') {
      if (job.uiStatus !== activeTab) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!job.title.toLowerCase().includes(q) && !job.client.toLowerCase().includes(q) && !job.description.toLowerCase().includes(q)) return false
    }
    if (urgencyFilter !== 'Toate' && job.urgency !== URGENCY_MAP[urgencyFilter]) return false
    return true
  })


  const tabCount = id => {
    if (id === 'negotiations') return negotiations.length
    if (id === 'reschedule')   return reschedules.length
    if (id === 'all') return jobs.length
    if (id === 'new') return jobs.filter(j => j.uiStatus === 'new' && new Date(j.created_at).getTime() >= yesterday).length
    return jobs.filter(j => j.uiStatus === id).length
  }

  const handleCardClick = (job) => {
    if (job.uiStatus === 'completed') setCompletedJob(job)
    else setSelectedJob({ job, mode: job.uiStatus === 'in_progress' ? 'complete' : 'details' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HandymanNavbar />
      <div className="max-w-7xl mx-auto px-4 py-8">


                {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Job Pipeline</h1>
            <p className="text-gray-500 mt-1">Gestionează toate cererile și rezervările tale</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fetchJobs(true)} disabled={refreshing}
              className="p-2.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition" title="Reîncarcă">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {URGENCY_OPTIONS.map(u => <option key={u} value={u}>{u === 'Toate' ? 'Toate urgențele' : u}</option>)}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Caută după titlu, client sau descriere..."
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 bg-white rounded-xl border border-gray-100 p-1.5">
          {STATUS_TABS.map(tab => {
            const count = tabCount(tab.id)
            const hasAlert = false
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 flex-1 py-2.5 rounded-lg text-sm font-medium justify-center transition-all
                  ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                {tab.id === 'negotiations' && <TrendingDown className="w-3 h-3 flex-shrink-0" />}
                {tab.id === 'reschedule'   && <CalendarClock className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate">{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0
                  ${activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : hasAlert
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                  {count}
                </span>

              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-gray-400 text-sm">Se încarcă job-urile...</p>
          </div>

        ) : activeTab === 'negotiations' ? (
          /* ══ NEGOTIATIONS ══ */
          <NegotiationsView
            negotiations={negotiations}
            onRefresh={() => fetchJobs(true)}
          />

        ) : activeTab === 'reschedule' ? (
          /* ══ RESCHEDULE ══ */
          <RescheduleView
            reschedules={reschedules}
            jobs={jobs}
            onRefresh={() => fetchJobs(true)}
          />

        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Niciun job găsit</h3>
            <p className="text-gray-500">
              {activeTab === 'new' ? 'Nu există cereri noi în ultimele 24 de ore.' : 'Încearcă să modifici filtrele.'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredJobs.map(job => (
              <JobCard key={`${job._type}-${job._id}`} job={job} startingId={startingId}
                onOpen={handleCardClick}
                onOpenModal={(j, mode) => setSelectedJob({ job: j, mode })}
                onStartJob={handleStartJob} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedJob && (
        <JobRequestModal
          job={selectedJob.job}
          initialMode={selectedJob.mode}
          userId={userId}
          onClose={() => setSelectedJob(null)}
          onUpdate={() => { setSelectedJob(null); fetchJobs(true) }}
        />
      )}
      {completedJob && (
        <CompletedJobModal
          job={completedJob}
          onClose={() => setCompletedJob(null)}
        />
      )}
    </div>
  )
}

// ─── JOB CARD ─────────────────────────────────────────────────────────────────

function JobCard({ job, startingId, onOpen, onOpenModal, onStartJob }) {
  const isStarting = startingId === job._id
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
      onClick={() => onOpen(job)}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="font-bold text-gray-800 leading-snug">{job.title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{job.client}</p>
          </div>
          <TypeBadge type={job._type} />
        </div>
        {job.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{job.description}</p>}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-3">
          <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span>{job.date}</span></div>
          {job.photos.length > 0 && <div className="flex items-center gap-1"><Camera className="w-3 h-3" /><span>{job.photos.length} {job.photos.length === 1 ? 'Poză' : 'Poze'}</span></div>}
          {job.address && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span className="truncate max-w-[180px]">{job.address}</span></div>}
        </div>
        <div className="flex items-center gap-2 mb-4">
          <UrgencyBadge urgency={job.urgency} />
          <StatusBadge status={job.uiStatus} />
          {job.category && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{job.category.name}</span>}
        </div>
        <div className="flex items-center gap-6 mb-4 pb-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400">{job.uiStatus === 'completed' ? 'Preț final' : 'Estimare'}</p>
            <p className="font-bold text-blue-600">{job.price}</p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {job.uiStatus === 'new' && <>
            <button onClick={() => onOpenModal(job, 'details')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
              <CheckCircle className="w-3.5 h-3.5" /> Acceptă
            </button>
            <button onClick={() => onOpenModal(job, 'decline')}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition">
              <XCircle className="w-3.5 h-3.5" /> Refuză
            </button>
            <button onClick={() => onOpenModal(job, 'reschedule')}
              className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 text-gray-400 text-xs font-medium rounded-lg hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition" title="Reprogramează">
              <CalendarClock className="w-3.5 h-3.5" />
            </button>
          </>}
          {job.uiStatus === 'accepted' && <>
            <button onClick={e => onStartJob(job, e)} disabled={isStarting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-60">
              {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Începe Job
            </button>
            <button onClick={() => onOpenModal(job, 'reschedule')}
              className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 text-gray-400 text-xs font-medium rounded-lg hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition" title="Reprogramează">
              <CalendarClock className="w-3.5 h-3.5" />
            </button>
          </>}
          {job.uiStatus === 'in_progress' && <>
            <button onClick={() => onOpenModal(job, 'complete')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition">
              <CheckCircle className="w-3.5 h-3.5" /> Marchează Finalizat
            </button>
            <button className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-200 text-gray-400 text-xs font-medium rounded-lg hover:bg-gray-50 transition">
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </>}
          {job.uiStatus === 'completed' && (
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-200 transition">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Vezi Detalii Finalizare
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── NEGOTIATIONS VIEW ────────────────────────────────────────────────────────

function NegotiationsView({ negotiations, onRefresh }) {
  if (negotiations.length === 0) return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
      <TrendingDown className="w-12 h-12 text-gray-200 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-gray-800 mb-2">Nicio negociere activă</h3>
      <p className="text-gray-500 text-sm">Ofertele de preț trimise la taskuri vor apărea aici.</p>
      <p className="text-gray-400 text-xs mt-2">Deschide un task și apasă "Trimite Ofertă" pentru a negocia.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <TrendingDown className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-bold text-gray-800">Ofertele Tale de Preț</h2>
        <span className="px-2.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">{negotiations.length} oferte</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {negotiations.map(neg => (
          <NegotiationCard key={neg.id} neg={neg} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  )
}

// ─── NEGOTIATION CARD ─────────────────────────────────────────────────────────
// task_offers: id, task_id, handyman_id, proposed_price,
// estimated_duration, message, available_date, available_time, status, created_at
// Limită: max 3 runde de negociere per ofertă

const MAX_ROUNDS = 3

function NegotiationCard({ neg, onRefresh }) {
  const [withdrawing,  setWithdrawing]  = useState(false)
  const [accepting,    setAccepting]    = useState(false)
  const [showCounter,  setShowCounter]  = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterMsg,   setCounterMsg]   = useState('')
  const [sending,      setSending]      = useState(false)

  // task_offers.task joined → title, budget, profiles
  const task         = neg.task
  const taskTitle    = task?.title ?? `Task #${neg.task_id?.slice(0,6).toUpperCase()}`
  const clientName   = task?.profiles
    ? `${task.profiles.first_name ?? ''} ${task.profiles.last_name ?? ''}`.trim() || 'Client'
    : 'Client'
  const originalBudget = task?.budget
  const isCountered    = neg.status === 'negotiating'

  // All offers for this task ordered chronologically
  // Row index 0,2,4 = handyman offers  |  Row index 1,3,5 = client counters
  const [allOffers,      setAllOffers]      = useState([])
  const [handymanRounds, setHandymanRounds] = useState(0)
  const [clientRounds,   setClientRounds]   = useState(0)
  const [counterOffer,   setCounterOffer]   = useState(null)

  useEffect(() => {
    supabase.from('task_offers')
      .select('id, proposed_price, message, status, created_at, handyman_id, sent_by, estimated_duration, available_date, available_time')
      .eq('task_id', neg.task_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const rows = data ?? []
        setAllOffers(rows)
        // Use sent_by to count rounds accurately
        const hRounds = rows.filter(r => (r.sent_by ?? 'handyman') === 'handyman').length
        const cRounds = rows.filter(r => r.sent_by === 'client').length
        setHandymanRounds(hRounds)
        setClientRounds(cRounds)
        // Client's latest counter = most recent row with sent_by='client' and status='pending'
        if (isCountered) {
          const clientCounter = [...rows]
            .reverse()
            .find(r => r.sent_by === 'client' && r.status === 'pending')
          setCounterOffer(clientCounter ?? null)
        }
      })
  }, [neg.task_id, neg.id, isCountered])

  // Status flags — declared here so canCounter/roundsExhausted can use them
  const isRejected = neg.status === 'rejected'
  const isAccepted = neg.status === 'accepted'

  const canCounter      = !isRejected && !isAccepted && isCountered && counterOffer != null && handymanRounds < MAX_ROUNDS
  const roundsExhausted = !isRejected && !isAccepted && handymanRounds >= MAX_ROUNDS

  const handleWithdraw = async () => {
    setWithdrawing(true)
    await supabase.from('task_offers').update({ status: 'rejected' }).eq('id', neg.id)
    onRefresh()
  }

  const handleAcceptCounter = async () => {
    if (!counterOffer) return
    setAccepting(true)
    // Accept client's counter price
    await supabase.from('task_offers').update({ status: 'accepted' }).eq('id', counterOffer.id)
    // Close all other offers on this task
    await supabase.from('task_offers').update({ status: 'rejected' })
      .eq('task_id', neg.task_id).neq('id', counterOffer.id)
    // Assign task at the agreed price
    await supabase.from('tasks').update({
      handyman_id: neg.handyman_id,
      status:      'assigned',
      final_price: counterOffer.proposed_price,
      updated_at:  new Date().toISOString(),
    }).eq('id', neg.task_id)
    onRefresh()
  }

  const handleSendCounter = async () => {
    if (!counterPrice || !counterOffer) return
    setSending(true)
    // Mark client's counter as 'negotiating' (client's turn is done)
    await supabase.from('task_offers').update({ status: 'negotiating' }).eq('id', counterOffer.id)
    // Insert handyman's new counter-offer with sent_by: 'handyman'
    await supabase.from('task_offers').insert({
      task_id:            neg.task_id,
      handyman_id:        neg.handyman_id,
      proposed_price:     Number(counterPrice),
      message:            counterMsg || null,
      status:             'pending',
      sent_by:            'handyman',
      estimated_duration: neg.estimated_duration || null,
      available_date:     neg.available_date || null,
      available_time:     neg.available_time || null,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })
    setSending(false)
    setShowCounter(false)
    setCounterPrice('')
    setCounterMsg('')
    onRefresh()
  }

  const stripeColor = isRejected ? 'bg-red-300' : isAccepted ? 'bg-green-400' : isCountered ? 'bg-orange-400' : 'bg-blue-400'
  const statusLabel = isRejected ? 'Refuzat' : isAccepted ? 'Acceptat' : isCountered ? 'Contra-ofertă' : 'În așteptare'
  const statusCls   = isRejected ? 'bg-red-100 text-red-700' : isAccepted ? 'bg-green-100 text-green-700' : isCountered ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isRejected ? 'border-red-200 opacity-70' : isAccepted ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Top color stripe */}
      <div className={`h-1 w-full ${stripeColor}`} />

      <div className="p-4">
        {/* Header: title + client + status badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <p className="font-bold text-gray-800 text-sm line-clamp-1">{taskTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5">{clientName}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${statusCls}`}>
            {statusLabel}
          </span>
        </div>

        {/* Rejected notice */}
        {isRejected && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0"/>
            <div>
              <p className="text-xs font-bold text-red-600">Oferta a fost refuzată</p>
              <p className="text-xs text-red-400">Clientul a decis să nu accepte oferta ta de {fmtPrice(neg.proposed_price)}</p>
            </div>
          </div>
        )}

        {/* Accepted notice */}
        {isAccepted && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0"/>
            <div>
              <p className="text-xs font-bold text-green-600">Oferta a fost acceptată!</p>
              <p className="text-xs text-green-500">Taskul apare acum în tab-ul Acceptate</p>
            </div>
          </div>
        )}

        {/* Prices row — clean horizontal layout */}
        <div className="flex items-center gap-2 mb-3">
          {originalBudget && <>
            <div className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-gray-400 mb-0.5">Buget</p>
              <p className="text-sm font-bold text-gray-600">{fmtPrice(originalBudget)}</p>
            </div>
            <span className="text-gray-300 text-lg">→</span>
          </>}
          <div className={`flex-1 rounded-lg p-2.5 text-center ${isCountered ? 'bg-gray-50' : 'bg-blue-50'}`}>
            <p className="text-[10px] text-blue-500 mb-0.5">Oferta ta</p>
            <p className="text-sm font-bold text-blue-700">{fmtPrice(neg.proposed_price)}</p>
          </div>
          {isCountered && counterOffer && <>
            <span className="text-gray-300 text-lg">⇄</span>
            <div className="flex-1 bg-orange-50 rounded-lg p-2.5 text-center border border-orange-200">
              <p className="text-[10px] text-orange-500 mb-0.5">Client propune</p>
              <p className="text-sm font-bold text-orange-700">{fmtPrice(counterOffer.proposed_price)}</p>
            </div>
          </>}
          {isCountered && !counterOffer && <>
            <span className="text-gray-300 text-lg">→</span>
            <div className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center border border-dashed border-gray-200">
              <p className="text-[10px] text-gray-400 mb-0.5">Client</p>
              <Loader2 className="w-3 h-3 text-gray-300 animate-spin mx-auto" />
            </div>
          </>}
        </div>

        {/* Rounds indicator: separate for handyman and client */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Tu:</span>
            {[1,2,3].map(i => (
              <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border
                ${i <= handymanRounds
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-300 border-gray-200'}`}>
                {i}
              </span>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Client:</span>
            {[1,2,3].map(i => (
              <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border
                ${i <= clientRounds
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-300 border-gray-200'}`}>
                {i}
              </span>
            ))}
          </div>
          {roundsExhausted && (
            <span className="text-xs text-red-500 font-medium">· Limita ta atinsă</span>
          )}
        </div>

        {/* Messages */}
        {neg.message && (
          <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2 mb-2">
            Tu: "{neg.message}"
          </p>
        )}
        {isCountered && counterOffer?.message && (
          <p className="text-xs text-orange-700 italic bg-orange-50 rounded-lg px-3 py-2 mb-2">
            Client: "{counterOffer.message}"
          </p>
        )}

        {/* Meta: date, duration, availability */}
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3 flex-wrap">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{fmtDate(neg.created_at)}</span>
          {neg.estimated_duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{neg.estimated_duration}</span>}
          {neg.available_date && (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3"/>
              {new Date(neg.available_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}
              {neg.available_time ? ` · ${neg.available_time}` : ''}
            </span>
          )}
        </div>

        {/* Counter form */}
        {showCounter && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 space-y-2">
            <p className="text-xs font-bold text-gray-600">Contra-ofertă ({3 - handymanRounds} {3 - handymanRounds === 1 ? 'rundă rămasă' : 'runde rămase'})</p>
            <input type="number" value={counterPrice} onChange={e => setCounterPrice(e.target.value)}
              placeholder="Prețul tău (RON)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <textarea value={counterMsg} onChange={e => setCounterMsg(e.target.value)} rows={2}
              placeholder="Mesaj opțional..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <div className="flex gap-2">
              <button onClick={() => setShowCounter(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition">
                Anulează
              </button>
              <button onClick={handleSendCounter} disabled={!counterPrice || sending}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin inline"/> : 'Trimite'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {isCountered && counterOffer && (
            <button onClick={handleAcceptCounter} disabled={accepting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-60">
              {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle className="w-3.5 h-3.5"/>}
              Acceptă {fmtPrice(counterOffer.proposed_price)}
            </button>
          )}
          {canCounter && !showCounter && (
            <button onClick={() => setShowCounter(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-blue-200 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition">
              <DollarSign className="w-3.5 h-3.5"/> Contra-ofertă
            </button>
          )}
          {roundsExhausted && isCountered && !accepting && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 text-gray-400 text-xs rounded-lg">
              Limita de negocieri atinsă
            </div>
          )}
          <button onClick={handleWithdraw} disabled={withdrawing}
            className="px-3 py-2 border border-gray-200 text-gray-400 text-xs rounded-lg hover:bg-gray-50 hover:text-red-500 hover:border-red-200 transition disabled:opacity-60"
            title="Retrage oferta">
            {withdrawing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <XCircle className="w-3.5 h-3.5"/>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── RESCHEDULE VIEW ──────────────────────────────────────────────────────────

function RescheduleView({ reschedules, jobs, onRefresh }) {
  if (reschedules.length === 0) return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
      <CalendarClock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-gray-800 mb-2">Nicio cerere de reprogramare</h3>
      <p className="text-gray-500 text-sm">Cererile de reprogramare trimise clienților vor apărea aici.</p>
    </div>
  )

  const incoming = reschedules.filter(r => r.status === 'pending_handyman' || r.status === 'pending')
  const outgoing = reschedules.filter(r => r.status === 'pending_client')
  const responded = reschedules.filter(r => r.status === 'accepted' || r.status === 'rejected')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-bold text-gray-800">Reprogramări Trimise</h2>
      </div>

      {/* Incoming — waiting handyman */}
      {incoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-gray-700">Cereri primite de la client ({incoming.length})</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {incoming.map(r => (
              <RescheduleCard key={r.id} r={r} jobs={jobs} onRefresh={onRefresh} mode="incoming" />
            ))}
          </div>
        </div>
      )}

      {/* Outgoing — waiting client */}
      {outgoing.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-bold text-gray-700">În așteptarea confirmării clientului ({outgoing.length})</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {outgoing.map(r => (
              <RescheduleCard key={r.id} r={r} jobs={jobs} onRefresh={onRefresh} mode="outgoing" />
            ))}
          </div>
        </div>
      )}

      {/* Responded */}
      {responded.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-bold text-gray-700">Răspunsuri primite ({responded.length})</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {responded.map(r => (
              <RescheduleCard key={r.id} r={r} jobs={jobs} onRefresh={onRefresh} mode="responded" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RESCHEDULE CARD ──────────────────────────────────────────────────────────

function RescheduleCard({ r, jobs, onRefresh, mode = 'outgoing' }) {
  const [cancelling, setCancelling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCounter, setShowCounter] = useState(false)
  const [counterDate, setCounterDate] = useState('')
  const [counterTime, setCounterTime] = useState('')
  const [counterMsg, setCounterMsg] = useState('')

  // Find job title from jobs list (bookings + tasks)
  const job = jobs.find(j => j._id === r.job_id)
  const jobTitle = job?.title ?? `${r.job_type === 'task' ? 'Task' : 'Rezervare'} #${r.job_id?.slice(0,6).toUpperCase()}`

  const handleCancel = async () => {
    setCancelling(true)
    await supabase.from('reschedule_requests').update({ status: 'rejected' }).eq('id', r.id)
    onRefresh()
  }

  const handleAcceptIncoming = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await supabase.from('reschedule_requests')
        .update({ status: 'accepted', responded_at: now })
        .eq('id', r.id)

      const table = r.job_type === 'booking' ? 'bookings' : 'tasks'
      await supabase.from(table).update({
        scheduled_date: r.proposed_date,
        scheduled_time: r.proposed_time,
        updated_at: now,
      }).eq('id', r.job_id)

      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const handleCounterIncoming = async () => {
    if (!counterDate || !counterTime) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await supabase.from('reschedule_requests')
        .update({ status: 'rejected', responded_at: now })
        .eq('id', r.id)

      await supabase.from('reschedule_requests').insert({
        job_id: r.job_id,
        job_type: r.job_type,
        handyman_id: r.handyman_id,
        client_id: r.client_id,
        proposed_date: counterDate,
        proposed_time: counterTime,
        message: counterMsg || null,
        status: 'pending_client',
        created_at: now,
      })

      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const handleCancelTaskAfterFailedReschedule = async () => {
    const reason = window.prompt('Motiv anulare (ex: reprogramare eșuată):', 'reprogramare eșuată')
    if (reason == null) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await supabase.from('reschedule_requests')
        .update({ status: 'rejected', responded_at: now })
        .eq('id', r.id)

      if (r.job_type === 'task') {
        const { data: row } = await supabase.from('tasks').select('special_instructions').eq('id', r.job_id).maybeSingle()
        const special = [row?.special_instructions, `[ANULARE HANDYMAN] ${reason}`].filter(Boolean).join('\n')
        await supabase.from('tasks').update({
          status: 'cancelled',
          special_instructions: special,
          updated_at: now,
        }).eq('id', r.job_id)
      } else {
        await supabase.from('bookings').update({
          status: 'cancelled',
          handyman_notes: `[ANULARE HANDYMAN] ${reason}`,
          updated_at: now,
        }).eq('id', r.job_id)
      }

      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const statusConfig = {
    pending:  { label: 'Așteptare', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', border: 'border-yellow-200', bg: 'bg-yellow-50' },
    accepted: { label: 'Acceptat',  cls: 'bg-green-100 text-green-700 border-green-200',   border: 'border-green-200',  bg: 'bg-green-50' },
    rejected: { label: 'Refuzat',   cls: 'bg-red-100 text-red-700 border-red-200',          border: 'border-red-200',    bg: 'bg-red-50' },
  }
  const cfg = statusConfig[r.status] ?? statusConfig.pending

  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-5`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarClock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
              {r.job_type === 'task' ? 'Task' : 'Rezervare'}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-800 line-clamp-1">{jobTitle}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      {/* Proposed date/time */}
      <div className="bg-white rounded-xl p-3 mb-3 border border-white/80">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">
          {mode === 'incoming' ? 'Data propusă de client' : 'Data propusă de tine'}
        </p>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-gray-800">{fmtDateLong(r.proposed_date)}</p>
            <p className="text-xs text-blue-600 font-medium">Ora {r.proposed_time}</p>
          </div>
        </div>
        {r.message && (
          <p className="text-xs text-gray-500 italic mt-2 pt-2 border-t border-gray-100">"{r.message}"</p>
        )}
      </div>

      {/* Status messages */}
      {(r.status === 'pending' || r.status === 'pending_handyman') && mode === 'incoming' && (
        <div className="flex items-center gap-2 text-xs text-blue-700 mb-3 bg-blue-100 rounded-lg px-3 py-2">
          <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Clientul a cerut reprogramare. Poți accepta, propune altă oră sau anula taskul.</span>
        </div>
      )}
      {(r.status === 'pending' || r.status === 'pending_client') && mode !== 'incoming' && (
        <div className="flex items-center gap-2 text-xs text-yellow-700 mb-3 bg-yellow-100 rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Clientul nu a răspuns încă — trimiți: {fmtDate(r.created_at)}</span>
        </div>
      )}
      {r.status === 'accepted' && (
        <div className="flex items-center gap-2 text-xs text-green-700 mb-3 bg-green-100 rounded-lg px-3 py-2">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Clientul a acceptat! Job-ul a fost reprogramat.</span>
        </div>
      )}
      {r.status === 'rejected' && (
        <div className="flex items-center gap-2 text-xs text-red-700 mb-3 bg-red-100 rounded-lg px-3 py-2">
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Clientul a refuzat reprogramarea sau a propus o altă dată.</span>
        </div>
      )}

      {/* Responded at */}
      {r.responded_at && (
        <p className="text-xs text-gray-400 mb-3">Răspuns primit: {fmtDate(r.responded_at)}</p>
      )}

      {showCounter && mode === 'incoming' && (
        <div className="space-y-2 mb-3">
          <input
            type="date"
            value={counterDate}
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            onChange={e => setCounterDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="time"
            value={counterTime}
            onChange={e => setCounterTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <textarea
            rows={2}
            value={counterMsg}
            onChange={e => setCounterMsg(e.target.value)}
            placeholder="Mesaj opțional"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowCounter(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-xs">Înapoi</button>
            <button onClick={handleCounterIncoming} disabled={saving || !counterDate || !counterTime} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs disabled:opacity-50">Trimite</button>
          </div>
        </div>
      )}

      {/* Actions */}
      {(r.status === 'pending' || r.status === 'pending_client' || r.status === 'pending_handyman') && mode === 'outgoing' && (
        <button onClick={handleCancel} disabled={cancelling}
          className="w-full flex items-center justify-center gap-1.5 py-2 border border-gray-200 bg-white text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-60">
          {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Anulează cererea
        </button>
      )}

      {(r.status === 'pending_handyman' || r.status === 'pending') && mode === 'incoming' && !showCounter && (
        <div className="flex gap-2">
          <button onClick={handleAcceptIncoming} disabled={saving}
            className="flex-1 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-60">
            {saving ? '...' : 'Acceptă'}
          </button>
          <button onClick={() => setShowCounter(true)}
            className="flex-1 py-2 border border-blue-200 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-50 transition">
            Propune altă oră
          </button>
          <button onClick={handleCancelTaskAfterFailedReschedule} disabled={saving}
            className="px-3 py-2 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition">
            Anulează task
          </button>
        </div>
      )}
    </div>
  )
}