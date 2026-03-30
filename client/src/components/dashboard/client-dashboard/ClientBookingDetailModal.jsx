import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabase'
import {
  X, Calendar, Clock, MapPin, Phone, Mail, User,
  ChevronLeft, ChevronRight, CheckCircle, Loader2,
  AlertTriangle, Zap, Shield, Wrench, Star, CreditCard,
  Banknote, MessageSquare, AlertCircle, ExternalLink,
  CalendarClock, Send
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtRON(v) {
  if (!v) return '0,00 RON'
  return `${Number(v).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`
}

function StarRow({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}/>
      ))}
    </div>
  )
}

const STATUS_LABEL = {
  pending:    'În așteptare',
  confirmed:  'Confirmat',
  assigned:   'Alocat',
  in_progress:'În lucru',
  completed:  'Finalizat',
  cancelled:  'Anulat',
}
const STATUS_COLOR = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  assigned:   'bg-blue-100 text-blue-700',
  in_progress:'bg-purple-100 text-purple-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
}
function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function UrgencyBadge({ urgency }) {
  const map = {
    high:   { label: 'Urgent',    Icon: AlertTriangle, cls: 'bg-red-100 text-red-700 border-red-200' },
    medium: { label: 'Mediu',     Icon: Zap,           cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    normal: { label: 'Normal',    Icon: Clock,         cls: 'bg-green-100 text-green-700 border-green-200' },
    low:    { label: 'Fără grabă',Icon: Clock,         cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  }
  const cfg = map[urgency] ?? map.normal
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <Icon className="w-3 h-3"/>{cfg.label}
    </span>
  )
}

// ─── photo gallery ─────────────────────────────────────────────────────────────

function PhotoGallery({ photos }) {
  const [current, setCurrent] = useState(0)
  if (!photos?.length) return (
    <div className="h-52 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center rounded-xl">
      <Wrench className="w-12 h-12 text-blue-400"/>
    </div>
  )
  return (
    <div className="relative h-52 rounded-xl overflow-hidden bg-gray-100 group">
      <img src={photos[current]} alt="" className="w-full h-full object-cover"/>
      {photos.length > 1 && (
        <>
          <button onClick={() => setCurrent(i => Math.max(0, i-1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition opacity-0 group-hover:opacity-100">
            <ChevronLeft className="w-4 h-4"/>
          </button>
          <button onClick={() => setCurrent(i => Math.min(photos.length-1, i+1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition opacity-0 group-hover:opacity-100">
            <ChevronRight className="w-4 h-4"/>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition ${i === current ? 'bg-white' : 'bg-white/50'}`}/>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────

function getMinDate() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

export default function ClientBookingDetailModal({ bookingId, onClose, onUpdated }) {
  const navigate  = useNavigate()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // reschedule state
  const [showReschedForm, setShowReschedForm] = useState(false)
  const [reschedDate,     setReschedDate]     = useState('')
  const [reschedTime,     setReschedTime]     = useState('')
  const [reschedMsg,      setReschedMsg]      = useState('')
  const [reschedSaving,   setReschedSaving]   = useState(false)
  const [reschedDone,     setReschedDone]     = useState(false)
  const [reschedError,    setReschedError]    = useState(null)

  useEffect(() => {
    if (!bookingId) return
    setLoading(true)
    supabase
      .from('bookings')
      .select(`
        *,
        handyman:handyman_id(id, first_name, last_name, avatar_url),
        service:service_id(id, title, description, base_price, price_per_hour, estimated_duration, photos, categories(name)),
        handyman_profile:handyman_id(handyman_profiles(rating_avg, total_jobs_completed, has_insurance, is_verified, specialties))
      `)
      .eq('id', bookingId)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setBooking(data)
        setLoading(false)
      })
  }, [bookingId])

  const handleReschedule = async () => {
    if (!reschedDate || !reschedTime) { setReschedError('Selectează data și ora.'); return }
    setReschedSaving(true); setReschedError(null)
    try {
      await supabase.from('reschedule_requests').insert({
        job_id:       bookingId,
        job_type:     'booking',
        handyman_id:  booking.handyman_id,
        client_id:    booking.client_id,
        proposed_date: reschedDate,
        proposed_time: reschedTime,
        message:      reschedMsg || null,
        status:       'pending_handyman',
        created_at:   new Date().toISOString(),
      })
      if (booking.handyman_id) {
        await supabase.from('notifications').insert({
          user_id: booking.handyman_id,
          type: 'new_offer',
          title: 'Cerere de reprogramare',
          body: `Clientul propune reprogramarea „${booking.service?.title ?? 'rezervarea'}" pe ${reschedDate} la ${reschedTime}.`,
          data: { booking_id: bookingId, redirect: '/handyman/jobs' },
        })
      }
      setReschedDone(true)
      setShowReschedForm(false)
      onUpdated?.()
    } catch(e) {
      setReschedError('Eroare: ' + (e.message ?? ''))
    } finally {
      setReschedSaving(false)
    }
  }

  if (!bookingId) return null

  const slugify = (f, l) =>
    `${f}-${l}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')

  const handymanName = booking?.handyman
    ? `${booking.handyman.first_name ?? ''} ${booking.handyman.last_name ?? ''}`.trim()
    : '—'
  const handymanInitials = handymanName.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()
  const hp = booking?.handyman_profile?.handyman_profiles?.[0] ?? null
  const photos = booking?.service?.photos ?? []

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh]"
        onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-base leading-tight">
              {booking?.service?.title ?? 'Rezervare'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              #{bookingId.slice(0,8).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center ml-3 flex-shrink-0">
            <X className="w-4 h-4 text-gray-400"/>
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500"/>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0"/>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!loading && !error && booking && (
            <>
              {/* Status + price row */}
              <div className="flex items-center justify-between">
                <StatusBadge status={booking.status}/>
                <div className="text-right">
                  <p className="text-xl font-black text-blue-700">{fmtRON(booking.total)}</p>
                  <p className="text-xs text-gray-400">total cu comision</p>
                </div>
              </div>

              {/* Photos din serviciu */}
              <PhotoGallery photos={photos}/>

              {/* Handyman card */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <button onClick={() => {
                  if (booking.handyman?.first_name && booking.handyman?.last_name) {
                    onClose()
                    navigate(`/handymen/${slugify(booking.handyman.first_name, booking.handyman.last_name)}`)
                  }
                }} className="flex-shrink-0">
                  {booking.handyman?.avatar_url
                    ? <img src={booking.handyman.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-blue-400 transition"/>
                    : <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm hover:bg-blue-700 transition">{handymanInitials}</div>
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => {
                    if (booking.handyman?.first_name && booking.handyman?.last_name) {
                      onClose()
                      navigate(`/handymen/${slugify(booking.handyman.first_name, booking.handyman.last_name)}`)
                    }
                  }} className="font-bold text-gray-800 hover:text-blue-600 transition text-left text-sm flex items-center gap-1">
                    {handymanName}
                    {hp?.is_verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500"/>}
                    <ExternalLink className="w-3 h-3 text-gray-300"/>
                  </button>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {hp?.rating_avg > 0 && (
                      <div className="flex items-center gap-1">
                        <StarRow rating={hp.rating_avg}/>
                        <span className="text-xs text-gray-500">{Number(hp.rating_avg).toFixed(1)}</span>
                      </div>
                    )}
                    {hp?.total_jobs_completed > 0 && (
                      <span className="text-xs text-gray-400">{hp.total_jobs_completed} lucrări</span>
                    )}
                    {hp?.has_insurance && (
                      <span className="text-xs text-green-600 flex items-center gap-0.5">
                        <Shield className="w-3 h-3"/>Asigurat
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Service description */}
              {booking.service?.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{booking.service.description}</p>
              )}

              {/* Data + ora programate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5"/>Data
                  </p>
                  <p className="font-bold text-blue-800 text-sm">{fmtDate(booking.scheduled_date)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5"/>Ora
                  </p>
                  <p className="font-bold text-blue-800 text-sm">{booking.scheduled_time ?? '—'}</p>
                </div>
              </div>

              {/* Urgenta + durata */}
              <div className="flex items-center gap-3 flex-wrap">
                {booking.urgency && <UrgencyBadge urgency={booking.urgency}/>}
                {booking.service?.estimated_duration && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                    <Clock className="w-3 h-3"/>{booking.service.estimated_duration}
                  </span>
                )}
                {booking.service?.categories?.name && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                    {booking.service.categories.name}
                  </span>
                )}
              </div>

              {/* Adresa + contact */}
              <div className="space-y-2.5 border border-gray-100 rounded-xl p-4 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Detalii serviciu</p>
                {booking.service_address && (
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"/>
                    <span>{booking.service_address}</span>
                  </div>
                )}
                {booking.contact_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0"/>
                    <span>{booking.contact_name}</span>
                  </div>
                )}
                {booking.contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0"/>
                    <a href={`tel:${booking.contact_phone}`} className="hover:text-blue-600 transition">{booking.contact_phone}</a>
                  </div>
                )}
                {booking.contact_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0"/>
                    <a href={`mailto:${booking.contact_email}`} className="hover:text-blue-600 transition">{booking.contact_email}</a>
                  </div>
                )}
                {booking.handyman_notes && (
                  <div className="flex items-start gap-2 text-sm text-gray-700 pt-1 border-t border-gray-200 mt-1">
                    <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"/>
                    <span className="text-gray-500 italic">{booking.handyman_notes}</span>
                  </div>
                )}
              </div>

              {/* Pricing breakdown */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Detalii plată</p>
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Preț serviciu</span>
                    <span className="font-semibold text-gray-800">{fmtRON(booking.subtotal)}</span>
                  </div>
                  {booking.service_fee > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Comision platformă (8%)</span>
                      <span>{fmtRON(booking.service_fee)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-2 mt-1 flex justify-between font-black text-base">
                    <span>Total</span>
                    <span className="text-blue-700">{fmtRON(booking.total)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      {booking.payment_method === 'card'
                        ? <CreditCard className="w-3.5 h-3.5"/>
                        : <Banknote className="w-3.5 h-3.5"/>
                      }
                      <span>{booking.payment_method === 'card' ? 'Card la finalizare' : 'Cash la finalizare'}</span>
                    </div>
                    <span className={`font-semibold ${booking.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {booking.payment_status === 'paid' ? 'Plătit' : 'În așteptare'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note handyman */}
              {booking.special_instructions && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5"/>
                  <p className="text-xs text-yellow-800">{booking.special_instructions}</p>
                </div>
              )}

              {/* Reprogramare */}
              {['confirmed','assigned','in_progress'].includes(booking.status) && (
                <div className="border border-blue-100 rounded-xl overflow-hidden">
                  {reschedDone ? (
                    <div className="p-4 bg-green-50 flex items-center gap-2 text-green-700 text-sm font-medium">
                      <CheckCircle className="w-4 h-4 flex-shrink-0"/>
                      Cererea de reprogramare a fost trimisă handyman-ului.
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setShowReschedForm(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition text-sm font-semibold text-blue-700">
                        <span className="flex items-center gap-2"><CalendarClock className="w-4 h-4"/>Propune reprogramare</span>
                        <span className="text-xs font-normal text-blue-500">{showReschedForm ? 'Anulează' : 'Deschide'}</span>
                      </button>
                      {showReschedForm && (
                        <div className="p-4 space-y-3 bg-white">
                          {reschedError && <p className="text-xs text-red-600">{reschedError}</p>}
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">Dată nouă *</label>
                            <input type="date" value={reschedDate} min={getMinDate()} onChange={e => setReschedDate(e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">Oră nouă *</label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {TIME_SLOTS.map(t => (
                                <button key={t} onClick={() => setReschedTime(t)}
                                  className={`py-2 rounded-lg text-xs font-medium border transition
                                    ${reschedTime === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}>
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">Mesaj (opțional)</label>
                            <textarea value={reschedMsg} onChange={e => setReschedMsg(e.target.value)} rows={2}
                              placeholder="Motivul reprogramării..." className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                          </div>
                          <button onClick={handleReschedule} disabled={reschedSaving || !reschedDate || !reschedTime}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                            {reschedSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                            Trimite cererea
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Creat la */}
              <p className="text-xs text-gray-400 text-center">Rezervare creată: {fmtDate(booking.created_at)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
