import { useState, useEffect } from 'react'
import { supabase } from '../../../supabase'
import {
  X, Edit3, Save, XCircle, Camera, MapPin, Calendar,
  Clock, DollarSign, Tag, Shield, AlertTriangle, Zap,
  Star, Briefcase, Loader2, MessageSquare, Info,
  CheckCircle, ChevronLeft, ChevronRight, Trash2,
  User, Send, RotateCcw, BadgeCheck, ChevronDown, CalendarClock,
  Layers, Square, Wrench, Paintbrush, Hammer, Sparkles,
  Flower2, Sofa, CircuitBoard, Lightbulb, Building2,
  MoreHorizontal, Droplets, Plug, Heart, ZoomIn, ZoomOut
} from 'lucide-react'

// ─── category icon map ────────────────────────────────────────────────────────
const ICON_MAP = {
  bolt: Plug, Droplets, 'paint-roller': Paintbrush, square: Square,
  wallpaper: Layers, pipe: Wrench, Wrench, Zap, Paintbrush, Hammer,
  Sparkles, Flower2, Sofa, CircuitBoard, Lightbulb, Building2, MoreHorizontal,
}
function CategoryIcon({ iconName, className = 'w-4 h-4' }) {
  const Icon = ICON_MAP[iconName] ?? Wrench
  return <Icon className={className} />
}

// ─── urgency badge ────────────────────────────────────────────────────────────
function UrgencyBadge({ urgency }) {
  const map = {
    high:   { label: 'Urgent', Icon: AlertTriangle, cls: 'bg-red-100 text-red-700 border-red-200' },
    medium: { label: 'Mediu',  Icon: Zap,           cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    low:    { label: 'Normal', Icon: Clock,          cls: 'bg-green-100 text-green-700 border-green-200' },
    normal: { label: 'Normal', Icon: Clock,          cls: 'bg-green-100 text-green-700 border-green-200' },
  }
  const cfg = map[urgency] ?? map.normal
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  )
}

// ─── avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 'md' }) {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' }
  const cls = sizeMap[size] ?? sizeMap.md
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('') : '?'
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${cls} rounded-full object-cover flex-shrink-0`} />
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ─── lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ photos, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    setScale(1)
  }, [current])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setCurrent(i => Math.min(photos.length - 1, i + 1))
      if (e.key === 'ArrowLeft')  setCurrent(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photos.length, onClose])

  return (
    <div className="fixed inset-0 bg-black/90 z-[80] flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white text-sm font-medium">{current + 1} / {photos.length}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-white text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(4, +(s + 0.25).toFixed(2)))}
            className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative" onClick={e => e.stopPropagation()}>
        {photos.length > 1 && (
          <button onClick={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0}
            className="absolute left-3 z-10 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="max-w-full max-h-full overflow-auto flex items-center justify-center">
          <img
            src={photos[current]}
            alt=""
            style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.15s ease' }}
            className="max-w-[90vw] max-h-[80vh] object-contain select-none"
            draggable={false}
          />
        </div>
        {photos.length > 1 && (
          <button onClick={() => setCurrent(i => Math.min(photos.length - 1, i + 1))} disabled={current === photos.length - 1}
            className="absolute right-3 z-10 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto justify-center flex-shrink-0" onClick={e => e.stopPropagation()}>
          {photos.map((url, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === current ? 'border-white' : 'border-white/20'}`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── photo gallery ────────────────────────────────────────────────────────────
function PhotoGallery({ photos }) {
  const [active, setActive] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  if (!photos?.length) return null
  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden bg-gray-100" style={{ minHeight: '11rem' }}>
        <img src={photos[active]} alt="" className="w-full object-contain max-h-64 cursor-pointer"
          onClick={() => setLightboxIndex(active)}
          onError={(e) => { e.currentTarget.src = '' }} />
        {photos.length > 1 && (
          <>
            <button onClick={() => setActive(i => Math.max(0, i - 1))} disabled={active === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/60 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setActive(i => Math.min(photos.length - 1, i + 1))} disabled={active === photos.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/60 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              {active + 1} / {photos.length}
            </div>
          </>
        )}
        <button onClick={() => setLightboxIndex(active)}
          className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === active ? 'border-blue-500' : 'border-transparent'}`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {lightboxIndex !== null && (
        <Lightbox photos={photos} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}

// ─── offer card ───────────────────────────────────────────────────────────────
function OfferCard({ offer, onAccept, onNegotiate, onDecline, accepting, readOnly }) {
  const [expanded, setExpanded] = useState(false)
  const handymanName = offer.handyman
    ? `${offer.handyman.first_name ?? ''} ${offer.handyman.last_name ?? ''}`.trim()
    : 'Handyman anonim'

  const statusMap = {
    pending:    { label: 'În așteptare', cls: 'bg-yellow-100 text-yellow-700' },
    accepted:   { label: 'Acceptată',   cls: 'bg-green-100 text-green-700' },
    rejected:   { label: 'Refuzată',    cls: 'bg-red-100 text-red-700' },
    negotiating:{ label: 'Negociere',   cls: 'bg-blue-100 text-blue-700' },
  }
  const statusCfg = statusMap[offer.status] ?? statusMap.pending

  return (
    <div className={`border rounded-xl overflow-hidden transition ${
      offer.status === 'accepted' ? 'border-green-300 bg-green-50' :
      offer.status === 'rejected' ? 'border-gray-200 bg-gray-50 opacity-60' :
      'border-gray-200 bg-white'
    }`}>
      {/* header row */}
      <div className="p-3 flex items-center gap-3">
        <Avatar name={handymanName} avatarUrl={offer.handyman?.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{handymanName}</p>
          {offer.handyman?.city && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />{offer.handyman.city}
            </p>
          )}
          {offer.handyman?.average_rating > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs text-gray-600">{Number(offer.handyman.average_rating).toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-blue-600">
            {Number(offer.proposed_price).toLocaleString('ro-RO')} RON
          </p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* details row */}
      <div className="px-3 pb-2 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-2">
        {offer.estimated_duration && (
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{offer.estimated_duration}</span>
        )}
        {offer.available_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(offer.available_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}
            {offer.available_time ? ` · ${offer.available_time}` : ''}
          </span>
        )}
        {offer.message && (
          <button onClick={() => setExpanded(e => !e)}
            className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-700">
            <MessageSquare className="w-3 h-3" />
            Mesaj
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* expandable message */}
      {expanded && offer.message && (
        <div className="px-3 pb-3">
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 italic">"{offer.message}"</p>
        </div>
      )}

      {/* actions */}
      {offer.status === 'pending' && !readOnly && (
        <div className="flex gap-2 px-3 pb-3">
          <button onClick={() => onAccept(offer)} disabled={accepting}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-green-700 transition disabled:opacity-50">
            <CheckCircle className="w-3.5 h-3.5" />
            {accepting ? 'Se procesează…' : 'Acceptă'}
          </button>
          <button onClick={() => onNegotiate(offer)}
            className="flex-1 flex items-center justify-center gap-1.5 border border-blue-300 text-blue-600 py-2 rounded-lg text-xs font-semibold hover:bg-blue-50 transition">
            <Send className="w-3.5 h-3.5" /> Negociază
          </button>
          <button onClick={() => onDecline(offer)}
            className="flex items-center justify-center px-3 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {offer.status === 'pending' && readOnly && (
        <div className="flex items-center gap-2 px-3 pb-3 text-amber-700 text-xs font-semibold">
          <Info className="w-4 h-4" /> Ofertele sunt închise după atribuirea task-ului
        </div>
      )}
      {offer.status === 'accepted' && (
        <div className="flex items-center gap-2 px-3 pb-3 text-green-700 text-xs font-semibold">
          <BadgeCheck className="w-4 h-4" /> Ofertă acceptată — handymanul a fost notificat
        </div>
      )}
    </div>
  )
}

// ─── negotiate modal ──────────────────────────────────────────────────────────
function NegotiateModal({ offer, onClose, onSend }) {
  const [price, setPrice] = useState(offer?.proposed_price ?? '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (!offer) return null

  const handleSend = async () => {
    setSending(true)
    await onSend(offer, { price, message })
    setSending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1">Contra-ofertă</h3>
        <p className="text-xs text-gray-400 mb-4">
          Handyman a propus <strong>{Number(offer.proposed_price).toLocaleString('ro-RO')} RON</strong>
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Prețul tău (RON)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Mesaj (opțional)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              rows={3} placeholder="Explică propunerea ta…"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Anulează
          </button>
          <button onClick={handleSend} disabled={!price || sending}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {sending ? 'Se trimite…' : 'Trimite contra-oferta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── star rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readOnly = false }) {
  const [hovered, setHovered] = useState(null)
  const display = hovered ?? value
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(n)}
          onMouseEnter={() => !readOnly && setHovered(n)}
          onMouseLeave={() => !readOnly && setHovered(null)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition
            ${readOnly ? 'cursor-default' : 'hover:scale-110 cursor-pointer'}`}
        >
          <Star className={`w-7 h-7 transition-colors ${n <= display ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
        </button>
      ))}
    </div>
  )
}

// ─── completion approval section ──────────────────────────────────────────────
function CompletionApprovalSection({ completion, taskId, taskTitle, handymanId, clientId, onUpdated, onMsg }) {
  const photos = Array.isArray(completion?.completion_photos) ? completion.completion_photos : []

  const [localData,         setLocalData]         = useState(completion)
  const [rating,            setRating]            = useState(5)
  const [reviewText,        setReviewText]        = useState('')
  const [saving,            setSaving]            = useState(false)
  const [error,             setError]             = useState(null)
  const [activePhoto,       setActivePhoto]       = useState(0)
  const [lightboxIndex,     setLightboxIndex]     = useState(null)
  const [isFav,             setIsFav]             = useState(false)
  const [favLoading,        setFavLoading]        = useState(false)
  const [showRejectModal,      setShowRejectModal]      = useState(false)
  const [rejectionReasons,     setRejectionReasons]     = useState([])
  const [selectedReasonId,     setSelectedReasonId]     = useState('')
  const [rejectionDetails,     setRejectionDetails]     = useState('')
  const [rejectionPhotoPreviews, setRejectionPhotoPreviews] = useState([])
  const [rejectionPhotoFiles,  setRejectionPhotoFiles]  = useState([])

  useEffect(() => {
    supabase.from('rejection_reasons').select('id, name').eq('is_active', true)
      .then(({ data }) => setRejectionReasons(data ?? []))
  }, [])

  useEffect(() => {
    if (!handymanId || !clientId) return
    supabase.from('favorite_handymen')
      .select('id').eq('client_id', clientId).eq('handyman_id', handymanId).maybeSingle()
      .then(({ data }) => setIsFav(!!data))
  }, [handymanId, clientId])

  const toggleFavorite = async () => {
    if (!handymanId || favLoading) return
    setFavLoading(true)
    try {
      let cId = clientId
      if (!cId) {
        const { data: { user } } = await supabase.auth.getUser()
        cId = user?.id
      }
      if (!cId) return
      if (isFav) {
        await supabase.from('favorite_handymen').delete().eq('client_id', cId).eq('handyman_id', handymanId)
        setIsFav(false)
      } else {
        await supabase.from('favorite_handymen').insert({ client_id: cId, handyman_id: handymanId })
        setIsFav(true)
      }
    } finally {
      setFavLoading(false)
    }
  }

  // If completion is null — handyman hasn't submitted the completion form yet
  if (!localData) {
    return (
      <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 bg-yellow-100 border-b border-yellow-200">
          <div className="w-8 h-8 bg-yellow-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-yellow-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-yellow-800">Așteptăm dovezile de la handyman</p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Handymanul nu a trimis încă pozele și descrierea lucrării finalizate.
            </p>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-yellow-700">
            Vei putea aproba lucrarea și lăsa o recenzie după ce handymanul trimite dovezile din aplicația sa.
          </p>
        </div>
      </div>
    )
  }

  const isPending  = localData.client_accepted === null || localData.client_accepted === undefined
  const isApproved = localData.client_accepted === true
  const isRejected = localData.client_accepted === false

  const handleApprove = async () => {
    setSaving(true); setError(null)
    try {
      const now = new Date().toISOString()

      // Resolve clientId if not passed
      let cId = clientId
      if (!cId) {
        const { data: { user } } = await supabase.auth.getUser()
        cId = user?.id
      }

      // 1. Update job_completions
      const { error: compErr } = await supabase.from('job_completions').update({
        client_accepted:      true,
        client_rating:        rating,
        client_review:        reviewText || null,
        client_responded_at:  now,
        payment_released:     true,
        payment_released_at:  now,
      }).eq('id', localData.id)
      if (compErr) throw compErr

      // 2. Insert review
      if (cId && handymanId) {
        const { error: reviewErr } = await supabase.from('reviews').insert({
          task_id:      taskId,
          rating:       rating,
          title:        taskTitle || null,
          description:  reviewText || null,
          review_type:  'for_handyman',
          reviewer_id:  cId,
          reviewed_id:  handymanId,
          created_at:   now,
        })
        if (reviewErr) throw reviewErr
      }

      setLocalData(prev => ({ ...prev, client_accepted: true, client_rating: rating, client_review: reviewText || null }))
      onMsg?.('Lucrarea a fost aprobată și recenzia a fost salvată!')
      onUpdated?.()
    } catch (e) {
      setError('Eroare: ' + (e.message ?? ''))
    } finally {
      setSaving(false)
    }
  }

  const handleRejectionPhotoAdd = (e) => {
    const files = Array.from(e.target.files)
    if (rejectionPhotoFiles.length + files.length > 4) {
      setError('Poți adăuga maximum 4 poze.'); return
    }
    setRejectionPhotoFiles(prev => [...prev, ...files])
    setRejectionPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  const removeRejectionPhoto = (i) => {
    setRejectionPhotoFiles(prev => prev.filter((_, idx) => idx !== i))
    setRejectionPhotoPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleReject = async () => {
    if (!selectedReasonId) { setError('Selectează un motiv de respingere.'); return }
    setSaving(true); setError(null)
    try {
      const now = new Date().toISOString()

      // Upload poze în task-photos
      const uploadedUrls = []
      for (const file of rejectionPhotoFiles) {
        const ext = file.name.split('.').pop()
        const path = `${taskId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('dispute-photos').upload(path, file, { contentType: file.type })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('dispute-photos').getPublicUrl(path)
          uploadedUrls.push(urlData.publicUrl)
        }
      }

      const { error: compErr } = await supabase.from('job_completions').update({
        client_accepted:     false,
        client_responded_at: now,
        rejection_reason_id: Number(selectedReasonId),
        rejection_details:   rejectionDetails || null,
        dispute_status:      'open',
      }).eq('id', localData.id)
      if (compErr) throw compErr

      await supabase.from('tasks').update({ status: 'in_progress', updated_at: now }).eq('id', taskId)

      await supabase.from('task_disputes').insert({
        task_id:       taskId,
        completion_id: localData.id,
        reason_id:     Number(selectedReasonId),
        details:       rejectionDetails || null,
        photos:        uploadedUrls,
        status:        'open',
        created_at:    now,
      })

      setLocalData(prev => ({
        ...prev,
        client_accepted:     false,
        rejection_reason_id: Number(selectedReasonId),
        rejection_details:   rejectionDetails || null,
      }))
      setShowRejectModal(false)
      onMsg?.('Lucrarea a fost respinsă. Un asistent va analiza situația.')
      onUpdated?.()
    } catch (e) {
      setError('Eroare: ' + (e.message ?? ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${
      isPending  ? 'border-orange-300 bg-orange-50'  :
      isApproved ? 'border-green-300 bg-green-50'    :
                   'border-red-300 bg-red-50'
    }`}>
      {/* Section header */}
      <div className={`px-4 py-3 flex items-center gap-2 ${
        isPending  ? 'bg-orange-100 border-b border-orange-200'  :
        isApproved ? 'bg-green-100 border-b border-green-200'   :
                     'bg-red-100 border-b border-red-200'
      }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPending  ? 'bg-orange-200'  :
          isApproved ? 'bg-green-200'   :
                       'bg-red-200'
        }`}>
          {isPending  && <Briefcase className="w-4 h-4 text-orange-700" />}
          {isApproved && <BadgeCheck  className="w-4 h-4 text-green-700" />}
          {isRejected && <XCircle     className="w-4 h-4 text-red-700" />}
        </div>
        <div>
          <p className={`text-sm font-bold ${
            isPending  ? 'text-orange-800'  :
            isApproved ? 'text-green-800'   :
                         'text-red-800'
          }`}>
            {isPending  && 'Handymanul a marcat lucrarea ca finalizată'}
            {isApproved && 'Lucrare aprobată de tine'}
            {isRejected && 'Lucrare respinsă — handymanul va reface'}
          </p>
          {localData.created_at && (
            <p className="text-xs text-gray-500 mt-0.5">
              Finalizat pe {new Date(localData.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-sm text-red-700">{error}</div>
        )}

        {/* Completion photos */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Poze lucrare finalizată</p>
            <div className="relative rounded-xl overflow-hidden bg-gray-100">
              <img src={photos[activePhoto]} alt="" className="w-full object-contain max-h-72 cursor-pointer"
                onClick={() => setLightboxIndex(activePhoto)}
                onError={e => { e.currentTarget.style.display = 'none' }} />
              {photos.length > 1 && (
                <>
                  <button onClick={() => setActivePhoto(i => Math.max(0, i - 1))} disabled={activePhoto === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/60 transition">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setActivePhoto(i => Math.min(photos.length - 1, i + 1))} disabled={activePhoto === photos.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/60 transition">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                    {activePhoto + 1} / {photos.length}
                  </div>
                </>
              )}
              <button onClick={() => setLightboxIndex(activePhoto)}
                className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
            {photos.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {photos.map((url, i) => (
                  <button key={i} onClick={() => setActivePhoto(i)}
                    className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === activePhoto ? 'border-orange-400' : 'border-transparent'}`}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {lightboxIndex !== null && (
          <Lightbox photos={photos} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}

        {/* Completion description */}
        {localData.completion_description && (
          <div className="bg-white/70 rounded-xl p-3 border border-white">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nota handymanului</p>
            <p className="text-sm text-gray-700 leading-relaxed italic">"{localData.completion_description}"</p>
          </div>
        )}

        {/* ── PENDING: approval form ── */}
        {isPending && (
          <>
            <div className="border-t border-orange-200 pt-4">
              <p className="text-sm font-bold text-gray-700 mb-3">Evaluează lucrarea</p>

              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1.5">Rating *</p>
                <StarRating value={rating} onChange={setRating} />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-600 mb-1">Recenzie <span className="font-normal text-gray-400">(opțional)</span></label>
                <textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  rows={3}
                  placeholder="Descrie experiența cu handymanul..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setError(null); setShowRejectModal(true) }} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-300 text-red-600 bg-white rounded-xl text-sm font-medium hover:bg-red-50 transition disabled:opacity-50">
                  <XCircle className="w-4 h-4" /> Respinge
                </button>
                <button onClick={handleApprove} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                  Aprobă lucrarea
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── APPROVED: show submitted review ── */}
        {isApproved && (
          <div className="border-t border-green-200 pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <StarRating value={localData.client_rating ?? 0} readOnly />
              <span className="text-sm font-bold text-green-700">{localData.client_rating}/5</span>
            </div>
            {localData.client_review && (
              <p className="text-sm text-gray-700 italic bg-white/70 rounded-xl p-3 border border-green-100">
                "{localData.client_review}"
              </p>
            )}
            {localData.client_responded_at && (
              <p className="text-xs text-gray-400">
                Aprobat pe {new Date(localData.client_responded_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        )}

        {/* ── REJECTED ── */}
        {isRejected && (
          <div className="border-t border-red-200 pt-3 space-y-2">
            <p className="text-sm text-red-700">
              Ai respins lucrarea. Task-ul a revenit la <strong>în desfășurare</strong> — un asistent va analiza situația.
            </p>
            {localData.rejection_reason_id && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-bold text-red-700 mb-0.5">Motiv respingere:</p>
                <p className="text-sm text-red-800">
                  {rejectionReasons.find(r => r.id === localData.rejection_reason_id)?.name ?? '—'}
                </p>
                {localData.rejection_details && (
                  <p className="text-xs text-red-600 mt-1 italic">"{localData.rejection_details}"</p>
                )}
              </div>
            )}
            {localData.client_responded_at && (
              <p className="text-xs text-gray-400">
                Respins pe {new Date(localData.client_responded_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        )}

        {/* ── FAVORITE HANDYMAN ── always visible when task is completed ── */}
        {handymanId && (
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={toggleFavorite}
              disabled={favLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition w-full justify-center ${
                isFav
                  ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500'
              }`}
            >
              {favLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
              }
              {isFav ? 'Handyman salvat la favorite' : 'Adaugă handymanul la favorite'}
            </button>
          </div>
        )}
      </div>

      {/* ── REJECT MODAL ── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center px-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-100">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Respinge lucrarea</h3>
                <p className="text-xs text-gray-400 mt-0.5">Selectează motivul și adaugă dovezi dacă ai</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
              )}

              {/* Motive — grid butoane */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Motiv *</label>
                <div className="grid grid-cols-2 gap-2">
                  {rejectionReasons.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReasonId(String(r.id))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-sm transition-all ${
                        selectedReasonId === String(r.id)
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-700 hover:border-red-300'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        selectedReasonId === String(r.id) ? 'border-red-500' : 'border-gray-300'
                      }`}>
                        {selectedReasonId === String(r.id) && (
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                      <span className="leading-tight">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalii suplimentare */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Detalii suplimentare <span className="font-normal text-gray-400">(opțional)</span>
                </label>
                <textarea
                  value={rejectionDetails}
                  onChange={e => setRejectionDetails(e.target.value)}
                  rows={3}
                  placeholder="Descrie problema în detaliu…"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none text-sm"
                />
              </div>

              {/* Upload poze */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Poze dovezi <span className="font-normal text-gray-400">(opțional, max. 4)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {rejectionPhotoPreviews.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeRejectionPhoto(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {rejectionPhotoFiles.length < 4 && (
                    <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition flex-shrink-0">
                      <Camera className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-400 mt-1">Adaugă</span>
                      <input type="file" accept="image/*" multiple onChange={handleRejectionPhotoAdd} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={handleReject} disabled={saving || !selectedReasonId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirmă respingerea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── cancel confirm modal ──────────────────────────────────────────────────────
function CancelConfirmModal({ taskTitle, onClose, onConfirm, saving }) {
  const [inputVal, setInputVal] = useState('')
  const CONFIRM_PHRASE = 'ANULARE'
  const isMatch = inputVal.trim().toUpperCase() === CONFIRM_PHRASE

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Anulezi task-ul?</h3>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{taskTitle}</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-red-700">
            Această acțiune nu poate fi anulată. Task-ul va fi marcat ca <strong>anulat de client</strong> și handymanul va fi notificat.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1.5">
            Scrie <span className="text-red-600 font-mono">ANULARE</span> pentru a confirma
          </label>
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="ANULARE"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 text-sm font-mono uppercase"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Renunță
          </button>
          <button onClick={onConfirm} disabled={!isMatch || saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Confirmă anularea
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskRescheduleRequestModal({ task, onClose, onSubmit, sending }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)

  const minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const handleSubmit = async () => {
    if (!date || !time) {
      setError('Selectează data și ora.')
      return
    }
    setError(null)
    await onSubmit({ date, time, message })
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1">Reprogramează Task-ul</h3>
        <p className="text-xs text-gray-400 mb-4 line-clamp-2">{task?.title ?? 'Task'}</p>

        {error && <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Data nouă *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={minDate}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Ora nouă *</label>
            <select
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Selectează ora</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Mesaj (opțional)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Ex: Putem muta pe altă zi?"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Anulează
          </button>
          <button onClick={handleSubmit} disabled={sending}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
            {sending ? 'Se trimite…' : 'Trimite cererea'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── archive confirm modal ────────────────────────────────────────────────────
function ArchiveConfirmModal({ taskTitle, onClose, onConfirm, saving }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Arhivezi task-ul?</h3>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{taskTitle}</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-5">
          <p className="text-xs text-gray-600">
            Task-ul va dispărea din dashboard-ul tău, dar datele rămân salvate în siguranță. Istoricul și ofertele sunt păstrate.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Renunță
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-700 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Arhivează
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

const URGENCY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Mediu' },
  { value: 'high',   label: 'Urgent' },
]

const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

/**
 * ClientTaskDetailModal
 *
 * Props:
 *   taskId    – string | null
 *   onClose   – () => void
 *   onUpdated – () => void   (refresh parent list after edit/delete)
 */
export default function ClientTaskDetailModal({ taskId, onClose, onUpdated }) {
  const [task,       setTask]       = useState(null)
  const [offers,     setOffers]     = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [tab,        setTab]        = useState('details') // 'details' | 'offers' | 'edit'
  const [editForm,   setEditForm]   = useState({})
  const [saving,     setSaving]     = useState(false)
  const [accepting,  setAccepting]  = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleSaving, setRescheduleSaving] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [negotiateOffer, setNegotiateOffer] = useState(null)
  const [saveMsg,    setSaveMsg]    = useState(null)
  const [completion, setCompletion] = useState(null)

  // ── load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) { setTask(null); setOffers([]); return }
    let cancelled = false
    setLoading(true); setError(null); setTab('details')

    async function load() {
      const [{ data: taskData, error: tErr }, { data: catsData }, { data: offersData }, { data: completionData }] = await Promise.all([
        supabase.from('tasks').select('*, categories(id, name, icon)').eq('id', taskId).maybeSingle(),
        supabase.from('categories').select('id, name, icon').eq('is_active', true).order('name'),
        supabase.from('task_offers')
          .select(`
            *,
            handyman:handyman_id (
              first_name, last_name, avatar_url, city, average_rating
            )
          `)
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
        supabase.from('job_completions')
          .select('*')
          .eq('job_id', taskId)
          .eq('job_type', 'task')
          .maybeSingle(),
      ])

      if (!cancelled) {
        if (tErr || !taskData) { setError('Nu am putut încărca task-ul.'); setLoading(false); return }

        // Keep task.final_price aligned with the latest accepted offer if data got out of sync.
        const latestAccepted = (offersData ?? []).find(o => o.status === 'accepted')
        const acceptedPrice = latestAccepted?.proposed_price != null ? Number(latestAccepted.proposed_price) : null
        const currentFinalPrice = taskData.final_price != null ? Number(taskData.final_price) : null

        if (acceptedPrice != null && acceptedPrice !== currentFinalPrice) {
          const { error: syncErr } = await supabase
            .from('tasks')
            .update({
              final_price: acceptedPrice,
              handyman_id: latestAccepted?.handyman_id ?? taskData.handyman_id,
              status: taskData.status === 'pending' || taskData.status === 'open' ? 'assigned' : taskData.status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', taskId)

          if (!syncErr) {
            taskData.final_price = acceptedPrice
            taskData.handyman_id = latestAccepted?.handyman_id ?? taskData.handyman_id
            if (taskData.status === 'pending' || taskData.status === 'open') {
              taskData.status = 'assigned'
            }
          }
        }

        setTask(taskData)
        setEditForm({
          title:          taskData.title ?? '',
          description:    taskData.description ?? '',
          category_id:    taskData.category_id ?? '',
          urgency:        taskData.urgency ?? 'normal',
          budget:         taskData.budget ?? '',
          address_county: taskData.address_county ?? '',
          scheduled_date: taskData.scheduled_date ?? '',
          scheduled_time: taskData.scheduled_time ?? '',
          keywords:       (taskData.keywords ?? []).join(', '),
        })
        setCategories(catsData ?? [])
        setOffers(offersData ?? [])
        setCompletion(completionData ?? null)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [taskId])

  if (!taskId) return null

  // ── derived ─────────────────────────────────────────────────────────────────
  const photos    = Array.isArray(task?.photos)   ? task.photos   : []
  const keywords  = Array.isArray(task?.keywords) ? task.keywords : []
  const category  = task?.categories ?? null
  const pendingOffers = offers.filter(o => o.status === 'pending').length
  const acceptedOffer = offers.find(o => o.status === 'accepted')
  const effectiveFinalPrice = task?.final_price ?? acceptedOffer?.proposed_price ?? null
  const isAssigned = task?.status === 'assigned'
  const isInProgress = task?.status === 'in_progress'
  const isCompleted = task?.status === 'completed'
  const isCancelled = task?.status === 'cancelled'
  // Task-ul nu mai poate fi editat odată ce a primit un handyman sau a început/finalizat
  const isReadOnly = isAssigned || isInProgress || isCompleted
  const canRescheduleTask = isAssigned && !isInProgress && !isCompleted && !isCancelled
  const canCancelTask = !isInProgress && !isCompleted && !isCancelled
  const postedAt  = task?.created_at
    ? new Date(task.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const statusColor = {
    pending:   'bg-yellow-100 text-yellow-700',
    open:      'bg-green-100 text-green-700',
    assigned:  'bg-blue-100 text-blue-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
  }

  // ── save edit ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isReadOnly) {
      setSaveMsg('Eroare: task-ul nu mai poate fi editat în starea actuală.')
      setTab('details')
      return
    }

    setSaving(true)
    const keywordsArr = editForm.keywords
      ? editForm.keywords.split(',').map(k => k.trim()).filter(Boolean)
      : []

    const { data: savedRows, error: saveErr } = await supabase.from('tasks').update({
      title:          editForm.title,
      description:    editForm.description,
      category_id:    editForm.category_id || null,
      urgency:        editForm.urgency,
      budget:         editForm.budget ? Number(editForm.budget) : null,
      address_county: editForm.address_county,
      scheduled_date: editForm.scheduled_date || null,
      scheduled_time: editForm.scheduled_time || null,
      keywords:       keywordsArr,
      updated_at:     new Date().toISOString(),
    }).eq('id', taskId).in('status', ['pending', 'open']).select('id')

    setSaving(false)
    if (!saveErr && savedRows?.length) {
      setSaveMsg('Modificările au fost salvate!')
      setTimeout(() => setSaveMsg(null), 3000)
      const { data } = await supabase.from('tasks').select('*, categories(id, name, icon)').eq('id', taskId).maybeSingle()
      if (data) setTask(data)
      setTab('details')
      if (onUpdated) onUpdated()
    } else {
      setSaveMsg('Eroare: task-ul nu mai poate fi editat în starea actuală.')
      const { data } = await supabase.from('tasks').select('*, categories(id, name, icon)').eq('id', taskId).maybeSingle()
      if (data) {
        setTask(data)
        if (isReadOnly) setTab('details')
      }
    }
  }

  // ── cancel task (allowed until work starts) ────────────────────────────────
  const handleCancelTask = async () => {
    if (!canCancelTask) return
    setDeleting(true)
    setSaveMsg(null)
    try {
      const nextSpecialInstructions = [task?.special_instructions, '[ANULARE CLIENT]']
        .filter(Boolean)
        .join('\n')

      const { error: cancelErr } = await supabase.from('tasks').update({
        status: 'cancelled',
        special_instructions: nextSpecialInstructions,
        updated_at: new Date().toISOString(),
      }).eq('id', taskId)

      if (cancelErr) throw cancelErr

      const { data: newTask } = await supabase.from('tasks').select('*, categories(id, name, icon)').eq('id', taskId).maybeSingle()
      if (newTask) setTask(newTask)
      setShowCancelModal(false)
      setTab('details')
      setSaveMsg('Task-ul a fost anulat.')
      if (onUpdated) onUpdated()
    } catch (e) {
      setSaveMsg(`Eroare la anulare: ${e.message ?? ''}`)
    } finally {
      setDeleting(false)
    }
  }

  // ── archive task (soft hide, data stays in DB) ────────────────────────────
  const handleArchiveTask = async () => {
    setArchiving(true)
    try {
      const { error: archErr } = await supabase
        .from('tasks')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', taskId)
      if (archErr) throw archErr
      setShowArchiveModal(false)
      if (onUpdated) onUpdated()
      onClose()
    } catch (e) {
      setSaveMsg(`Eroare la arhivare: ${e.message ?? ''}`)
      setShowArchiveModal(false)
    } finally {
      setArchiving(false)
    }
  }

  const handleCreateRescheduleRequest = async ({ date, time, message }) => {
    if (!task?.handyman_id) {
      setSaveMsg('Eroare: task-ul nu este alocat unui handyman.')
      return
    }

    setRescheduleSaving(true)
    setSaveMsg(null)
    try {
      const now = new Date().toISOString()

      // Get client_id from auth if task.client_id is missing
      let clientId = task.client_id
      if (!clientId) {
        const { data: { user } } = await supabase.auth.getUser()
        clientId = user?.id
      }
      if (!clientId) {
        setSaveMsg('Eroare: nu s-a putut identifica clientul.')
        return
      }

      await supabase.from('reschedule_requests')
        .update({ status: 'rejected', responded_at: now })
        .eq('job_id', taskId)
        .eq('job_type', 'task')
        .in('status', ['pending', 'pending_client', 'pending_handyman'])

      const { error: insertErr } = await supabase.from('reschedule_requests').insert({
        job_id: taskId,
        job_type: 'task',
        handyman_id: task.handyman_id,
        client_id: clientId,
        proposed_date: date,
        proposed_time: time,
        message: message || null,
        status: 'pending_handyman',
        created_at: now,
      })

      if (insertErr) throw insertErr

      setShowRescheduleModal(false)
      setSaveMsg('Cererea de reprogramare a fost trimisă către handyman.')
      if (onUpdated) onUpdated()
    } catch (e) {
      setSaveMsg(`Eroare la trimiterea reprogramării: ${e.message ?? ''}`)
    } finally {
      setRescheduleSaving(false)
    }
  }

  // ── accept offer ───────────────────────────────────────────────────────────
  const handleAcceptOffer = async (offer) => {
    if (isReadOnly) {
      setSaveMsg('Eroare: task-ul este deja atribuit. Nu mai poți accepta alte oferte.')
      setTab('details')
      return
    }

    setAccepting(true)
    setSaveMsg(null)
    try {
      // Accept selected offer, reject all others, then set final task price.
      const { error: acceptErr } = await supabase.from('task_offers').update({ status: 'accepted' }).eq('id', offer.id)
      if (acceptErr) throw acceptErr

      const { error: rejectErr } = await supabase.from('task_offers').update({ status: 'rejected' })
        .eq('task_id', taskId)
        .neq('id', offer.id)
      if (rejectErr) throw rejectErr

      const { error: taskErr } = await supabase.from('tasks').update({
        status: 'assigned',
        handyman_id: offer.handyman_id,
        final_price: offer.proposed_price,
        updated_at: new Date().toISOString(),
      }).eq('id', taskId)
      if (taskErr) throw taskErr

      // refresh
      const { data: newOffers } = await supabase.from('task_offers')
        .select('*, handyman:handyman_id(first_name, last_name, avatar_url, city, average_rating)')
        .eq('task_id', taskId).order('created_at', { ascending: false })
      setOffers(newOffers ?? [])
      const { data: newTask } = await supabase.from('tasks').select('*, categories(id, name, icon)').eq('id', taskId).maybeSingle()
      if (newTask) setTask(newTask)
      if (onUpdated) onUpdated()
    } catch (e) {
      setSaveMsg(`Eroare la acceptarea ofertei: ${e.message ?? ''}`)
    } finally {
      setAccepting(false)
    }
  }

  // ── decline offer ──────────────────────────────────────────────────────────
  const handleDeclineOffer = async (offer) => {
    await supabase.from('task_offers').update({ status: 'rejected' }).eq('id', offer.id)
    setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, status: 'rejected' } : o))
  }

  // ── negotiate offer ────────────────────────────────────────────────────────
  const handleNegotiateOffer = async (offer, { price, message }) => {
      if (isReadOnly) {
        setSaveMsg('Eroare: task-ul este deja atribuit. Nu mai poți negocia oferte.')
        setTab('details')
        return
      }

      if (!price) return
    
      // 1. Marchează oferta curentă a handyman-ului ca 'negotiating'
      await supabase.from('task_offers')
        .update({ status: 'negotiating' })
        .eq('id', offer.id)
    
      // 2. Inserează contra-oferta clientului cu sent_by: 'client'
      await supabase.from('task_offers').insert({
        task_id:            offer.task_id,
        handyman_id:        offer.handyman_id,
        proposed_price:     Number(price),
        message:            message || null,
        status:             'pending',
        sent_by:            'client',            // ← CHEIE: știm că e de la client
        estimated_duration: offer.estimated_duration ?? null,
        available_date:     offer.available_date ?? null,
        available_time:     offer.available_time ?? null,
        created_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      })
    
      // 3. Reîncarcă ofertele
      const { data: newOffers } = await supabase
        .from('task_offers')
        .select('*, handyman:handyman_id(first_name, last_name, avatar_url, city, average_rating)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
      setOffers(newOffers ?? [])
  }
 
  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:px-4" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh]"
          onClick={e => e.stopPropagation()}>

          {/* ── HEADER ── */}
          <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
            <div className="flex-1 min-w-0 pr-2">
              <h3 className="text-base font-bold text-gray-800 leading-snug line-clamp-1">
                {loading ? 'Se încarcă…' : (task?.title ?? '—')}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {!loading && category && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <CategoryIcon iconName={category.icon} className="w-3.5 h-3.5" />
                    {category.name}
                  </div>
                )}
                {!loading && task?.status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {task.status === 'pending'   ? 'În așteptare' :
                     task.status === 'open'      ? 'Deschis' :
                     task.status === 'assigned'  ? 'Atribuit' :
                     task.status === 'completed' ? 'Finalizat' :
                     task.status === 'cancelled' ? 'Anulat' : task.status}
                  </span>
                )}
                {!loading && task?.urgency && <UrgencyBadge urgency={task.urgency} />}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* ── TABS ── */}
          {!loading && task && (
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {[
                { id: 'details', label: 'Detalii' },
                { id: 'offers',  label: `Oferte${pendingOffers > 0 ? ` (${pendingOffers})` : ''}` },
                { id: 'edit',    label: isReadOnly ? 'Editează (blocat)' : 'Editează' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.id === 'edit' && isReadOnly) {
                      setSaveMsg('Eroare: task-ul nu mai poate fi editat în starea actuală.')
                      setTab('details')
                      return
                    }
                    setTab(t.id)
                  }}
                  disabled={t.id === 'edit' && isReadOnly}
                  className={`flex-1 py-3 text-sm font-medium transition border-b-2 ${
                    tab === t.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } ${t.id === 'offers' && pendingOffers > 0 ? 'relative' : ''} ${t.id === 'edit' && isReadOnly ? 'opacity-50 cursor-not-allowed hover:text-gray-500' : ''}`}>
                  {t.label}
                  {t.id === 'offers' && pendingOffers > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full">
                      {pendingOffers}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── BODY ── */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-400">Se încarcă…</p>
              </div>
            )}

            {!loading && error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <Info className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            {/* ════ DETAILS TAB ════ */}
            {!loading && task && tab === 'details' && (
              <>
                {/* Completion approval — shown for all completed tasks */}
                {isCompleted && (
                  <CompletionApprovalSection
                    completion={completion}
                    taskId={taskId}
                    taskTitle={task.title}
                    handymanId={task.handyman_id}
                    clientId={task.client_id}
                    onUpdated={onUpdated}
                    onMsg={setSaveMsg}
                  />
                )}

                <PhotoGallery photos={photos} />

                {!photos.length && (
                  <div className="h-24 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-1">
                    <Camera className="w-5 h-5 text-gray-300" />
                    <p className="text-xs text-gray-400">Fără poze</p>
                  </div>
                )}

                {task.description && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Descriere</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{task.description}</p>
                  </div>
                )}

                <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
                  {task.address_county && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Județ</p>
                        <p className="text-sm text-gray-700 font-semibold">{task.address_county}</p>
                      </div>
                    </div>
                  )}
                  {(task.scheduled_date || task.scheduled_time) && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Data dorită</p>
                        <p className="text-sm text-gray-700 font-semibold">
                          {task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                          {task.scheduled_time ? ` · ${task.scheduled_time}` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.budget && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Bugetul tău</p>
                        <p className="text-sm text-gray-700 font-semibold">{Number(task.budget).toLocaleString('ro-RO')} RON</p>
                      </div>
                    </div>
                  )}
                  {effectiveFinalPrice && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <BadgeCheck className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Preț final acceptat</p>
                        <p className="text-sm text-green-700 font-bold">{Number(effectiveFinalPrice).toLocaleString('ro-RO')} RON</p>
                      </div>
                    </div>
                  )}
                  {postedAt && (
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Star className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Postat pe</p>
                        <p className="text-sm text-gray-700 font-semibold">{postedAt}</p>
                      </div>
                    </div>
                  )}
                </div>

                {keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Cuvinte cheie</p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((kw, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-100">
                          <Tag className="w-2.5 h-2.5" />{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {task.insurance_required && (
                  <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Asigurare obligatorie</p>
                      <p className="text-xs text-amber-600 mt-0.5">Ai solicitat dovada asigurării pentru această lucrare.</p>
                    </div>
                  </div>
                )}

                {(canRescheduleTask || canCancelTask) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      disabled={!canRescheduleTask}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CalendarClock className="w-4 h-4" /> Reprogramează
                    </button>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      disabled={!canCancelTask || deleting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" /> {deleting ? 'Se anulează…' : 'Anulează task-ul'}
                    </button>
                  </div>
                )}

                {isReadOnly && (
                  <p className="text-xs text-gray-400">
                    Task-ul nu mai poate fi editat după atribuire. Poți folosi reprogramarea dacă e alocat.
                  </p>
                )}

                {/* archive button — visible for cancelled or completed tasks */}
                {(isCancelled || isCompleted) && (
                  <button
                    onClick={() => setShowArchiveModal(true)}
                    disabled={archiving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 border border-gray-300 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {archiving ? 'Se arhivează…' : 'Arhivează task-ul'}
                  </button>
                )}
              </>
            )}

            {/* ════ OFFERS TAB ════ */}
            {!loading && task && tab === 'offers' && (
              <>
                {offers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">Nicio ofertă primită încă</p>
                    <p className="text-xs text-gray-400 text-center">Handymanii din zona ta vor vedea task-ul și vor trimite oferte</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* pending first */}
                    {offers.filter(o => o.status === 'pending').map(offer => (
                      <OfferCard key={offer.id} offer={offer}
                        onAccept={handleAcceptOffer}
                        onNegotiate={o => setNegotiateOffer(o)}
                        onDecline={handleDeclineOffer}
                        accepting={accepting}
                        readOnly={isReadOnly}
                      />
                    ))}
                    {/* accepted */}
                    {offers.filter(o => o.status === 'accepted').map(offer => (
                      <OfferCard key={offer.id} offer={offer}
                        onAccept={handleAcceptOffer} onNegotiate={o => setNegotiateOffer(o)}
                        onDecline={handleDeclineOffer} accepting={accepting} readOnly={isReadOnly}
                      />
                    ))}
                    {/* negotiating */}
                    {offers.filter(o => o.status === 'negotiating').map(offer => (
                      <OfferCard key={offer.id} offer={offer}
                        onAccept={handleAcceptOffer} onNegotiate={o => setNegotiateOffer(o)}
                        onDecline={handleDeclineOffer} accepting={accepting} readOnly={isReadOnly}
                      />
                    ))}
                    {/* rejected - collapsed */}
                    {offers.filter(o => o.status === 'rejected').length > 0 && (
                      <details className="group">
                        <summary className="text-xs text-gray-400 cursor-pointer select-none list-none flex items-center gap-1 py-1">
                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                          {offers.filter(o => o.status === 'rejected').length} ofertă/oferte refuzate
                        </summary>
                        <div className="space-y-2 mt-2">
                          {offers.filter(o => o.status === 'rejected').map(offer => (
                            <OfferCard key={offer.id} offer={offer}
                              onAccept={handleAcceptOffer} onNegotiate={o => setNegotiateOffer(o)}
                              onDecline={handleDeclineOffer} accepting={accepting} readOnly={isReadOnly}
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ════ EDIT TAB ════ */}
            {!loading && task && tab === 'edit' && (
              <div className="space-y-4">
                {isReadOnly && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {isCompleted ? 'Task-ul este finalizat. Editarea nu este posibilă.' :
                     isInProgress ? 'Lucrarea este în desfășurare. Editarea este blocată.' :
                     'Task-ul este atribuit. Editarea este blocată după atribuire.'}
                  </div>
                )}

                {saveMsg && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                    saveMsg.includes('Eroare') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                  }`}>
                    {saveMsg.includes('Eroare') ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {saveMsg}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Titlu *</label>
                  <input type="text" value={editForm.title}
                    onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                    disabled={isReadOnly}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Descriere</label>
                  <textarea value={editForm.description}
                    onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                    disabled={isReadOnly}
                    rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Categorie</label>
                    <select value={editForm.category_id}
                      onChange={e => setEditForm(p => ({ ...p, category_id: e.target.value }))}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="">Selectează</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Urgență</label>
                    <select value={editForm.urgency}
                      onChange={e => setEditForm(p => ({ ...p, urgency: e.target.value }))}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Buget (RON)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="number" value={editForm.budget}
                        onChange={e => setEditForm(p => ({ ...p, budget: e.target.value }))}
                        disabled={isReadOnly}
                        placeholder="Ex: 300"
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Județ</label>
                    <input type="text" value={editForm.address_county}
                      onChange={e => setEditForm(p => ({ ...p, address_county: e.target.value }))}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Data dorită</label>
                    <input type="date" value={editForm.scheduled_date}
                      onChange={e => setEditForm(p => ({ ...p, scheduled_date: e.target.value }))}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Ora dorită</label>
                    <select value={editForm.scheduled_time}
                      onChange={e => setEditForm(p => ({ ...p, scheduled_time: e.target.value }))}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="">—</option>
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Cuvinte cheie</label>
                  <input type="text" value={editForm.keywords}
                    onChange={e => setEditForm(p => ({ ...p, keywords: e.target.value }))}
                    disabled={isReadOnly}
                    placeholder="Ex: curățenie, urgență, montaj"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  <p className="text-xs text-gray-400 mt-1">Separate prin virgulă</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setTab('details')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                    <RotateCcw className="w-4 h-4" /> Anulează
                  </button>
                  <button onClick={handleSave} disabled={!editForm.title || saving || isReadOnly}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                    <Save className="w-4 h-4" />
                    {saving ? 'Se salvează…' : 'Salvează'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* negotiate sub-modal */}
      {negotiateOffer && (
        <NegotiateModal
          offer={negotiateOffer}
          onClose={() => setNegotiateOffer(null)}
          onSend={handleNegotiateOffer}
        />
      )}
      {showRescheduleModal && (
        <TaskRescheduleRequestModal
          task={task}
          onClose={() => setShowRescheduleModal(false)}
          onSubmit={handleCreateRescheduleRequest}
          sending={rescheduleSaving}
        />
      )}
      {showCancelModal && (
        <CancelConfirmModal
          taskTitle={task?.title ?? 'Task'}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancelTask}
          saving={deleting}
        />
      )}
      {showArchiveModal && (
        <ArchiveConfirmModal
          taskTitle={task?.title ?? 'Task'}
          onClose={() => setShowArchiveModal(false)}
          onConfirm={handleArchiveTask}
          saving={archiving}
        />
      )}
    </>
  )
}