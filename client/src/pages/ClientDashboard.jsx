import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import DashboardNavbar from '../components/dashboard/DashboardNavbar'
import useLocation from '../hooks/useLocation'
import LocationBanner from '../components/LocationBanner'
import ClientTaskDetailModal from '../components/dashboard/client-dashboard/ClientTaskDetailModal'
import ClientRescheduleModal from '../components/dashboard/client-dashboard/ClientRescheduleModal'
import {
  Plus, Calendar, CheckCircle, Clock, DollarSign,
  Star, MessageSquare, Heart, Briefcase, Search, Bell,
  ArrowRight, MapPin, CalendarClock, TrendingDown,
  AlertCircle, ChevronRight, Loader2, XCircle, RefreshCw,
  DollarSign as MoneyIcon
} from 'lucide-react'

const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  pending:     'bg-yellow-100 text-yellow-700',
  accepted:    'bg-blue-100 text-blue-700',
  confirmed:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
  open:        'bg-gray-100 text-gray-600',
  assigned:    'bg-blue-100 text-blue-700',
}
const STATUS_LABEL = {
  pending:     'În așteptare',
  accepted:    'Acceptat',
  confirmed:   'Confirmat',
  in_progress: 'În progres',
  completed:   'Finalizat',
  cancelled:   'Anulat',
  open:        'Deschis',
  assigned:    'Alocat',
}

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateLong(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO', { weekday: 'short', day: '2-digit', month: 'long' })
}
function fmtPrice(p) {
  if (!p) return '0 RON'
  return `${Number(p).toLocaleString('ro-RO')} RON`
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ─── RescheduleBadge — red indicator ─────────────────────────────────────────

function RescheduleBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
      <CalendarClock className="w-3 h-3" /> Reprogramare
    </span>
  )
}

// ─── RescheduleCard ───────────────────────────────────────────────────────────
function RescheduleCard({ req, jobTitle, onUpdated }) {
  const isOutgoing = req.status === 'pending_handyman'
  const [mode,        setMode]        = useState('review') // 'review' | 'counter'
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [counterDate, setCounterDate] = useState('')
  const [counterTime, setCounterTime] = useState('')
  const [counterMsg,  setCounterMsg]  = useState('')

  const fmtLong = (d) => d ? new Date(d).toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  const handleAccept = async () => {
    setSaving(true); setError(null)
    try {
      await supabase.from('reschedule_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', req.id)
      const table = req.job_type === 'booking' ? 'bookings' : 'tasks'
      await supabase.from(table).update({
        scheduled_date: req.proposed_date,
        scheduled_time: req.proposed_time,
        updated_at: new Date().toISOString(),
      }).eq('id', req.job_id)
      onUpdated?.()
    } catch (e) { setError('Eroare: ' + (e.message ?? '')) }
    finally { setSaving(false) }
  }

  const handleReject = async () => {
    setSaving(true); setError(null)
    try {
      await supabase.from('reschedule_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', req.id)
      onUpdated?.()
    } catch (e) { setError('Eroare: ' + (e.message ?? '')) }
    finally { setSaving(false) }
  }

  const handleCounter = async () => {
    if (!counterDate || !counterTime) { setError('Selectează data și ora.'); return }
    setSaving(true); setError(null)
    try {
      await supabase.from('reschedule_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', req.id)
      await supabase.from('reschedule_requests').insert({
        job_id: req.job_id, job_type: req.job_type,
        handyman_id: req.handyman_id, client_id: req.client_id,
        proposed_date: counterDate, proposed_time: counterTime,
        message: counterMsg || null,
        status: 'pending_handyman',
        created_at: new Date().toISOString(),
      })
      onUpdated?.()
    } catch (e) { setError('Eroare: ' + (e.message ?? '')) }
    finally { setSaving(false) }
  }

  const handleCancel = async () => {
    setSaving(true)
    try {
      await supabase.from('reschedule_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', req.id)
      onUpdated?.()
    } catch (e) { setError('Eroare: ' + (e.message ?? '')) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-red-200 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="w-4 h-4 text-red-600"/>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
              {isOutgoing ? 'Cererea ta de reprogramare' : 'Reprogramare propusă'}
            </span>
          </div>
          <p className="font-bold text-gray-800">{jobTitle}</p>
          <p className="text-xs text-gray-400 mt-0.5">Cerere trimisă: {fmtDate(req.created_at)}</p>
        </div>
        <RescheduleBadge/>
      </div>

      {/* Data propusă */}
      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
        <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">
          {isOutgoing ? 'Propunerea trimisă de tine' : 'Propunerea handymanului'}
        </p>
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-red-500 flex-shrink-0"/>
          <div>
            <p className="font-bold text-gray-800">{fmtLong(req.proposed_date)}</p>
            <p className="text-sm text-red-700 font-medium">Ora {req.proposed_time}</p>
          </div>
        </div>
        {req.message && (
          <div className="mt-3 pt-3 border-t border-red-200">
            <p className="text-xs text-red-500 mb-1">Motiv:</p>
            <p className="text-sm text-gray-700 italic">"{req.message}"</p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Contra-propunere expandabilă */}
      {!isOutgoing && mode === 'counter' && (
        <div className="space-y-3 border border-blue-100 rounded-xl p-4 bg-blue-50">
          <p className="text-sm font-bold text-blue-700">Propune o altă dată</p>
          <input type="date" value={counterDate} onChange={e => setCounterDate(e.target.value)}
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"/>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map(t => (
              <button key={t} type="button" onClick={() => setCounterTime(t)}
                className={`py-2 rounded-xl text-xs font-medium border transition-all
                  ${counterTime === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400'}`}>
                {t}
              </button>
            ))}
          </div>
          <textarea value={counterMsg} onChange={e => setCounterMsg(e.target.value)} rows={2}
            placeholder="Mesaj opțional..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm bg-white"/>
          <div className="flex gap-2">
            <button onClick={() => setMode('review')}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-white transition">
              Înapoi
            </button>
            <button onClick={handleCounter} disabled={saving || !counterDate || !counterTime}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CalendarClock className="w-4 h-4"/>}
              Trimite contra-propunerea
            </button>
          </div>
        </div>
      )}

      {/* Butoane acțiuni */}
      {isOutgoing ? (
        <div className="flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium">
            <Clock className="w-4 h-4"/> În așteptarea handyman-ului
          </div>
          <button onClick={handleCancel} disabled={saving}
            className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Anulează'}
          </button>
        </div>
      ) : mode === 'review' ? (
        <div className="space-y-2">
          <button onClick={handleAccept} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
            Acceptă — {fmtLong(req.proposed_date)}, {req.proposed_time}
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setMode('counter'); setError(null) }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-blue-300 text-blue-600 bg-blue-50 rounded-xl text-sm font-medium hover:bg-blue-100 transition">
              <RefreshCw className="w-4 h-4"/> Propune altă dată
            </button>
            <button onClick={handleReject} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition disabled:opacity-60">
              <XCircle className="w-4 h-4"/> Refuză
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── OffersBadge ─────────────────────────────────────────────────────────────

function OffersBadge({ count }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
      <TrendingDown className="w-3 h-3" /> {count} {count === 1 ? 'ofertă' : 'oferte'}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientDashboard() {
  const navigate = useNavigate()
  const [currentUserId, setCurrentUserId]   = useState(null)
  const [profile,       setProfile]         = useState(null)
  const [stats,         setStats]           = useState(null)
  const [bookings,      setBookings]        = useState([])
  const [tasks,         setTasks]           = useState([])
  const [favorites,     setFavorites]       = useState([])
  const [recentActivity,setRecentActivity]  = useState([])
  const [tab,           setTab]             = useState('overview')
  const [loading,       setLoading]         = useState(true)
  const [detailTaskId,  setDetailTaskId]    = useState(null)

  // Task tab filters
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all')
  const [taskUrgencyFilter, setTaskUrgencyFilter] = useState('all')
  const [taskOffersFilter, setTaskOffersFilter] = useState('all')
  const [taskSortBy, setTaskSortBy] = useState('newest')

  // Reschedule requests pending for this client
  const [rescheduleRequests, setRescheduleRequests] = useState([])
  const [rescheduleModal,    setRescheduleModal]    = useState(null) // { request, jobTitle }

  // Negotiations (price offers from handymen on client's tasks/bookings)
  const [negotiations, setNegotiations] = useState([])
  const [negLoading,   setNegLoading]   = useState(false)
  const [acceptedOffer, setAcceptedOffer] = useState(null) // { handymanName, price, taskTitle }

  const { location, error: locationError } = useLocation(currentUserId)

  // ── load ────────────────────────────────────────────────────────────────────
  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    setCurrentUserId(user.id)

    const [
      profileRes, statsRes, bookingsRes, tasksRes, favsRes, reschedRes, negRes
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('client_dashboard_stats').select('*').eq('client_id', user.id).single(),
      supabase.from('bookings').select('*, handyman:handyman_id(first_name,last_name,avatar_url), service:service_id(title,base_price)')
        .eq('client_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('tasks').select('*, handyman:handyman_id(first_name,last_name,avatar_url), category:category_id(name)')
        .eq('client_id', user.id).eq('is_archived', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('favorite_handymen').select('*, handyman:handyman_id(first_name,last_name,avatar_url,city,handyman_profiles!inner(rating_avg,total_jobs_completed,specialties))')
        .eq('client_id', user.id),
      // Reschedule requests pending for this client (both directions)
      supabase.from('reschedule_requests').select('*').eq('client_id', user.id).in('status', ['pending', 'pending_client', 'pending_handyman']),
    ])

    const tksData = tasksRes.data ?? []
    const taskIds = tksData.map(t => t.id)

    // task_offers: offers from handymen on client tasks (pending or negotiating)
    let taskOffersData = []
    if (taskIds.length > 0) {
      const { data: toData } = await supabase
        .from('task_offers')
        .select('*, handyman:handyman_id(first_name,last_name,avatar_url,city,average_rating)')
        .in('task_id', taskIds)
        .in('status', ['pending', 'negotiating'])
        .order('created_at', { ascending: false })
      // Deduplicate: one row per (task_id + handyman_id) — keep the LATEST (most recent price)
      const seen = new Set()
      taskOffersData = (toData ?? []).filter(row => {
        const key = `${row.task_id}:${row.handyman_id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    setProfile(profileRes.data)
    setStats(statsRes.data)
    setBookings(bookingsRes.data ?? [])
    setTasks(tksData)
    setFavorites(favsRes.data ?? [])
    setRescheduleRequests(reschedRes.data ?? [])
    setNegotiations(taskOffersData)

    // Activity feed
    const bks = bookingsRes.data ?? []
    const tks = tasksRes.data ?? []
    const activity = [
      ...bks.slice(0,3).map(b => ({ type:'booking', title:b.service?.title||'Rezervare', status:b.status, date:b.created_at, handyman:b.handyman?`${b.handyman.first_name} ${b.handyman.last_name}`:null, total:b.total })),
      ...tks.slice(0,3).map(t => ({ type:'task',    title:t.title,                       status:t.status, date:t.created_at, handyman:t.handyman?`${t.handyman.first_name} ${t.handyman.last_name}`:null, category:t.category?.name })),
    ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5)
    setRecentActivity(activity)

    setLoading(false)
  }, [navigate])

  useEffect(() => { loadDashboardData() }, [loadDashboardData])

  // ── helpers ─────────────────────────────────────────────────────────────────

  // Check if a booking/task has a pending reschedule request
  const getRescheduleForJob = (jobId) =>
    rescheduleRequests.find(r => r.job_id === jobId) ?? null

  // Count offers for a given task
  const getOffersForTask = (taskId) =>
    negotiations.filter(n => n.task_id === taskId)

  // Build job title from task id for reschedule modal
  const getJobTitle = (request) => {
    if (request.job_type === 'task') {
      const t = tasks.find(t => t.id === request.job_id)
      return t?.title ?? `Task #${request.job_id.slice(0,6)}`
    }
    const b = bookings.find(b => b.id === request.job_id)
    return b?.service?.title ?? `Rezervare #${request.job_id.slice(0,6)}`
  }

  const removeFavorite = async (handymanId) => {
    await supabase.from('favorite_handymen').delete().eq('client_id', profile.id).eq('handyman_id', handymanId)
    setFavorites(prev => prev.filter(f => f.handyman_id !== handymanId))
    setStats(prev => prev ? { ...prev, favorite_count: prev.favorite_count - 1 } : prev)
  }

  // ── negotiate actions ────────────────────────────────────────────────────────

  const handleAcceptOffer = async (neg) => {
    setNegLoading(true)
    try {
      await supabase.from('task_offers').update({ status: 'accepted' }).eq('id', neg.id)
      // Reject ALL other offers on this task regardless of status
      await supabase.from('task_offers').update({ status: 'rejected' })
        .eq('task_id', neg.task_id).neq('id', neg.id)
      await supabase.from('tasks').update({
        handyman_id: neg.handyman_id,
        status: 'assigned',
        final_price: neg.proposed_price,
        updated_at: new Date().toISOString(),
      }).eq('id', neg.task_id)
      // Show success modal before reloading
      const handymanName = neg.handyman
        ? `${neg.handyman.first_name ?? ''} ${neg.handyman.last_name ?? ''}`.trim()
        : 'Handyman'
      const taskTitle = tasks.find(t => t.id === neg.task_id)?.title ?? 'Task'
      setAcceptedOffer({ handymanName, price: neg.proposed_price, taskTitle })
      await loadDashboardData()
    } finally { setNegLoading(false) }
  }

  const handleRejectOffer = async (neg) => {
    await supabase.from('task_offers').update({ status: 'rejected' }).eq('id', neg.id)
    setNegotiations(prev => prev.filter(n => n.id !== neg.id))
  }

  const handleCounterOffer = async (neg, counterPrice, msg) => {
    // Mark current handyman offer as negotiating
    await supabase.from('task_offers').update({ status: 'negotiating' }).eq('id', neg.id)
    // Insert client's counter-offer with sent_by: 'client'
    await supabase.from('task_offers').insert({
      task_id:           neg.task_id,
      handyman_id:       neg.handyman_id,
      proposed_price:    Number(counterPrice),
      message:           msg || null,
      status:            'pending',
      sent_by:           'client',
      created_at:        new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    })
    await loadDashboardData()
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!profile) return null

  // Group task_offers by task_id — one entry per handyman (already deduped at fetch level)
  const negsByJob = negotiations.reduce((acc, n) => {
    const key = n.task_id
    if (!acc[key]) acc[key] = []
    // Guard: skip if same handyman already in list for this task
    if (!acc[key].some(x => x.handyman_id === n.handyman_id)) {
      acc[key].push(n)
    }
    return acc
  }, {})

  const pendingRescheduleCount = rescheduleRequests.length
  const pendingOffersCount     = Object.keys(negsByJob).length

  const taskCategoryOptions = [...new Set(tasks.map(t => t.category?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ro'))

  const filteredTasks = tasks
    .filter(t => {
      const offersCount = getOffersForTask(t.id).length
      const isAwaiting = t.status === 'open' || t.status === 'pending'
      const isActive = ['assigned', 'accepted', 'confirmed', 'in_progress'].includes(t.status)

      if (taskStatusFilter === 'awaiting' && !isAwaiting) return false
      if (taskStatusFilter === 'active' && !isActive) return false
      if (taskStatusFilter === 'completed' && t.status !== 'completed') return false
      if (taskStatusFilter === 'cancelled' && t.status !== 'cancelled') return false

      if (taskCategoryFilter !== 'all' && (t.category?.name ?? '') !== taskCategoryFilter) return false
      if (taskUrgencyFilter !== 'all' && (t.urgency ?? 'normal') !== taskUrgencyFilter) return false
      if (taskOffersFilter === 'with_offers' && offersCount === 0) return false
      if (taskOffersFilter === 'without_offers' && offersCount > 0) return false

      return true
    })
    .sort((a, b) => {
      if (taskSortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (taskSortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (taskSortBy === 'budget_high') return (Number(b.budget) || 0) - (Number(a.budget) || 0)
      if (taskSortBy === 'budget_low') return (Number(a.budget) || 0) - (Number(b.budget) || 0)

      // status priority
      const rank = { in_progress: 0, assigned: 1, open: 2, pending: 2, completed: 3, cancelled: 4 }
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
    })

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <LocationBanner location={location} error={locationError} onRetry={() => window.location.reload()} />

      <div className="max-w-7xl mx-auto px-4 py-8">


                {/* ── HEADER ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Bine ai revenit{profile.first_name ? `, ${profile.first_name}` : ''}! 👋
            </h1>
            <p className="text-gray-500 mt-1">Iată un rezumat al activității tale pe HandyConnect</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/post-task" className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" /> Postează Task
            </Link>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Rezervări Active', value:stats?.active_bookings||0,                                    Icon:Calendar,  color:'bg-blue-100 text-blue-600' },
            { label:'Finalizate',       value:(stats?.completed_bookings||0)+(stats?.completed_tasks||0),  Icon:CheckCircle,color:'bg-green-100 text-green-600' },
            { label:'Total Cheltuit',   value:fmtPrice(stats?.total_spent),                                 Icon:DollarSign,color:'bg-purple-100 text-purple-600' },
            { label:'Favoriți',         value:stats?.favorite_count||0,                                     Icon:Heart,     color:'bg-red-100 text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{s.label}</p>
                <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center`}>
                  <s.Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { id:'overview',   label:'Prezentare generală' },
            { id:'bookings',   label:'Rezervări' },
            { id:'tasks',      label:'Taskuri' },
            { id:'favorites',  label:'Favoriți' },
            { id:'offers',     label:'Oferte', badge: pendingOffersCount },
            { id:'reschedule', label:'Reprogramări', badge: pendingRescheduleCount, badgeColor:'red' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition
                ${tab===t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {t.label}
              {t.badge > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center
                  ${t.badgeColor === 'red' ? 'bg-red-500' : 'bg-orange-500'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">

              {/* Bookings */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Rezervări Recente</h3>
                  <button onClick={() => setTab('bookings')} className="text-sm text-blue-600 font-medium hover:underline">Vezi toate</button>
                </div>
                {bookings.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {bookings.slice(0,4).map(b => {
                      const resched = getRescheduleForJob(b.id)
                      return (
                        <div key={b.id} className="p-4 hover:bg-gray-50 transition">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                                {b.handyman ? `${b.handyman.first_name?.[0]||''}${b.handyman.last_name?.[0]||''}` : '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800 text-sm">{b.service?.title||'Rezervare'}</p>
                                <p className="text-xs text-gray-500">{b.handyman?`${b.handyman.first_name} ${b.handyman.last_name}`:'Nealocat'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <StatusBadge status={b.status}/>
                              <p className="text-sm font-bold text-gray-800">{fmtPrice(b.total)}</p>
                            </div>
                          </div>
                          {resched && (
                            <button onClick={() => setRescheduleModal({ request: resched, jobTitle: b.service?.title||'Rezervare' })}
                              className="mt-2 flex items-center gap-1.5">
                              <RescheduleBadge/>
                              <span className="text-xs text-red-600">→ {fmtDateLong(resched.proposed_date)} {resched.proposed_time}</span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
                    <p className="text-gray-500 text-sm">Nicio rezervare încă</p>
                    <Link to="/find-services" className="text-sm text-blue-600 font-medium hover:underline mt-2 inline-block">Caută servicii</Link>
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Taskurile Tale</h3>
                  <button onClick={() => setTab('tasks')} className="text-sm text-blue-600 font-medium hover:underline">Vezi toate</button>
                </div>
                {tasks.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {tasks.slice(0,4).map(t => {
                      const offers  = getOffersForTask(t.id)
                      const resched = getRescheduleForJob(t.id)
                      return (
                        <div key={t.id} className="p-4 hover:bg-gray-50 transition cursor-pointer" onClick={() => setDetailTaskId(t.id)}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-800 text-sm">{t.title}</p>
                            <StatusBadge status={t.status}/>
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{t.category?.name||'Necategorizat'} · {fmtDate(t.created_at)}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {offers.length > 0 && (
                              <button onClick={e => { e.stopPropagation(); setTab('offers') }}>
                                <OffersBadge count={offers.length}/>
                              </button>
                            )}
                            {resched && (
                              <button onClick={e => { e.stopPropagation(); setRescheduleModal({ request: resched, jobTitle: t.title }) }}>
                                <RescheduleBadge/>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
                    <p className="text-gray-500 text-sm">Niciun task postat</p>
                    <Link to="/post-task" className="text-sm text-blue-600 font-medium hover:underline mt-2 inline-block">Postează un task</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-4">
              {/* Activity */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="p-5 border-b border-gray-100"><h3 className="font-bold text-gray-800">Activitate Recentă</h3></div>
                <div className="p-5 space-y-4">
                  {recentActivity.length > 0 ? recentActivity.map((item,i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.type==='booking'?'bg-blue-100':'bg-purple-100'}`}>
                        {item.type==='booking' ? <Calendar className="w-4 h-4 text-blue-600"/> : <Briefcase className="w-4 h-4 text-purple-600"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={item.status}/>
                          {item.handyman && <span className="text-xs text-gray-400">{item.handyman}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{fmtDate(item.date)}</p>
                      </div>
                      {item.total && <span className="text-sm font-bold text-gray-800 flex-shrink-0">{fmtPrice(item.total)}</span>}
                    </div>
                  )) : (
                    <div className="text-center py-6"><Bell className="w-8 h-8 text-gray-300 mx-auto mb-2"/><p className="text-sm text-gray-500">Nicio activitate</p></div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-3">Acțiuni Rapide</h3>
                <div className="space-y-2">
                  {[
                    { label:'Caută Handymani', Icon:Search,       path:'/find-services', color:'text-blue-600 bg-blue-50' },
                    { label:'Postează Task',   Icon:Plus,          path:'/post-task',     color:'text-green-600 bg-green-50' },
                    { label:'Mesaje',          Icon:MessageSquare, path:'#',              color:'text-purple-600 bg-purple-50' },
                    { label:'Scrie Recenzie',  Icon:Star,          path:'#',              color:'text-yellow-600 bg-yellow-50' },
                  ].map(a => (
                    <Link key={a.label} to={a.path} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition group">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${a.color} rounded-lg flex items-center justify-center`}><a.Icon className="w-4 h-4"/></div>
                        <span className="text-sm font-medium text-gray-700">{a.label}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 transition"/>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: BOOKINGS
        ══════════════════════════════════════════════════════ */}
        {tab === 'bookings' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Toate Rezervările ({bookings.length})</h3>
            </div>
            {bookings.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {bookings.map(b => {
                  const resched = getRescheduleForJob(b.id)
                  return (
                    <div key={b.id} className={`p-5 hover:bg-gray-50 transition ${resched ? 'border-l-4 border-red-400' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                            {b.handyman?`${b.handyman.first_name?.[0]||''}${b.handyman.last_name?.[0]||''}`:'?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{b.service?.title||'Rezervare'}</p>
                            <p className="text-sm text-gray-500">{b.handyman?`${b.handyman.first_name} ${b.handyman.last_name}`:'Nealocat'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={b.status}/>
                          <p className="text-lg font-bold text-blue-600 mt-1">{fmtPrice(b.total)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-2 flex-wrap">
                        <div className="flex items-center gap-1"><Calendar className="w-3 h-3"/><span>Creat: {fmtDate(b.created_at)}</span></div>
                        {b.scheduled_date && <div className="flex items-center gap-1"><Clock className="w-3 h-3"/><span>Programat: {fmtDate(b.scheduled_date)} {b.scheduled_time||''}</span></div>}
                        {b.service_address && <div className="flex items-center gap-1"><MapPin className="w-3 h-3"/><span>{b.service_address}</span></div>}
                      </div>
                      {resched && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-red-600 flex-shrink-0"/>
                            <div>
                              <p className="text-xs font-bold text-red-700">Cerere reprogramare de la handyman</p>
                              <p className="text-xs text-red-600">Propune: <strong>{fmtDateLong(resched.proposed_date)}</strong> · {resched.proposed_time}</p>
                              {resched.message && <p className="text-xs text-red-500 italic mt-0.5">"{resched.message}"</p>}
                            </div>
                          </div>
                          <button onClick={() => setRescheduleModal({ request: resched, jobTitle: b.service?.title||'Rezervare' })}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition flex-shrink-0">
                            Răspunde
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
                <h3 className="font-bold text-gray-800 mb-2">Nicio rezervare încă</h3>
                <Link to="/find-services" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition">Caută Servicii</Link>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: TASKS
        ══════════════════════════════════════════════════════ */}
        {tab === 'tasks' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Taskurile Tale ({filteredTasks.length}/{tasks.length})</h3>
              <Link to="/post-task" className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline"><Plus className="w-4 h-4"/>Postează Task Nou</Link>
            </div>

            {/* Task filters */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/60 space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Toate' },
                  { id: 'awaiting', label: 'În așteptare' },
                  { id: 'active', label: 'Active' },
                  { id: 'completed', label: 'Finalizate' },
                  { id: 'cancelled', label: 'Anulate' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setTaskStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      taskStatusFilter === f.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-4 gap-2">
                <select
                  value={taskCategoryFilter}
                  onChange={e => setTaskCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toate categoriile</option>
                  {taskCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                  value={taskUrgencyFilter}
                  onChange={e => setTaskUrgencyFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toate urgențele</option>
                  <option value="high">Urgent</option>
                  <option value="medium">Mediu</option>
                  <option value="normal">Normal</option>
                  <option value="low">Fără grabă</option>
                </select>

                <select
                  value={taskOffersFilter}
                  onChange={e => setTaskOffersFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toate (oferte)</option>
                  <option value="with_offers">Doar cu oferte</option>
                  <option value="without_offers">Fără oferte</option>
                </select>

                <select
                  value={taskSortBy}
                  onChange={e => setTaskSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Cele mai noi</option>
                  <option value="oldest">Cele mai vechi</option>
                  <option value="budget_high">Buget descrescător</option>
                  <option value="budget_low">Buget crescător</option>
                  <option value="status">După status</option>
                </select>
              </div>
            </div>

            {filteredTasks.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {filteredTasks.map(t => {
                  const offers  = getOffersForTask(t.id)
                  const resched = getRescheduleForJob(t.id)
                  const hasBorder = offers.length > 0 || resched
                  const isAssignedTask = t.status === 'assigned'
                  const cancelledByClient   = t.special_instructions?.includes('[ANULARE CLIENT]')
                  const cancelledByHandyman = t.special_instructions?.includes('[ANULARE HANDYMAN]')
                  const statusInfo =
                    t.status === 'in_progress'
                      ? `Handymanul a început lucrarea${t.handyman ? ` (${t.handyman.first_name} ${t.handyman.last_name})` : ''}`
                      : t.status === 'completed'
                        ? 'Lucrarea este finalizată'
                        : t.status === 'assigned'
                          ? `Task alocat${t.handyman ? ` către ${t.handyman.first_name} ${t.handyman.last_name}` : ''}`
                          : t.status === 'cancelled'
                            ? cancelledByHandyman
                              ? 'Anulat de handyman'
                              : cancelledByClient
                                ? 'Anulat de client'
                                : 'Task anulat'
                            : 'Task în așteptarea unui handyman'
                  return (
                    <div key={t.id} className={`p-5 hover:bg-gray-50 transition cursor-pointer ${hasBorder ? 'border-l-4 border-orange-400' : ''}`}
                      onClick={() => setDetailTaskId(t.id)}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-800">{t.title}</p>
                          <p className="text-sm text-gray-500">{t.category?.name||'Necategorizat'}</p>
                        </div>
                        <StatusBadge status={t.status}/>
                      </div>
                      {t.description && <p className="text-sm text-gray-600 mb-2 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3"/><span>{fmtDate(t.created_at)}</span></div>
                        <span className={`${t.status === 'completed' ? 'text-green-600' : t.status === 'in_progress' ? 'text-purple-600' : t.status === 'assigned' ? 'text-blue-600' : 'text-yellow-600'} font-medium`}>
                          {statusInfo}
                        </span>
                      </div>

                      {isAssignedTask && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setDetailTaskId(t.id)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            Reprogramează
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setDetailTaskId(t.id)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Anulează
                          </button>
                        </div>
                      )}

                      {/* Badges */}
                      {(offers.length > 0 || resched) && (
                        <div className="flex flex-wrap gap-2">
                          {offers.length > 0 && (
                            <button onClick={e => { e.stopPropagation(); setTab('offers') }}>
                              <OffersBadge count={offers.length}/>
                            </button>
                          )}
                          {resched && (
                            <button onClick={e => { e.stopPropagation(); setRescheduleModal({ request: resched, jobTitle: t.title }) }}>
                              <RescheduleBadge/>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
                <h3 className="font-bold text-gray-800 mb-2">Nu există taskuri pentru filtrele selectate</h3>
                <button
                  onClick={() => {
                    setTaskStatusFilter('all')
                    setTaskCategoryFilter('all')
                    setTaskUrgencyFilter('all')
                    setTaskOffersFilter('all')
                    setTaskSortBy('newest')
                  }}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition"
                >
                  Resetează filtrele
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: OFFERS (Oferte de preț de la handymani)
        ══════════════════════════════════════════════════════ */}
        {tab === 'offers' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-orange-500"/>
              <h2 className="text-lg font-bold text-gray-800">Oferte de Preț</h2>
              <span className="px-2.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                {negotiations.length} oferte active
              </span>
            </div>

            {Object.keys(negsByJob).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                <TrendingDown className="w-12 h-12 text-gray-200 mx-auto mb-4"/>
                <h3 className="font-bold text-gray-700 mb-1">Nicio ofertă activă</h3>
                <p className="text-sm text-gray-400">Ofertele de preț de la handymani vor apărea aici.</p>
              </div>
            ) : (
              Object.entries(negsByJob).map(([jobId, offers]) => {
                const task    = tasks.find(t => t.id === jobId)
                const booking = bookings.find(b => b.id === jobId)
                const jobTitle = task?.title ?? booking?.service?.title ?? `Job #${jobId.slice(0,6)}`
                const originalPrice = task?.budget ?? booking?.total

                return (
                  <div key={jobId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Job header */}
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800">{jobTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={task?.status ?? booking?.status}/>
                          {originalPrice && (
                            <span className="text-xs text-gray-500">
                              Buget original: <strong className="text-gray-700">{fmtPrice(originalPrice)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                        {offers.length} {offers.length === 1 ? 'ofertă' : 'oferte'}
                      </span>
                    </div>

                    {/* Offers list */}
                    <div className="divide-y divide-gray-50">
                      {offers.map(neg => (
                        <OfferRow
                          key={neg.id}
                          neg={neg}
                          originalPrice={originalPrice}
                          loading={negLoading}
                          onAccept={() => handleAcceptOffer(neg)}
                          onReject={() => handleRejectOffer(neg)}
                          onCounter={(price, msg) => handleCounterOffer(neg, price, msg)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: RESCHEDULE (Cereri de reprogramare)
        ══════════════════════════════════════════════════════ */}
        {tab === 'reschedule' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <CalendarClock className="w-5 h-5 text-red-500"/>
              <h2 className="text-lg font-bold text-gray-800">Cereri de Reprogramare</h2>
              {pendingRescheduleCount > 0 && (
                <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                  {pendingRescheduleCount} în așteptare
                </span>
              )}
            </div>

            {rescheduleRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                <CalendarClock className="w-12 h-12 text-gray-200 mx-auto mb-4"/>
                <h3 className="font-bold text-gray-700 mb-1">Nicio cerere în așteptare</h3>
                <p className="text-sm text-gray-400">Cererile de reprogramare de la handymani vor apărea aici.</p>
              </div>
            ) : (
              rescheduleRequests.map(req => {
                const task     = tasks.find(t => t.id === req.job_id)
                const booking  = bookings.find(b => b.id === req.job_id)
                const jobTitle = task?.title ?? booking?.service?.title ?? `Job #${req.job_id.slice(0,6)}`
                return (
                  <RescheduleCard key={req.id} req={req} jobTitle={jobTitle} onUpdated={loadDashboardData}/>
                )
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: FAVORITES
        ══════════════════════════════════════════════════════ */}
        {tab === 'favorites' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Handymani Favoriți ({favorites.length})</h3>
            </div>
            {favorites.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4 p-5">
                {favorites.map(fav => {
                  const h = fav.handyman
                  const hp = h?.handyman_profiles?.[0]
                  return (
                    <div key={fav.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition">
                      <div className="flex items-center gap-3 mb-3">
                        {h?.avatar_url
                          ? <img src={h.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover"/>
                          : <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{h?.first_name?.[0]}{h?.last_name?.[0]}</div>
                        }
                        <div className="flex-1">
                          <p className="font-bold text-gray-800">{h?.first_name} {h?.last_name}</p>
                          {h?.city && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3"/>{h.city}</p>}
                        </div>
                        <button onClick={() => removeFavorite(fav.handyman_id)} className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition">
                          <Heart className="w-4 h-4 fill-red-500 text-red-500"/>
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-sm mb-2">
                        {hp?.rating_avg > 0 && <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"/><span className="font-medium">{hp.rating_avg}</span></div>}
                        {hp?.total_jobs_completed > 0 && <span className="text-gray-500">{hp.total_jobs_completed} lucrări</span>}
                      </div>
                      {hp?.specialties && (
                        <div className="flex flex-wrap gap-1">
                          {hp.specialties.slice(0,3).map((s,i) => <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-lg">{s}</span>)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
                <h3 className="font-bold text-gray-800 mb-2">Niciun favorit încă</h3>
                <Link to="/find-services" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition">Caută Handymani</Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accept success modal */}
      {acceptedOffer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={() => setAcceptedOffer(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
            onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Ofertă Acceptată!</h2>
            <p className="text-sm text-gray-500 mb-4">
              Ai acceptat oferta lui <strong className="text-gray-700">{acceptedOffer.handymanName}</strong> pentru{' '}
              <strong className="text-gray-700">{acceptedOffer.taskTitle}</strong> la prețul de{' '}
              <strong className="text-blue-700">{Number(acceptedOffer.price).toLocaleString('ro-RO')} RON</strong>.
            </p>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left space-y-1.5 text-sm text-green-800 mb-5">
              <p>✓ Handymanul a fost notificat</p>
              <p>✓ Taskul apare acum în secțiunea Taskuri ca "Alocat"</p>
              <p>✓ Handymanul va lua legătura cu tine pentru detalii</p>
            </div>
            <button onClick={() => setAcceptedOffer(null)}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
              Super, mulțumesc!
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ClientTaskDetailModal taskId={detailTaskId} onClose={() => setDetailTaskId(null)} onUpdated={loadDashboardData}/>
      {rescheduleModal && (
        <ClientRescheduleModal
          request={rescheduleModal.request}
          jobTitle={rescheduleModal.jobTitle}
          onClose={() => setRescheduleModal(null)}
          onUpdated={() => { setRescheduleModal(null); loadDashboardData() }}
        />
      )}
    </div>
  )
}

// ─── OFFER ROW ────────────────────────────────────────────────────────────────

function OfferRow({ neg, originalPrice, loading, onAccept, onReject, onCounter }) {
  const [showCounter,  setShowCounter]  = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterMsg,   setCounterMsg]   = useState('')
  const [handymanRounds, setHandymanRounds] = useState(0)
  const [clientRounds,   setClientRounds]   = useState(0)

  const MAX_ROUNDS = 3

  // Load all offers for this task to count rounds
  useEffect(() => {
    supabase.from('task_offers')
      .select('id, sent_by, status')
      .eq('task_id', neg.task_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const rows = data ?? []
        setHandymanRounds(rows.filter(r => (r.sent_by ?? 'handyman') === 'handyman').length)
        setClientRounds(rows.filter(r => r.sent_by === 'client').length)
      })
  }, [neg.task_id, neg.id])

  const canCounter     = neg.status !== 'negotiating' && clientRounds < MAX_ROUNDS
  const roundsExhausted = clientRounds >= MAX_ROUNDS

  const savings = originalPrice && neg.proposed_price
    ? Number(originalPrice) - Number(neg.proposed_price)
    : null

  const handymanName = neg.handyman
    ? `${neg.handyman.first_name ?? ''} ${neg.handyman.last_name ?? ''}`.trim() || 'Handyman'
    : `Handyman #${neg.handyman_id?.slice(0,8)}`

  return (
    <div className="p-5">
      {/* Handyman info + price */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{handymanName}</p>
          {neg.handyman?.city && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3"/>{neg.handyman.city}</p>
          )}
          {neg.estimated_duration && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/>{neg.estimated_duration}</p>
          )}
          {neg.available_date && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3"/>
              {new Date(neg.available_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}
              {neg.available_time ? ` · ${neg.available_time}` : ''}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-blue-700">{fmtPrice(neg.proposed_price)}</p>
          {savings > 0 && <p className="text-xs text-green-600 font-semibold">-{fmtPrice(savings)} față de buget</p>}
          {savings < 0 && <p className="text-xs text-red-500 font-semibold">+{fmtPrice(Math.abs(savings))} peste buget</p>}
        </div>
      </div>

      {/* Round counter — symmetric with handyman view */}
      <div className="flex items-center gap-3 mb-3 py-2 border-y border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 font-medium">Handyman:</span>
          {[1,2,3].map(i => (
            <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border
              ${i <= handymanRounds ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-300 border-gray-200'}`}>
              {i}
            </span>
          ))}
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 font-medium">Tu:</span>
          {[1,2,3].map(i => (
            <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border
              ${i <= clientRounds ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-300 border-gray-200'}`}>
              {i}
            </span>
          ))}
        </div>
        {roundsExhausted && (
          <span className="text-xs text-red-500 font-medium ml-1">· Limita ta atinsă</span>
        )}
      </div>

      {/* Message */}
      {neg.message && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm text-gray-600 italic">
          "{neg.message}"
        </div>
      )}

      {/* Waiting status */}
      {neg.status === 'negotiating' && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-3 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin flex-shrink-0"/>
          <div>
            <p className="text-xs font-bold text-orange-600">Ai trimis o contra-ofertă</p>
            <p className="text-xs text-orange-500">Aștepți răspunsul handymanului...</p>
          </div>
        </div>
      )}

      {/* Counter form */}
      {showCounter && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 space-y-2">
          <p className="text-xs font-bold text-gray-600">
            Contra-ofertă ({MAX_ROUNDS - clientRounds} {MAX_ROUNDS - clientRounds === 1 ? 'rundă rămasă' : 'runde rămase'})
          </p>
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
            <button onClick={() => { onCounter(counterPrice, counterMsg); setShowCounter(false); setCounterPrice(''); setCounterMsg('') }}
              disabled={!counterPrice || loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50">
              Trimite
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onAccept} disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition disabled:opacity-60">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle className="w-3.5 h-3.5"/>}
          Acceptă {fmtPrice(neg.proposed_price)}
        </button>
        {canCounter && !showCounter && (
          <button onClick={() => setShowCounter(true)}
            className="px-4 py-2.5 border border-blue-200 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition">
            Negociază
          </button>
        )}
        {roundsExhausted && !showCounter && (
          <div className="px-3 py-2.5 bg-gray-100 text-gray-400 rounded-xl text-xs flex items-center">
            Limită atinsă
          </div>
        )}
        <button onClick={onReject} disabled={loading}
          className="px-3 py-2.5 border border-red-200 text-red-400 rounded-xl text-xs hover:bg-red-50 hover:text-red-600 transition disabled:opacity-60">
          <XCircle className="w-3.5 h-3.5"/>
        </button>
      </div>
    </div>
  )
}