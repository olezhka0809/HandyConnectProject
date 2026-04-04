import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import HandymanNavbar from '../components/handyman-dashboard/HandymanNavbar'
import JobRequestModal from '../components/handyman-dashboard/JobRequestModal'
import TaskDetailModal from '../components/handyman-dashboard/TaskDetailModal'
import {
  MessageCircle,
  MapPin,
  Camera,
  Briefcase,
  Star,
  TrendingUp,
  Eye,
  DollarSign,
  Calendar,
  Award,
  Clock,
  Play,
  CalendarClock,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

function fmtDate(dateStr, timeStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const label = d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
    return timeStr ? `${label} · ${timeStr}` : label
  } catch {
    return dateStr
  }
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getPeriodStart(range) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (range === '7d') {
    start.setDate(start.getDate() - 6)
    return start
  }
  if (range === '30d') {
    start.setDate(start.getDate() - 29)
    return start
  }
  if (range === '28d') {
    start.setDate(start.getDate() - 27)
    return start
  }

  start.setDate(1)
  start.setMonth(start.getMonth() - 2)
  return start
}

function buildRevenueSeries(entries, range) {
  if (!entries.length) return []
  const now = new Date()
  const roWeekday = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']

  if (range === '3m') {
    const monthStarts = [2, 1, 0].map((offset) => new Date(now.getFullYear(), now.getMonth() - offset, 1))
    return monthStarts.map((monthDate) => {
      const key = getMonthKey(monthDate)
      const monthEntries = entries.filter((e) => getMonthKey(e.date) === key)
      return {
        label: monthDate.toLocaleDateString('ro-RO', { month: 'short' }),
        revenue: monthEntries.reduce((s, e) => s + e.amount, 0),
        jobs: monthEntries.length,
      }
    })
  }

  const days = range === '30d' ? 30 : 7
  const buckets = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const dayEntries = entries.filter((e) => e.date.toISOString().slice(0, 10) === key)
    buckets.push({
      label: range === '30d'
        ? d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })
        : roWeekday[d.getDay()],
      revenue: dayEntries.reduce((s, e) => s + e.amount, 0),
      jobs: dayEntries.length,
    })
  }
  return buckets
}

function buildServiceBreakdown(entries, range) {
  const start = getPeriodStart(range)
  const filtered = entries.filter((e) => e.date >= start)
  const totals = filtered.reduce((acc, e) => {
    const key = e.domain || 'Altele'
    acc[key] = (acc[key] ?? 0) + e.amount
    return acc
  }, {})

  const sum = Object.values(totals).reduce((s, v) => s + v, 0)
  if (!sum) return []

  return Object.entries(totals)
    .map(([name, revenue]) => ({
      name,
      revenue,
      percentage: Math.round((revenue / sum) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
}

function buildGrowth(completedEntries) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const prevDate = new Date(currentYear, currentMonth - 1, 1)
  const prevMonth = prevDate.getMonth()
  const prevYear = prevDate.getFullYear()

  const current = completedEntries
    .filter((e) => e.date.getMonth() === currentMonth && e.date.getFullYear() === currentYear)
    .reduce((s, e) => s + e.amount, 0)

  const previous = completedEntries
    .filter((e) => e.date.getMonth() === prevMonth && e.date.getFullYear() === prevYear)
    .reduce((s, e) => s + e.amount, 0)

  const pct = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0)
  return { current, previous, pct }
}

export default function HandymanDashboard() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('overview')
  const [reloadKey, setReloadKey] = useState(0)

  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [chartMetric, setChartMetric] = useState('revenue')
  const [hoveredChartIdx, setHoveredChartIdx] = useState(null)
  const [earningsRange, setEarningsRange] = useState('7d')
  const [serviceRange, setServiceRange] = useState('3m')

  const [recentJobs, setRecentJobs] = useState(null)
  const [todayItems, setTodayItems] = useState(null)
  const [startingJobId, setStartingJobId] = useState(null)

  const [insightRange, setInsightRange] = useState('3m')
  const [stats, setStats] = useState({
    newRequests: null,
    activeJobs: null,
    monthlyEarnings: null,
    previousMonth: null,
    ratingAvg: null,
    totalReviews: null,
  })

  const [insights, setInsights] = useState({
    completedEntries: [],
    growth: { current: 0, previous: 0, pct: 0 },
    satisfaction: {
      avgRating: 0,
      totalReviews: 0,
      reviewCoverage: 0,
      reviewedClients: 0,
      completedClients: 0,
    },
    ratingTop: [],
  })

  const normaliseBookingForModal = (booking) => {
    const statusMap = {
      pending: 'new',
      accepted: 'accepted',
      confirmed: 'accepted',
      upcoming: 'accepted',
      in_progress: 'in_progress',
      delayed: 'delayed',
      completed: 'completed',
      cancelled: 'cancelled',
    }

    return {
      _type: 'booking',
      _id: booking.id,
      _raw: booking,
      title: booking.handyman_services?.title ?? `Rezervare #${booking.id.slice(0, 6)}`,
      client: booking.contact_name || 'Client',
      clientId: booking.client_id,
      description: booking.handyman_notes ?? '',
      date: fmtDate(booking.scheduled_date, booking.scheduled_time),
      photos: [],
      address: booking.service_address ?? '',
      price: booking.total ? `${Number(booking.total).toLocaleString('ro-RO')} RON` : '—',
      urgency: booking.urgency ?? 'normal',
      approximateDuration: booking.handyman_services?.estimated_duration ?? null,
      uiStatus: statusMap[booking.status] ?? 'new',
    }
  }

  const openBookingDetails = async (bookingId) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, handyman_services(title, estimated_duration)')
      .eq('id', bookingId)
      .maybeSingle()

    if (error || !data) {
      console.error('Nu am putut încărca rezervarea:', error)
      return
    }

    setSelectedJob(normaliseBookingForModal(data))
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const [profileRes, hpRes, newRequestsRes, activeRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('handyman_profiles').select('rating_avg').eq('user_id', user.id).maybeSingle(),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).contains('proposed_to', [user.id]).eq('status', 'open'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('handyman_id', user.id).in('status', ['in_progress', 'accepted', 'assigned']),
      ])

      setProfile(profileRes.data)

      const [completedTasksRes, completedBookingsRes, reviewsRes] = await Promise.all([
        supabase.from('tasks')
          .select('id, title, budget, final_price, client_id, completed_at, updated_at, created_at, service_address, address_city, categories(name), profiles!tasks_client_id_fkey(first_name, last_name)')
          .eq('handyman_id', user.id)
          .eq('status', 'completed'),
        supabase.from('bookings')
          .select('id, total, subtotal, service_fee, client_id, contact_name, service_address, completed_at, updated_at, created_at, handyman_services(title, categories(name))')
          .eq('handyman_id', user.id)
          .eq('status', 'completed'),
        supabase.from('reviews')
          .select('rating, reviewer_id')
          .eq('reviewed_id', user.id)
          .eq('review_type', 'for_handyman'),
      ])

      const taskEntries = (completedTasksRes.data ?? []).map((t) => ({
        id: t.id,
        type: 'task',
        typeLabel: 'Task',
        title: t.title ?? t.categories?.name ?? 'Task finalizat',
        amount: Number(t.final_price ?? t.budget) || 0,
        date: new Date(t.completed_at ?? t.updated_at ?? t.created_at),
        domain: t.categories?.name ?? 'Taskuri diverse',
        clientName: `${t.profiles?.first_name ?? ''} ${t.profiles?.last_name ?? ''}`.trim() || 'Client',
        address: [t.service_address, t.address_city].filter(Boolean).join(', ') || '—',
        clientId: t.client_id ?? null,
      }))

      const bookingEntries = (completedBookingsRes.data ?? []).map((b) => ({
        id: b.id,
        type: 'booking',
        typeLabel: 'Rezervare',
        title: b.handyman_services?.title ?? 'Rezervare finalizată',
        amount: Number(b.total ?? ((Number(b.subtotal) || 0) + (Number(b.service_fee) || 0))) || 0,
        date: new Date(b.completed_at ?? b.updated_at ?? b.created_at),
        domain: b.handyman_services?.categories?.name ?? b.handyman_services?.title ?? 'Rezervări',
        clientName: b.contact_name ?? 'Client',
        address: b.service_address ?? '—',
        clientId: b.client_id ?? null,
      }))

      const completedEntries = [...taskEntries, ...bookingEntries].filter((e) => !Number.isNaN(e.date.getTime()))
      const growth = buildGrowth(completedEntries)

      const ratings = (reviewsRes.data ?? [])
        .map((r) => Number(r.rating))
        .filter((r) => Number.isFinite(r) && r >= 1 && r <= 5)

      const totalReviews = ratings.length
      const avgRating = totalReviews ? ratings.reduce((s, r) => s + r, 0) / totalReviews : 0
      const ratingTop = [5, 4, 3, 2, 1]
        .map((stars) => ({ stars, count: ratings.filter((r) => r === stars).length }))
        .sort((a, b) => b.count - a.count)

      const completedClients = new Set(completedEntries.map((e) => e.clientId).filter(Boolean)).size
      const reviewedClients = new Set((reviewsRes.data ?? []).map((r) => r.reviewer_id).filter(Boolean)).size
      const reviewCoverage = completedClients > 0 ? (reviewedClients / completedClients) * 100 : 0

      setStats({
        newRequests: newRequestsRes.count ?? 0,
        activeJobs: activeRes.count ?? 0,
        monthlyEarnings: growth.current,
        previousMonth: growth.previous,
        ratingAvg: hpRes.data?.rating_avg ?? avgRating,
        totalReviews,
      })

      setInsights({
        completedEntries,
        growth,
        satisfaction: {
          avgRating,
          totalReviews,
          reviewCoverage,
          reviewedClients,
          completedClients,
        },
        ratingTop,
      })

      const [proposedRes, activeJobsRes, bookingsRes] = await Promise.all([
        supabase.from('tasks')
          .select('id, title, urgency, budget, scheduled_date, scheduled_time, address_city, photos, status, created_at, profiles!tasks_client_id_fkey(first_name, last_name)')
          .contains('proposed_to', [user.id])
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(4),

        supabase.from('tasks')
          .select('id, title, urgency, budget, scheduled_date, scheduled_time, address_city, photos, status, created_at, profiles!tasks_client_id_fkey(first_name, last_name)')
          .eq('handyman_id', user.id)
          .in('status', ['in_progress', 'accepted', 'assigned'])
          .order('created_at', { ascending: false })
          .limit(4),

        supabase.from('bookings')
          .select('id, client_id, contact_name, scheduled_date, scheduled_time, service_address, status, total, created_at, handyman_notes, handyman_services(title, estimated_duration)')
          .eq('handyman_id', user.id)
          .in('status', ['upcoming', 'confirmed', 'accepted', 'pending'])
          .order('created_at', { ascending: false })
          .limit(3),
      ])

      const proposed = (proposedRes.data ?? []).map((t) => ({ ...t, _type: 'task', _isNew: true, urgency_level: t.urgency, address_county: t.address_city }))
      const activeJobs = (activeJobsRes.data ?? []).map((t) => ({ ...t, _type: 'task', _isNew: false, urgency_level: t.urgency, address_county: t.address_city }))
      const bookings = (bookingsRes.data ?? []).map((b) => ({
        ...b,
        _type: 'booking',
        _isNew: false,
        title: b.handyman_services?.title ?? `Rezervare #${b.id.slice(0, 6)}`,
        urgency_level: 'normal',
        budget: b.total,
        address_county: b.service_address,
        profiles: { first_name: b.contact_name ?? 'Client', last_name: '' },
      }))

      const combined = [...proposed, ...activeJobs, ...bookings]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6)

      setRecentJobs(combined)

      const todayISO = new Date().toISOString().split('T')[0]
      const [todayTasksRes, todayBookingsRes] = await Promise.all([
        supabase.from('tasks')
          .select('id, title, scheduled_time, status, profiles!tasks_client_id_fkey(first_name, last_name)')
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

      const todayTasks = (todayTasksRes.data ?? []).map((t) => ({
        id: t.id,
        _type: 'task',
        title: t.title,
        time: t.scheduled_time ?? '—',
        status: t.status,
        client: t.profiles ? `${t.profiles.first_name ?? ''} ${t.profiles.last_name ?? ''}`.trim() || 'Client' : 'Client',
      }))

      const todayBookings = (todayBookingsRes.data ?? []).map((b) => ({
        id: b.id,
        _type: 'booking',
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
  }, [navigate, reloadKey])

  const handleStartJob = async (item) => {
    setStartingJobId(item.id)
    const table = item._type === 'booking' ? 'bookings' : 'tasks'
    await supabase.from(table).update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', item.id)
    setTodayItems((prev) => (prev ?? []).map((i) => (i.id === item.id ? { ...i, status: 'in_progress' } : i)))
    setStartingJobId(null)
  }

  const chartData = buildRevenueSeries(insights.completedEntries, insightRange)
  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1)
  const maxJobs = Math.max(...chartData.map((d) => d.jobs), 1)
  const maxChartValue = chartMetric === 'revenue' ? maxRevenue : maxJobs
  const barColor = chartMetric === 'revenue' ? 'bg-blue-500' : 'bg-emerald-500'
  const chartMetricLabel = chartMetric === 'revenue' ? 'Venituri' : 'Joburi finalizate'
  const chartValues = chartData.map((d) => ({
    label: d.label,
    value: chartMetric === 'revenue' ? d.revenue : d.jobs,
    revenue: d.revenue,
    jobs: d.jobs,
  }))
  const chartWidth = Math.max(insightRange === '30d' ? 1120 : 760, chartValues.length * (insightRange === '30d' ? 36 : 130))
  const chartHeight = 320
  const chartPadding = { top: 30, right: 24, bottom: 46, left: 60 }
  const chartUsableWidth = chartWidth - chartPadding.left - chartPadding.right
  const chartUsableHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const chartMaxValue = Math.max(...chartValues.map((v) => v.value), 1)
  const chartStep = chartValues.length > 1 ? chartUsableWidth / (chartValues.length - 1) : 0
  const chartSlot = chartValues.length > 0 ? chartUsableWidth / chartValues.length : chartUsableWidth
  const chartPoints = chartValues.map((v, i) => {
    const x = chartPadding.left + chartStep * i
    const y = chartPadding.top + chartUsableHeight - ((v.value / chartMaxValue) * chartUsableHeight)
    return { ...v, x, y }
  })
  const chartLinePath = chartPoints.length
    ? chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : ''
  const chartAreaPath = chartPoints.length
    ? `${chartLinePath} L ${chartPoints[chartPoints.length - 1].x} ${chartPadding.top + chartUsableHeight} L ${chartPoints[0].x} ${chartPadding.top + chartUsableHeight} Z`
    : ''
  const chartBars = chartValues.map((v, i) => {
    const height = (v.value / chartMaxValue) * chartUsableHeight
    const width = Math.min(insightRange === '30d' ? 22 : 40, chartSlot * 0.62)
    const x = chartPadding.left + chartSlot * i + (chartSlot - width) / 2
    const y = chartPadding.top + chartUsableHeight - height
    return { ...v, x, y, width, height }
  })
  const serviceBreakdown = buildServiceBreakdown(insights.completedEntries, serviceRange)
  const topRatingTotal = insights.ratingTop.reduce((s, r) => s + r.count, 0)
  const earningsRows = [...insights.completedEntries]
    .filter((entry) => entry.date >= getPeriodStart(earningsRange))
    .sort((a, b) => b.date - a.date)
  const earningsTotal = earningsRows.reduce((sum, entry) => sum + entry.amount, 0)

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HandymanNavbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Bine ai revenit{profile.first_name ? `, ${profile.first_name}` : ''}! 👋</h1>
            <p className="text-gray-500 mt-1">Iată prezentarea generală a afacerii și pipeline-ul de job-uri</p>
          </div>
          <Link to="/handyman/jobs" className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition">
            <Eye className="w-4 h-4" />
            Vezi Job-uri
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Cereri Noi',
              value: stats.newRequests === null ? '—' : String(stats.newRequests),
              change: stats.newRequests === null ? 'Se încarcă…' : stats.newRequests === 0 ? 'Nicio cerere nouă' : `${stats.newRequests} task${stats.newRequests !== 1 ? '-uri' : ''} propuse ție`,
              changeColor: stats.newRequests > 0 ? 'text-green-600' : 'text-gray-400',
              icon: MessageCircle,
              color: 'bg-blue-100 text-blue-600',
            },
            {
              label: 'Job-uri Active',
              value: stats.activeJobs === null ? '—' : String(stats.activeJobs),
              change: stats.activeJobs === null ? 'Se încarcă…' : stats.activeJobs === 0 ? 'Niciun job activ' : `${stats.activeJobs} în desfășurare`,
              changeColor: 'text-gray-500',
              icon: Briefcase,
              color: 'bg-green-100 text-green-600',
            },
            {
              label: 'Venit luna curentă',
              value: stats.monthlyEarnings === null ? '—' : `${stats.monthlyEarnings.toLocaleString('ro-RO')} RON`,
              change: stats.previousMonth === null ? 'Se încarcă…' : `Luna trecută: ${stats.previousMonth.toLocaleString('ro-RO')} RON`,
              changeColor: 'text-gray-500',
              icon: DollarSign,
              color: 'bg-purple-100 text-purple-600',
            },
            {
              label: 'Rating Mediu',
              value: stats.ratingAvg === null ? '—' : Number(stats.ratingAvg).toFixed(1),
              change: stats.totalReviews === null ? 'Se încarcă…' : `${stats.totalReviews} recenzii`,
              changeColor: 'text-gray-500',
              icon: Star,
              color: 'bg-yellow-100 text-yellow-600',
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

        <div className="flex gap-2 mb-6">
          {['overview', 'earnings'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {t === 'overview' ? 'Prezentare generală' : 'Câștiguri'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid lg:grid-cols-5 gap-6 mb-6">
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
                  <div className="p-8 text-center text-sm text-gray-400">Nicio cerere sau job activ momentan.</div>
                ) : (
                  recentJobs.map((job) => {
                    const clientName = job.profiles
                      ? `${job.profiles.first_name ?? ''} ${job.profiles.last_name ?? ''}`.trim() || 'Client'
                      : 'Client'
                    const urgency = job.urgency_level ?? 'normal'
                    const urgencyLabel = urgency === 'high' ? 'Urgent' : urgency === 'medium' ? 'Mediu' : 'Normal'
                    const urgencyCls = urgency === 'high' ? 'bg-red-100 text-red-700' : urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    const statusLabel = job._isNew ? 'Cerere nouă' : job._type === 'booking' ? 'Rezervare' : job.status === 'in_progress' ? 'În progres' : 'Acceptat'
                    const statusCls = job._isNew ? 'bg-blue-100 text-blue-700' : job.status === 'in_progress' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    const dateStr = job.scheduled_date
                      ? new Date(job.scheduled_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) + (job.scheduled_time ? ` · ${job.scheduled_time}` : '')
                      : '—'
                    const photosCount = Array.isArray(job.photos) ? job.photos.length : 0
                    const isTask = job._type === 'task'

                    return (
                      <div key={job.id} className="p-5 transition cursor-pointer hover:bg-blue-50" onClick={() => (isTask ? setSelectedTaskId(job.id) : openBookingDetails(job.id))}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-800 text-sm truncate">{job.title}</h4>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 border ${isTask ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
                                <Briefcase className="w-2.5 h-2.5" />
                                {isTask ? 'Task' : 'Rezervare'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${urgencyCls}`}>{urgencyLabel}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusCls}`}>{statusLabel}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">{clientName}</p>
                          </div>
                          {job.budget && <span className="font-bold text-blue-600 text-sm ml-3 flex-shrink-0">{job.budget} RON</span>}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span>{dateStr}</span></div>
                          {photosCount > 0 && <div className="flex items-center gap-1"><Camera className="w-3 h-3" /><span>{photosCount} poze</span></div>}
                          {job.address_county && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span>{job.address_county}</span></div>}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Programul de Azi</h3>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'short' })}</span>
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
                    const isStarting = startingJobId === item.id
                    const isTask = item._type === 'task'
                    const statusCfg = isInProgress
                      ? { label: 'În Progres', cls: 'bg-purple-100 text-purple-700' }
                      : item.status === 'accepted'
                      ? { label: 'Acceptat', cls: 'bg-yellow-100 text-yellow-700' }
                      : { label: 'Asignat', cls: 'bg-blue-100 text-blue-700' }

                    return (
                      <div key={item.id} className="p-4 hover:bg-gray-50 transition">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 text-center w-14">
                            <p className="text-sm font-black text-gray-800">{item.time !== '—' ? item.time.slice(0, 5) : '—'}</p>
                            <Clock className="w-3 h-3 text-gray-300 mx-auto mt-0.5" />
                          </div>

                          <div className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${isInProgress ? 'bg-purple-400' : 'bg-gray-200'}`} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-gray-800 text-sm truncate">{item.title}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${statusCfg.cls}`}>{statusCfg.label}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isTask ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                {isTask ? 'Task' : 'Rezervare'}
                              </span>
                              <span>{item.client}</span>
                            </div>

                            <div className="flex gap-2">
                              {!isInProgress && (
                                <button
                                  onClick={() => handleStartJob(item)}
                                  disabled={isStarting}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition disabled:opacity-60"
                                >
                                  {isStarting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
                                  Începe job
                                </button>
                              )}
                              {isInProgress && (
                                <span className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold">
                                  <CheckCircle2 className="w-3 h-3" /> În desfășurare
                                </span>
                              )}
                              <button
                                onClick={() => (isTask ? setSelectedTaskId(item.id) : openBookingDetails(item.id))}
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
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800">Creștere Câștiguri</h4>
              <TrendingUp className={`w-5 h-5 ${insights.growth.pct >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Luna aceasta</span><span className="font-bold">{insights.growth.current.toLocaleString('ro-RO')} RON</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Luna trecută</span><span className="font-bold">{insights.growth.previous.toLocaleString('ro-RO')} RON</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">Variație</span>
                <span className={`font-bold ${insights.growth.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {insights.growth.pct >= 0 ? '+' : ''}{insights.growth.pct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800">Satisfacție Clienți</h4>
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Rating mediu</span><span className="font-bold">{insights.satisfaction.avgRating ? `${insights.satisfaction.avgRating.toFixed(1)}/5.0` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total recenzii</span><span className="font-bold">{insights.satisfaction.totalReviews}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Clienți care au lăsat rating</span><span className="font-bold text-blue-600">{insights.satisfaction.reviewCoverage.toFixed(1)}%</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-6 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-col gap-3 mb-6">
              <div>
                <h4 className="font-bold text-gray-800 text-lg">{chartMetricLabel}</h4>
                <p className="text-xs text-gray-500 mt-1">Finalizate: task-uri + rezervări</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                  {[
                    { id: 'revenue', label: 'Venituri' },
                    { id: 'jobs', label: 'Joburi finalizate' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setChartMetric(opt.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium ${chartMetric === opt.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                  {[
                    { id: '3m', label: '3 luni' },
                    { id: '30d', label: '30 zile' },
                    { id: '7d', label: '7 zile' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setInsightRange(opt.id)}
                      className={`px-2 py-1 rounded-md text-xs font-medium ${insightRange === opt.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {chartData.length === 0 ? (
              <p className="text-sm text-gray-400">Nu există date suficiente pentru perioada selectată.</p>
            ) : (
                <div className="overflow-x-auto pb-2">
                <div className="min-w-[760px]">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const ratio = i / 4
                      const y = chartPadding.top + chartUsableHeight - ratio * chartUsableHeight
                      const tickValue = chartMaxValue * ratio
                      return (
                        <g key={i}>
                          <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                          <text x={chartPadding.left - 10} y={y + 4} textAnchor="end" className="fill-gray-400" fontSize="11">
                            {chartMetric === 'revenue' ? `${Math.round(tickValue).toLocaleString('ro-RO')}` : Math.round(tickValue)}
                          </text>
                        </g>
                      )
                    })}

                    {chartMetric === 'revenue' ? (
                      <>
                        <defs>
                          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.36" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.06" />
                          </linearGradient>
                        </defs>
                        {chartPoints.length > 1 && <path d={chartAreaPath} fill="url(#revenueFill)" />}
                        <path d={chartLinePath} fill="none" stroke="#1d4ed8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                        {hoveredChartIdx !== null && chartPoints[hoveredChartIdx] && (
                          <line
                            x1={chartPoints[hoveredChartIdx].x}
                            x2={chartPoints[hoveredChartIdx].x}
                            y1={chartPadding.top}
                            y2={chartPadding.top + chartUsableHeight}
                            stroke="#93c5fd"
                            strokeDasharray="4 4"
                          />
                        )}
                        {chartPoints.map((p, idx) => {
                          const tooltipW = 84
                          const tooltipX = Math.max(
                            chartPadding.left,
                            Math.min(p.x - tooltipW / 2, chartWidth - chartPadding.right - tooltipW),
                          )
                          return (
                          <g key={`${p.label}-${p.x}`}>
                            <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#1d4ed8" strokeWidth="3" />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="12"
                              fill="transparent"
                              onMouseEnter={() => setHoveredChartIdx(idx)}
                              onMouseLeave={() => setHoveredChartIdx(null)}
                            />
                            {hoveredChartIdx === idx && p.value > 0 && (
                              <>
                                <rect
                                  x={tooltipX}
                                  y={p.y - 33}
                                  width={tooltipW}
                                  height="18"
                                  rx="5"
                                  fill="#eff6ff"
                                  stroke="#bfdbfe"
                                />
                                <text x={tooltipX + tooltipW / 2} y={p.y - 20} textAnchor="middle" className="fill-blue-800" fontSize="10" fontWeight="700">
                                  {`${Math.round(p.value).toLocaleString('ro-RO')} RON`}
                                </text>
                              </>
                            )}
                            <text x={p.x} y={chartHeight - 12} textAnchor="middle" className="fill-gray-400" fontSize="10">
                              {p.label}
                            </text>
                          </g>
                        )})}
                      </>
                    ) : (
                      <>
                        {chartBars.map((bar, idx) => {
                          const isHovered = hoveredChartIdx === idx
                          const barFill = isHovered ? '#14b8a6' : '#e5e7eb'
                          const tooltipW = 36
                          const tooltipX = Math.max(
                            chartPadding.left,
                            Math.min(bar.x + (bar.width / 2) - (tooltipW / 2), chartWidth - chartPadding.right - tooltipW),
                          )
                          return (
                            <g key={`${bar.label}-${idx}`} onMouseEnter={() => setHoveredChartIdx(idx)} onMouseLeave={() => setHoveredChartIdx(null)}>
                              <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="8" fill={barFill} />
                              {isHovered && bar.value > 0 && (
                                <>
                                  <rect
                                    x={tooltipX}
                                    y={bar.y - 24}
                                    width={tooltipW}
                                    height="16"
                                    rx="4"
                                    fill="#ccfbf1"
                                    stroke="#5eead4"
                                  />
                                  <text
                                    x={tooltipX + tooltipW / 2}
                                    y={bar.y - 13}
                                    textAnchor="middle"
                                    className="fill-teal-700"
                                    fontSize="10"
                                    fontWeight="700"
                                  >
                                    {bar.value}
                                  </text>
                                </>
                              )}
                              <text x={bar.x + bar.width / 2} y={chartHeight - 12} textAnchor="middle" className="fill-gray-400" fontSize="10">
                                {bar.label}
                              </text>
                            </g>
                          )
                        })}
                      </>
                    )}
                  </svg>
                </div>
                <div className="flex items-center gap-6 mt-4 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${chartMetric === 'revenue' ? 'bg-blue-500' : 'bg-teal-500'}`} />
                    <span>{chartMetric === 'revenue' ? 'Venituri (RON)' : 'Joburi finalizate'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {tab === 'earnings' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex flex-col gap-3 mb-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">Ultimele câștiguri</h4>
                    <p className="text-xs text-gray-500 mt-1">Job-uri finalizate în perioada selectată</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    Total: {earningsTotal.toLocaleString('ro-RO')} RON
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 w-fit">
                  {[
                    { id: '7d', label: 'Ultimele 7 zile' },
                    { id: '28d', label: 'Ultimele 28 de zile' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setEarningsRange(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${earningsRange === opt.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">Task</span>
                  <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-600 font-medium">Rezervare</span>
                </div>
              </div>

              {earningsRows.length === 0 ? (
                <p className="text-sm text-gray-400">Nu există câștiguri în perioada selectată.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="min-w-[1100px] w-full text-left">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-16">Sl No</th>
                        <th className="px-4 py-3 font-semibold">Tip</th>
                        <th className="px-4 py-3 font-semibold">Nume și prenume</th>
                        <th className="px-4 py-3 font-semibold">Anunț / Job</th>
                        <th className="px-4 py-3 font-semibold">Adresă</th>
                        <th className="px-4 py-3 font-semibold">Data</th>
                        <th className="px-4 py-3 font-semibold text-right">Sumă achitată</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {earningsRows.map((row, index) => (
                        <tr key={`${row.type}-${row.id}-${index}`} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-700">{String(index + 1).padStart(2, '0')}.</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${row.type === 'task' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                              <Briefcase className="w-3 h-3" />
                              {row.typeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.clientName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[300px] truncate">{row.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[360px] truncate">{row.address}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(row.date.toISOString())}</td>
                          <td className="px-4 py-3 text-sm font-bold text-right text-gray-800 whitespace-nowrap">{row.amount.toLocaleString('ro-RO')} RON</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-100">
                      <tr>
                        <td colSpan="6" className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-green-600 whitespace-nowrap">{earningsTotal.toLocaleString('ro-RO')} RON</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="font-bold text-gray-800">Distribuție Servicii</h4>
                  <p className="text-xs text-gray-500 mt-1">Procent din profit pe domenii</p>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                  {[
                    { id: '7d', label: '7 zile' },
                    { id: '28d', label: '28 zile' },
                    { id: '3m', label: '3 luni' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setServiceRange(opt.id)}
                      className={`px-2 py-1 rounded-md text-xs font-medium ${serviceRange === opt.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {serviceBreakdown.length === 0 && <p className="text-sm text-gray-400">Nu există suficiente date în perioada selectată.</p>}
                {serviceBreakdown.map((item, idx) => (
                  <div key={`${item.name}-${idx}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium truncate pr-3">{item.name}</span>
                      <span className="text-gray-800 font-bold">{item.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${item.percentage}%` }} />
                    </div>
                    <p className="text-xs text-gray-400">{item.revenue.toLocaleString('ro-RO')} RON</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="font-bold text-gray-800">Distribuție Rating Clienți</h4>
                  <p className="text-xs text-gray-500 mt-1">Top rating-uri după frecvență</p>
                </div>
                <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">Total {insights.satisfaction.totalReviews} recenzii</span>
              </div>
              <div className="space-y-3">
                {insights.ratingTop.map((item) => (
                  <div key={item.stars} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-12">{item.stars} stele</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-6 rounded-full transition-all flex items-center justify-end pr-2 ${item.stars >= 4 ? 'bg-yellow-400' : item.stars === 3 ? 'bg-yellow-300' : 'bg-gray-300'}`}
                        style={{ width: `${topRatingTotal > 0 ? (item.count / topRatingTotal) * 100 : 0}%` }}
                      >
                        {topRatingTotal > 0 && (item.count / topRatingTotal) * 100 > 10 && (
                          <span className="text-xs font-bold text-gray-800">{Math.round((item.count / topRatingTotal) * 100)}%</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{item.count}</span>
                  </div>
                ))}
                {insights.ratingTop.length === 0 && <p className="text-sm text-gray-400">Nu există recenzii încă.</p>}
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">Rating mediu: {insights.satisfaction.avgRating ? insights.satisfaction.avgRating.toFixed(1) : '—'}/5.0</p>
            </div>
          </div>
        </div>
      </div>

      <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onNegotiate={() => setSelectedTaskId(null)} />

      {selectedJob && (
        <JobRequestModal
          job={selectedJob}
          initialMode="details"
          userId={profile?.id}
          onClose={() => setSelectedJob(null)}
          onUpdate={() => {
            setSelectedJob(null)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
