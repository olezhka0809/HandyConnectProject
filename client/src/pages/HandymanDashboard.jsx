import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import HandymanNavbar from '../components/handyman-dashboard/HandymanNavbar'
import JobRequestModal from '../components/handyman-dashboard/JobRequestModal'
import TaskDetailModal from '../components/handyman-dashboard/TaskDetailModal'
import {
  MessageCircle, MapPin, Camera,
  Briefcase, Star, TrendingUp, Eye, DollarSign, Users,
  ChevronRight, Calendar, Award, BarChart3, Target,
  Clock, Play, CalendarClock, Loader2, CheckCircle2
} from 'lucide-react'

const mockRequests = [
  {
    title: 'Upgrade Electric Bucătărie',
    client: 'Maria Popescu',
    date: 'Dec 08, 2025 la 10:00AM',
    photos: 3,
    address: 'Str. Victoriei 15, Timișoara',
    price: '850 RON',
    urgency: 'high',
  },
  {
    title: 'Reglare Cablaj Baie',
    client: 'Andrei Vasile',
    date: 'Feb 20, 2026 la 9:00AM',
    photos: 2,
    address: 'Str. Eroilor 45, Timișoara',
    price: '450 RON',
    urgency: 'medium',
  },
  {
    title: 'Instalare Iluminat Living',
    client: 'Elena Dumitrescu',
    date: 'Ian 15, 2026 la 2:30PM',
    photos: 5,
    address: 'Bd. Revoluției 123, Timișoara',
    price: '650 RON',
    urgency: 'normal',
  },
  {
    title: 'Instalare Lumini Securitate Exterior',
    client: 'Bogdan Cristea',
    date: 'Mar 30, 2026 la 11:00AM',
    photos: 4,
    address: 'Str. Dacilor 78, Timișoara',
    price: '520 RON',
    urgency: 'low',
  },
]


const monthlyData = [
  { month: 'Ian', revenue: 5000, jobs: 8 },
  { month: 'Feb', revenue: 8000, jobs: 12 },
  { month: 'Mar', revenue: 12000, jobs: 15 },
  { month: 'Apr', revenue: 18000, jobs: 20 },
  { month: 'Mai', revenue: 15000, jobs: 18 },
  { month: 'Iun', revenue: 22000, jobs: 25 },
  { month: 'Iul', revenue: 28000, jobs: 30 },
]

const serviceBreakdown = [
  { name: 'Instalații Electrice', percentage: 45, color: 'bg-blue-500' },
  { name: 'Reparații Generale', percentage: 30, color: 'bg-green-500' },
  { name: 'Generator', percentage: 15, color: 'bg-yellow-500' },
  { name: 'Sisteme Securitate', percentage: 10, color: 'bg-purple-500' },
]

const weeklyBookings = [
  { day: 'Lun', count: 4 },
  { day: 'Mar', count: 6 },
  { day: 'Mie', count: 8 },
  { day: 'Joi', count: 5 },
  { day: 'Vin', count: 10 },
  { day: 'Sâm', count: 7 },
  { day: 'Dum', count: 2 },
]

const ratingDistribution = [
  { stars: 5, percentage: 85, count: 85 },
  { stars: 4, percentage: 10, count: 10 },
  { stars: 3, percentage: 3, count: 3 },
  { stars: 2, percentage: 1, count: 1 },
  { stars: 1, percentage: 1, count: 1 },
]

export default function HandymanDashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState({
    newRequests:     null,
    activeJobs:      null,
    weeklyEarnings:  null,
    availableNow:    null,
    ratingAvg:       null,
    totalReviews:    null,
  })
  const [recentJobs, setRecentJobs] = useState(null)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [todayItems, setTodayItems] = useState(null)
  const [startingJobId, setStartingJobId] = useState(null)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const [profileRes, hpRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('handyman_profiles').select('rating_avg').eq('user_id', user.id).maybeSingle(),
      ])
      setProfile(profileRes.data)

      // ── Cereri noi: tasks propuse specific acestui handyman (de client) ce sunt încă open
      const { count: newRequestsCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .contains('proposed_to', [user.id])
        .eq('status', 'open')

      // ── Job-uri active: tasks acceptate de/asignate handymanului, în desfășurare
      const { count: activeCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('handyman_id', user.id)
        .in('status', ['in_progress', 'accepted', 'assigned'])

      // ── Câștiguri săptămâna aceasta: job_completions cu client_accepted = true
      const monday = new Date()
      monday.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1))
      monday.setHours(0, 0, 0, 0)
      const mondayISO = monday.toISOString()

      // Data disponibilă = marcat ca finalizat de client cu cel puțin 3 zile în urmă
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()

      const { data: weeklyCompletions } = await supabase
        .from('job_completions')
        .select('job_id, job_type, client_responded_at')
        .eq('handyman_id', user.id)
        .eq('client_accepted', true)
        .gte('client_responded_at', mondayISO)

      // Calculează câștigurile din bugetele task-urilor finalizate
      let weeklyEarnings = 0
      let availableNow   = 0
      const taskIds = (weeklyCompletions ?? []).filter(c => c.job_type === 'task').map(c => c.job_id)
      if (taskIds.length > 0) {
        const { data: taskData } = await supabase
          .from('tasks')
          .select('id, budget')
          .in('id', taskIds)
        const budgetMap = Object.fromEntries((taskData ?? []).map(t => [t.id, parseFloat(t.budget) || 0]))
        for (const c of weeklyCompletions ?? []) {
          const amount = budgetMap[c.job_id] ?? 0
          weeklyEarnings += amount
          if (c.client_responded_at <= threeDaysAgo) availableNow += amount
        }
      }

      setStats({
        newRequests:    newRequestsCount ?? 0,
        activeJobs:     activeCount ?? 0,
        weeklyEarnings,
        availableNow,
        ratingAvg:      hpRes.data?.rating_avg ?? null,
        totalReviews:   null,
      })

      // ── Cereri de Job Recente: propuse + acceptate ──
      const [proposedRes, activeRes, bookingsRes] = await Promise.all([
        // Tasks propuse specific acestui handyman (open)
        supabase.from('tasks')
          .select('id, title, urgency, budget, scheduled_date, scheduled_time, address_city, photos, status, created_at, profiles!tasks_client_id_fkey(first_name, last_name)')
          .contains('proposed_to', [user.id])
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(4),

        // Tasks deja acceptate/active ale handymanului
        supabase.from('tasks')
          .select('id, title, urgency, budget, scheduled_date, scheduled_time, address_city, photos, status, created_at, profiles!tasks_client_id_fkey(first_name, last_name)')
          .eq('handyman_id', user.id)
          .in('status', ['in_progress', 'accepted', 'assigned'])
          .order('created_at', { ascending: false })
          .limit(4),

        // Rezervări active
        supabase.from('bookings')
          .select('id, contact_name, scheduled_date, scheduled_time, service_address, status, total, created_at, handyman_services(title)')
          .eq('handyman_id', user.id)
          .in('status', ['upcoming', 'confirmed', 'accepted', 'pending'])
          .order('created_at', { ascending: false })
          .limit(3),
      ])

      const proposed = (proposedRes.data ?? []).map(t => ({ ...t, _type: 'task', _isNew: true, urgency_level: t.urgency, address_county: t.address_city }))
      const active   = (activeRes.data ?? []).map(t => ({ ...t, _type: 'task', _isNew: false, urgency_level: t.urgency, address_county: t.address_city }))
      const bookings = (bookingsRes.data ?? []).map(b => ({
        ...b, _type: 'booking', _isNew: false,
        title: b.handyman_services?.title ?? `Rezervare #${b.id.slice(0, 6)}`,
        urgency_level: 'normal',
        budget: b.total,
        address_county: b.service_address,
        profiles: { first_name: b.contact_name ?? 'Client', last_name: '' },
      }))

      const combined = [...proposed, ...active, ...bookings]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6)

      setRecentJobs(combined)

      // ── Programul de Azi ──────────────────────────────────────────────────
      const todayISO = new Date().toISOString().split('T')[0]
      const [todayTasksRes, todayBookingsRes] = await Promise.all([
        supabase.from('tasks')
          .select('id, title, scheduled_time, status, urgency, profiles!tasks_client_id_fkey(first_name, last_name)')
          .eq('handyman_id', user.id)
          .eq('scheduled_date', todayISO)
          .in('status', ['accepted', 'assigned', 'in_progress'])
          .order('scheduled_time', { ascending: true }),

        supabase.from('bookings')
          .select('id, contact_name, scheduled_time, status, handyman_services(title)')
          .eq('handyman_id', user.id)
          .eq('scheduled_date', todayISO)
          .in('status', ['confirmed', 'upcoming', 'accepted', 'pending'])
          .order('scheduled_time', { ascending: true }),
      ])

      const todayTasks = (todayTasksRes.data ?? []).map(t => ({
        id: t.id, _type: 'task',
        title: t.title,
        time: t.scheduled_time ?? '—',
        status: t.status,
        client: t.profiles ? `${t.profiles.first_name ?? ''} ${t.profiles.last_name ?? ''}`.trim() || 'Client' : 'Client',
      }))
      const todayBookings = (todayBookingsRes.data ?? []).map(b => ({
        id: b.id, _type: 'booking',
        title: b.handyman_services?.title ?? `Rezervare #${b.id.slice(0, 6)}`,
        time: b.scheduled_time ?? '—',
        status: b.status,
        client: b.contact_name ?? 'Client',
      }))

      const allToday = [...todayTasks, ...todayBookings].sort((a, b) => {
        if (a.time === '—') return 1
        if (b.time === '—') return -1
        return a.time.localeCompare(b.time)
      })
      setTodayItems(allToday)
    }
    loadData()
  }, [navigate])

  const handleStartJob = async (item) => {
    setStartingJobId(item.id)
    const table = item._type === 'booking' ? 'bookings' : 'tasks'
    await supabase.from(table).update({ status: 'in_progress' }).eq('id', item.id)
    setTodayItems(prev => (prev ?? []).map(i => i.id === item.id ? { ...i, status: 'in_progress' } : i))
    setStartingJobId(null)
  }

  const maxRevenue = Math.max(...monthlyData.map(d => d.revenue))
  const maxWeekly = Math.max(...weeklyBookings.map(d => d.count))

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <HandymanNavbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bine ai revenit{profile.first_name ? `, ${profile.first_name}` : ''}! 👋</h1>
            <p className="text-gray-500 mt-1">Iată prezentarea generală a afacerii și pipeline-ul de job-uri</p>
          </div>
          <Link
            to="/handyman/jobs"
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <Eye className="w-4 h-4" />
            Vezi Job-uri
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Cereri Noi',
              value: stats.newRequests === null ? '—' : String(stats.newRequests),
              change: stats.newRequests === null ? 'Se încarcă…' : stats.newRequests === 0 ? 'Nicio cerere nouă' : `${stats.newRequests} task${stats.newRequests !== 1 ? '-uri' : ''} propuse ție`,
              changeColor: stats.newRequests > 0 ? 'text-green-600' : 'text-gray-400',
              icon: MessageCircle, color: 'bg-blue-100 text-blue-600',
            },
            {
              label: 'Job-uri Active',
              value: stats.activeJobs === null ? '—' : String(stats.activeJobs),
              change: stats.activeJobs === null ? 'Se încarcă…' : stats.activeJobs === 0 ? 'Niciun job activ' : `${stats.activeJobs} în desfășurare`,
              changeColor: 'text-gray-500',
              icon: Briefcase, color: 'bg-green-100 text-green-600',
            },
            {
              label: 'Câștiguri săptămâna aceasta',
              value: stats.weeklyEarnings === null ? '—' : `${stats.weeklyEarnings.toLocaleString('ro-RO')} RON`,
              change: stats.availableNow !== null && stats.availableNow > 0
                ? `${stats.availableNow.toLocaleString('ro-RO')} RON disponibili acum`
                : stats.weeklyEarnings > 0 ? 'Disponibil după 3 zile' : 'Nicio plată săptămâna aceasta',
              changeColor: stats.availableNow > 0 ? 'text-green-600' : 'text-gray-400',
              icon: DollarSign, color: 'bg-purple-100 text-purple-600',
            },
            {
              label: 'Rating Mediu',
              value: stats.ratingAvg === null ? '—' : Number(stats.ratingAvg).toFixed(1),
              change: stats.ratingAvg === null ? 'Se încarcă…' : `din 5.0 stele`,
              changeColor: 'text-gray-500',
              icon: Star, color: 'bg-yellow-100 text-yellow-600',
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className={`text-sm mt-1 ${stat.changeColor}`}>{stat.change}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['overview', 'earnings'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition
                ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}
              `}
            >
              {t === 'overview' ? 'Prezentare generală' : 'Câștiguri'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {/* Job Requests + Today Schedule */}
            <div className="grid lg:grid-cols-5 gap-6 mb-6">
              {/* Recent Job Requests */}
              <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Cereri de Job Recente</h3>
                  <Link to="/handyman/jobs" className="text-sm text-blue-600 font-medium hover:underline">Vezi toate</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {recentJobs === null ? (
                    <div className="p-8 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : recentJobs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400">
                      Nicio cerere sau job activ momentan.
                    </div>
                  ) : recentJobs.map((job) => {
                    const clientName = job.profiles
                      ? `${job.profiles.first_name ?? ''} ${job.profiles.last_name ?? ''}`.trim() || 'Client'
                      : 'Client'
                    const urgency = job.urgency_level ?? 'normal'
                    const urgencyLabel = urgency === 'high' ? 'Urgent' : urgency === 'medium' ? 'Mediu' : 'Normal'
                    const urgencyCls   = urgency === 'high' ? 'bg-red-100 text-red-700' : urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    const statusLabel  = job._isNew ? 'Cerere nouă' : job._type === 'booking' ? 'Rezervare' : job.status === 'in_progress' ? 'În progres' : 'Acceptat'
                    const statusCls    = job._isNew ? 'bg-blue-100 text-blue-700' : job.status === 'in_progress' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    const dateStr      = job.scheduled_date
                      ? new Date(job.scheduled_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) + (job.scheduled_time ? ` · ${job.scheduled_time}` : '')
                      : '—'
                    const photosCount  = Array.isArray(job.photos) ? job.photos.length : 0

                    const isTask = job._type === 'task'
                    return (
                      <div key={job.id}
                        className={`p-5 transition ${isTask ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                        onClick={() => isTask && setSelectedTaskId(job.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-800 text-sm truncate">{job.title}</h4>
                              {/* tip badge */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 border ${
                                isTask ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'
                              }`}>
                                <Briefcase className="w-2.5 h-2.5" />
                                {isTask ? 'Task' : 'Rezervare'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${urgencyCls}`}>{urgencyLabel}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusCls}`}>{statusLabel}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">{clientName}</p>
                          </div>
                          {job.budget && (
                            <span className="font-bold text-blue-600 text-sm ml-3 flex-shrink-0">{job.budget} RON</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{dateStr}</span>
                          </div>
                          {photosCount > 0 && (
                            <div className="flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              <span>{photosCount} poze</span>
                            </div>
                          )}
                          {job.address_county && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{job.address_county}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Today's Schedule */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Programul de Azi</h3>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                    {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'short' })}
                  </span>
                </div>

                {todayItems === null ? (
                  <div className="flex-1 flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  </div>
                ) : todayItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-6">
                    <CalendarClock className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm font-medium text-gray-500">Niciun job programat azi</p>
                    <p className="text-xs text-gray-400 mt-1">Job-urile acceptate cu data de azi vor apărea aici</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 overflow-y-auto">
                    {todayItems.map((item) => {
                      const isInProgress = item.status === 'in_progress'
                      const isStarting   = startingJobId === item.id
                      const isTask       = item._type === 'task'
                      const statusCfg    = isInProgress
                        ? { label: 'În Progres', cls: 'bg-purple-100 text-purple-700' }
                        : item.status === 'accepted'
                        ? { label: 'Acceptat', cls: 'bg-yellow-100 text-yellow-700' }
                        : { label: 'Asignat', cls: 'bg-blue-100 text-blue-700' }

                      return (
                        <div key={item.id} className="p-4 hover:bg-gray-50 transition">
                          <div className="flex items-start gap-3">
                            {/* Time column */}
                            <div className="flex-shrink-0 text-center w-14">
                              <p className="text-sm font-black text-gray-800">{item.time !== '—' ? item.time.slice(0, 5) : '—'}</p>
                              <Clock className="w-3 h-3 text-gray-300 mx-auto mt-0.5" />
                            </div>

                            {/* Border */}
                            <div className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${isInProgress ? 'bg-purple-400' : 'bg-gray-200'}`} />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-bold text-gray-800 text-sm truncate">{item.title}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${statusCfg.cls}`}>
                                  {statusCfg.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isTask ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                  {isTask ? 'Task' : 'Rezervare'}
                                </span>
                                <span>{item.client}</span>
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-2">
                                {!isInProgress && (
                                  <button
                                    onClick={() => handleStartJob(item)}
                                    disabled={isStarting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition disabled:opacity-60"
                                  >
                                    {isStarting
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <Play className="w-3 h-3 fill-white" />
                                    }
                                    Începe job
                                  </button>
                                )}
                                {isInProgress && (
                                  <span className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold">
                                    <CheckCircle2 className="w-3 h-3" /> În desfășurare
                                  </span>
                                )}
                                <button
                                  onClick={() => isTask ? setSelectedTaskId(item.id) : null}
                                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 transition"
                                >
                                  <CalendarClock className="w-3 h-3" />
                                  Reprogramează
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
               </div>
            </div>

            {/* Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800">Performanță Lunară</h4>
                  <Target className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Rată finalizare</span>
                    <span className="text-sm font-bold text-gray-800">98%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '98%' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Timp răspuns</span>
                    <span className="text-sm font-bold text-gray-800">&lt; 1 oră</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800">Creștere Câștiguri</h4>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Luna aceasta</span><span className="font-bold">5.000 RON</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Luna trecută</span><span className="font-bold">4.200 RON</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Creștere</span><span className="font-bold text-green-600">+5.8%</span></div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800">Satisfacție Clienți</h4>
                  <Award className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Rating mediu</span><span className="font-bold">4.9/5.0</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total recenzii</span><span className="font-bold">127</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Clienți recurenți</span><span className="font-bold text-blue-600">68%</span></div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Charts Section - shown in both tabs */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="font-bold text-gray-800">Venituri și Job-uri Lunare</h4>
                <p className="text-xs text-gray-500 mt-1">Urmărește veniturile și progresul finalizărilor</p>
              </div>
              <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">Ultimele 7 luni</span>
            </div>
            <div className="flex items-end gap-2 h-48">
              {monthlyData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center gap-1 flex-1 justify-end">
                    <div
                      className="w-full bg-blue-500 rounded-t-md min-h-[4px] transition-all"
                      style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{d.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                <span>Venituri (RON)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-200 rounded-sm" />
                <span>Job-uri Finalizate</span>
              </div>
            </div>
          </div>

          {/* Service Breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="font-bold text-gray-800">Distribuție Servicii</h4>
                <p className="text-xs text-gray-500 mt-1">Urmărește veniturile pe tip de serviciu</p>
              </div>
              <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">Tot timpul</span>
            </div>
            <div className="flex items-center gap-8">
              {/* Donut Chart Simplified */}
              <div className="relative w-40 h-40 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-40 h-40 -rotate-90">
                  {serviceBreakdown.reduce((acc, item, i) => {
                    const offset = acc.offset
                    acc.elements.push(
                      <circle
                        key={i}
                        r="15.9"
                        cx="18"
                        cy="18"
                        fill="transparent"
                        stroke={i === 0 ? '#3b82f6' : i === 1 ? '#22c55e' : i === 2 ? '#eab308' : '#a855f7'}
                        strokeWidth="3.5"
                        strokeDasharray={`${item.percentage} ${100 - item.percentage}`}
                        strokeDashoffset={-offset}
                      />
                    )
                    acc.offset += item.percentage
                    return acc
                  }, { elements: [], offset: 0 }).elements}
                </svg>
              </div>
              <div className="flex-1 space-y-3">
                {serviceBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-800">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Weekly Bookings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="font-bold text-gray-800">Tipar Rezervări Săptămânale</h4>
                <p className="text-xs text-gray-500 mt-1">Distribuția zilnică a rezervărilor din această săptămână</p>
              </div>
              <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">Această săpt.</span>
            </div>
            <div className="flex items-end gap-3 h-40">
              {weeklyBookings.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">{d.count}</span>
                  <div
                    className="w-full bg-purple-500 rounded-t-md min-h-[4px] transition-all"
                    style={{ height: `${(d.count / maxWeekly) * 100}%` }}
                  />
                  <span className="text-xs text-gray-400">{d.day}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">Total: {weeklyBookings.reduce((a, b) => a + b.count, 0)} rezervări săptămâna aceasta</p>
          </div>

          {/* Rating Distribution */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="font-bold text-gray-800">Distribuție Rating Clienți</h4>
                <p className="text-xs text-gray-500 mt-1">Defalcarea tuturor ratingurilor primite</p>
              </div>
              <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">Tot timpul (100 recenzii)</span>
            </div>
            <div className="space-y-3">
              {ratingDistribution.map((item) => (
                <div key={item.stars} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-12">{item.stars} stele</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-6 rounded-full transition-all flex items-center justify-end pr-2
                        ${item.stars >= 4 ? 'bg-yellow-400' : item.stars === 3 ? 'bg-yellow-300' : 'bg-gray-300'}
                      `}
                      style={{ width: `${item.percentage}%` }}
                    >
                      {item.percentage > 10 && (
                        <span className="text-xs font-bold text-gray-800">{item.percentage}%</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">Rating Mediu: 4.9/5.0 ⭐ | 85% sunt recenzii de 5 stele</p>
          </div>
        </div>
      </div>
      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onNegotiate={() => setSelectedTaskId(null)}
      />

      {/* Job Request Modal */}
        {selectedJob && (
          <JobRequestModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onAccept={(job, schedule) => {
              console.log('Accepted:', job.title, schedule)
              setSelectedJob(null)
            }}
            onDecline={(job) => {
              console.log('Declined:', job.title)
            }}
          />
        )}
    </div>
  )
}