import { useState } from 'react'
import {
  X, Send, DollarSign, Camera, CheckCircle, Tag,
  MapPin, Clock, Zap, AlertTriangle, Shield, Star,
  ChevronRight, ChevronLeft, Calendar, User, Briefcase,
  Info, MessageSquare
} from 'lucide-react'
import TaskPhoto from '../components/TaskPhoto'

// ─── helpers ──────────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }) {
  const map = {
    high:     { label: 'Urgent',  icon: AlertTriangle, cls: 'bg-red-100 text-red-700 border-red-200' },
    medium:   { label: 'Mediu',   icon: Zap,           cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    low:      { label: 'Normal',  icon: Clock,         cls: 'bg-green-100 text-green-700 border-green-200' },
    normal:   { label: 'Normal',  icon: Clock,         cls: 'bg-green-100 text-green-700 border-green-200' },
  }
  const cfg = map[urgency] ?? map.normal
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-blue-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-700 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ─── main component ────────────────────────────────────────────────────────────

export default function TaskRequestModal({
  isOpen,
  task,
  mode,
  onClose,
  onSubmit,
  form,
  setForm,
  sending,
}) {
  const [step, setStep] = useState(1) // 1 = detalii, 2 = ofertă, 3 = succes

  if (!isOpen || !task) return null

  const isMessageMode = mode === 'message'
  const photoCount = Array.isArray(task.photos) ? task.photos.length : (task.photos ?? 0)
  const keywords   = Array.isArray(task.keywords) ? task.keywords : []
  const createdAt  = task.created_at
    ? new Date(task.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const handleClose = () => {
    setStep(1)
    onClose()
  }

  const handleSubmit = async () => {
    await onSubmit()
    setStep(3)
  }

  // ── step 1: task details ───────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      {/* hero / photos */}
      <div className="relative rounded-xl overflow-hidden bg-gray-100 h-40 flex items-center justify-center">
        <TaskPhoto
          photos={task.photos}
          category={task.category_name}
          className="w-full h-full object-cover"
        />
        {photoCount > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full">
            <Camera className="w-3 h-3" />
            {photoCount} {photoCount === 1 ? 'poză' : 'poze'}
          </div>
        )}
        {task.urgency && (
          <div className="absolute top-2 left-2">
            <UrgencyBadge urgency={task.urgency} />
          </div>
        )}
      </div>

      {/* photo thumbnails */}
      {photoCount > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...Array(Math.min(photoCount, 5))].map((_, i) => (
            <div key={i} className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-200">
              <Camera className="w-5 h-5 text-gray-300" />
            </div>
          ))}
        </div>
      )}

      {/* description */}
      {task.description && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Descriere</p>
          <p className="text-sm text-gray-700 leading-relaxed">{task.description}</p>
        </div>
      )}

      {/* info grid */}
      <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
        <InfoRow icon={Briefcase}   label="Categorie"  value={task.category_name} />
        <InfoRow icon={MapPin}      label="Județ"      value={task.address_county} />
        <InfoRow icon={Calendar}    label="Data dorită" value={
          task.scheduled_date
            ? new Date(task.scheduled_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })
            : null
        } />
        <InfoRow icon={Clock}       label="Ora dorită" value={task.scheduled_time} />
        <InfoRow icon={DollarSign}  label="Buget client" value={
          task.budget ? `${Number(task.budget).toLocaleString('ro-RO')} RON` : null
        } />
        <InfoRow icon={User}        label="Client"     value={task.client_name} />
        <InfoRow icon={Star}        label="Postat pe"  value={createdAt} />
      </div>

      {/* keywords */}
      {keywords.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Cuvinte cheie</p>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-100">
                <Tag className="w-2.5 h-2.5" />
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* insurance required badge */}
      {task.insurance_required && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Asigurare obligatorie</p>
            <p className="text-xs text-amber-600 mt-0.5">Clientul solicită dovada asigurării pentru această lucrare.</p>
          </div>
        </div>
      )}

      {/* footer actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleClose}
          className="flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition text-sm"
        >
          <X className="w-4 h-4" /> Închide
        </button>
        <button
          onClick={() => setStep(2)}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition text-sm"
        >
          {isMessageMode ? (
            <><MessageSquare className="w-4 h-4" /> Trimite mesaj</>
          ) : (
            <><Send className="w-4 h-4" /> Negociază oferta</>
          )}
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      </div>
    </div>
  )

  // ── step 2: offer / negotiate form ────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-4">
      {/* context strip */}
      <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
        <TaskPhoto photos={task.photos} category={task.category_name} className="w-10 h-10 rounded-lg flex-shrink-0 object-cover" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{task.title}</p>
          <p className="text-xs text-gray-500">{task.client_name}{task.address_county ? ` · ${task.address_county}` : ''}</p>
        </div>
        {task.budget && (
          <span className="text-sm font-bold text-blue-600 flex-shrink-0">
            {Number(task.budget).toLocaleString('ro-RO')} RON
          </span>
        )}
      </div>

      {/* price */}
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-2">
          Prețul tău (RON) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="number"
            value={form.proposed_price}
            onChange={(e) => setForm(prev => ({ ...prev, proposed_price: e.target.value }))}
            placeholder="Ex: 250"
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* duration */}
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-2">Durată estimată</label>
        <input
          type="text"
          value={form.estimated_duration}
          onChange={(e) => setForm(prev => ({ ...prev, estimated_duration: e.target.value }))}
          placeholder="Ex: 2-3 ore, 1 zi"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* date + time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Disponibil pe</label>
          <input
            type="date"
            value={form.available_date}
            onChange={(e) => setForm(prev => ({ ...prev, available_date: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Ora</label>
          <select
            value={form.available_time}
            onChange={(e) => setForm(prev => ({ ...prev, available_time: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Selectează</option>
            {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* message */}
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-2">
          {isMessageMode ? 'Mesaj către client' : 'Mesaj de negociere'}
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
          placeholder={isMessageMode
            ? 'Scrie un mesaj pentru client...'
            : 'Prezintă-te și argumentează oferta ta...'}
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
        />
      </div>

      {/* insurance warning */}
      {task.insurance_required && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">Clientul solicită dovada asigurării. Asigurați-vă că aveți documentele necesare.</p>
        </div>
      )}

      {/* navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Înapoi
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.proposed_price || sending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {sending ? 'Se trimite...' : isMessageMode ? 'Trimite mesaj' : 'Trimite oferta'}
        </button>
      </div>
    </div>
  )

  // ── step 3: success ────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="text-center space-y-5 py-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          {isMessageMode ? 'Mesaj trimis!' : 'Ofertă trimisă!'}
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          {isMessageMode
            ? 'Clientul va fi notificat și te va contacta în curând.'
            : 'Clientul va fi notificat și poate accepta, refuza sau negocia oferta ta.'}
        </p>
      </div>

      {/* offer summary */}
      {!isMessageMode && form.proposed_price && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Sumar ofertă</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Lucrare', task.title],
              ['Prețul tău', `${Number(form.proposed_price).toLocaleString('ro-RO')} RON`],
              ['Durată', form.estimated_duration || '—'],
              ['Disponibil', form.available_date
                ? `${form.available_date}${form.available_time ? ` · ${form.available_time}` : ''}`
                : '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-green-600 text-xs">{label}</p>
                <p className="font-semibold text-green-800">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="text-sm text-gray-500 space-y-1.5 text-left">
        {[
          'Clientul va fi notificat imediat',
          'Vei primi o notificare când clientul răspunde',
          'Poți vedea oferta în secțiunea "Ofertele mele"',
        ].map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-gray-300 mt-0.5">•</span>{t}
          </li>
        ))}
      </ul>

      <button
        onClick={handleClose}
        className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition text-sm"
      >
        Gata
      </button>
    </div>
  )

  // ── step title & subtitle ──────────────────────────────────────────────────
  const stepMeta = {
    1: { title: task.title, subtitle: `${task.category_name ?? 'Cerere'} · ${task.client_name ?? 'Client'}` },
    2: { title: isMessageMode ? 'Mesaj pentru client' : 'Negociază oferta', subtitle: task.title },
    3: { title: '', subtitle: '' },
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:px-4"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── header ── */}
        {step < 3 && (
          <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
            <div className="flex-1 min-w-0 pr-3">
              <h3 className="text-base font-bold text-gray-800 truncate">{stepMeta[step].title}</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{stepMeta[step].subtitle}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* step pills */}
              <div className="flex gap-1">
                {[1, 2].map(s => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      s === step ? 'w-5 bg-blue-600' : s < step ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center ml-1"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* ── scrollable body ── */}
        <div className="overflow-y-auto flex-1 p-5">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </div>
    </div>
  )
}