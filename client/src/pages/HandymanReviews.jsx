import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import HandymanNavbar from '../components/handyman-dashboard/HandymanNavbar'
import {
  Star, Search, Share2, ThumbsUp, ThumbsDown, Award,
  CheckCircle, Loader2, Send, X, Heart,
  MessageSquare
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Avatar({ name, avatarUrl }) {
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('') : '?'
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" onError={e => { e.currentTarget.src = '' }} />
  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
      {initials}
    </div>
  )
}

function StarRow({ value, size = 'sm' }) {
  const cls = size === 'lg' ? 'w-6 h-6' : 'w-3.5 h-3.5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${cls} ${s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function HandymanReviews() {
  const [userId,       setUserId]       = useState(null)
  const [myName,       setMyName]       = useState('')
  const [myAvatar,     setMyAvatar]     = useState(null)
  const [reviews,      setReviews]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [helpfulSet,      setHelpfulSet]      = useState(new Set())
  const [notHelpfulSet,   setNotHelpfulSet]   = useState(new Set())

  // reply state
  const [replyingTo,   setReplyingTo]   = useState(null) // review id
  const [replyText,    setReplyText]    = useState('')
  const [replySaving,  setReplySaving]  = useState(false)
  const [editingReply, setEditingReply] = useState(null) // review id

  // filters
  const [searchQuery,  setSearchQuery]  = useState('')
  const [ratingFilter, setRatingFilter] = useState('0')
  const [sortBy,       setSortBy]       = useState('recent')

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [profileRes, reviewsRes] = await Promise.all([
        supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', user.id).single(),
        supabase.from('reviews')
          .select(`
            id, rating, title, description, created_at,
            helpful_count, not_helpful_count, owner_reply, owner_reply_at, tags, photos,
            reviewer:reviewer_id(id, first_name, last_name, avatar_url),
            task:task_id(title, categories(name))
          `)
          .eq('reviewed_id', user.id)
          .eq('review_type', 'for_handyman')
          .order('created_at', { ascending: false }),
      ])

      if (profileRes.data) {
        setMyName(`${profileRes.data.first_name ?? ''} ${profileRes.data.last_name ?? ''}`.trim())
        setMyAvatar(profileRes.data.avatar_url)
      }

      const loaded = reviewsRes.data ?? []
      setReviews(loaded)

      // care din ele le-a votat userul curent
      if (loaded.length && user) {
        const ids = loaded.map(r => r.id)
        const [{ data: hData }, { data: nhData }] = await Promise.all([
          supabase.from('review_helpful').select('review_id').eq('user_id', user.id).in('review_id', ids),
          supabase.from('review_not_helpful').select('review_id').eq('user_id', user.id).in('review_id', ids),
        ])
        setHelpfulSet(new Set((hData ?? []).map(h => h.review_id)))
        setNotHelpfulSet(new Set((nhData ?? []).map(h => h.review_id)))
      }

      setLoading(false)
    }
    load()
  }, [])

  // ── stats din date reale ───────────────────────────────────────────────────
  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1)
    : '—'
  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => ({
    stars, count: reviews.filter(r => r.rating === stars).length,
  }))
  const maxCount = Math.max(...ratingBreakdown.map(r => r.count), 1)
  const pct5 = totalReviews > 0 ? Math.round((ratingBreakdown[0].count / totalReviews) * 100) : 0

  // ── helpful / not-helpful toggles ─────────────────────────────────────────
  const toggleHelpful = async (reviewId) => {
    if (!userId) return
    const isOn = helpfulSet.has(reviewId)
    const delta = isOn ? -1 : 1
    setHelpfulSet(prev => { const n = new Set(prev); isOn ? n.delete(reviewId) : n.add(reviewId); return n })
    // remove opposite vote if switching
    if (!isOn && notHelpfulSet.has(reviewId)) {
      setNotHelpfulSet(prev => { const n = new Set(prev); n.delete(reviewId); return n })
      await supabase.from('review_not_helpful').delete().eq('review_id', reviewId).eq('user_id', userId)
      const nhCurrent = reviews.find(r => r.id === reviewId)?.not_helpful_count ?? 1
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, not_helpful_count: Math.max(0, nhCurrent - 1) } : r))
      await supabase.from('reviews').update({ not_helpful_count: Math.max(0, nhCurrent - 1) }).eq('id', reviewId)
    }
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, helpful_count: Math.max(0, (r.helpful_count ?? 0) + delta) } : r))
    if (isOn) {
      await supabase.from('review_helpful').delete().eq('review_id', reviewId).eq('user_id', userId)
    } else {
      await supabase.from('review_helpful').upsert({ review_id: reviewId, user_id: userId })
    }
    const current = reviews.find(r => r.id === reviewId)?.helpful_count ?? 0
    await supabase.from('reviews').update({ helpful_count: Math.max(0, current + delta) }).eq('id', reviewId)
  }

  const toggleNotHelpful = async (reviewId) => {
    if (!userId) return
    const isOn = notHelpfulSet.has(reviewId)
    const delta = isOn ? -1 : 1
    setNotHelpfulSet(prev => { const n = new Set(prev); isOn ? n.delete(reviewId) : n.add(reviewId); return n })
    // remove opposite vote if switching
    if (!isOn && helpfulSet.has(reviewId)) {
      setHelpfulSet(prev => { const n = new Set(prev); n.delete(reviewId); return n })
      await supabase.from('review_helpful').delete().eq('review_id', reviewId).eq('user_id', userId)
      const hCurrent = reviews.find(r => r.id === reviewId)?.helpful_count ?? 1
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, helpful_count: Math.max(0, hCurrent - 1) } : r))
      await supabase.from('reviews').update({ helpful_count: Math.max(0, hCurrent - 1) }).eq('id', reviewId)
    }
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, not_helpful_count: Math.max(0, (r.not_helpful_count ?? 0) + delta) } : r))
    if (isOn) {
      await supabase.from('review_not_helpful').delete().eq('review_id', reviewId).eq('user_id', userId)
    } else {
      await supabase.from('review_not_helpful').upsert({ review_id: reviewId, user_id: userId })
    }
    const current = reviews.find(r => r.id === reviewId)?.not_helpful_count ?? 0
    await supabase.from('reviews').update({ not_helpful_count: Math.max(0, current + delta) }).eq('id', reviewId)
  }

  // ── handyman reply ─────────────────────────────────────────────────────────
  const submitReply = async (reviewId) => {
    if (!replyText.trim()) return
    setReplySaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('reviews').update({
      owner_reply: replyText.trim(),
      owner_reply_at: now,
    }).eq('id', reviewId)

    if (!error) {
      setReviews(prev => prev.map(r => r.id === reviewId
        ? { ...r, owner_reply: replyText.trim(), owner_reply_at: now }
        : r
      ))
      setReplyingTo(null)
      setEditingReply(null)
      setReplyText('')
    }
    setReplySaving(false)
  }

  const startReply = (review) => {
    setReplyText(review.owner_reply ?? '')
    setReplyingTo(review.id)
    setEditingReply(review.owner_reply ? review.id : null)
  }

  // ── share ──────────────────────────────────────────────────────────────────
  const handleShare = (review) => {
    const text = `"${review.title}" — ${review.rating}/5 stele`
    if (navigator.share) {
      navigator.share({ title: text, text: review.description ?? '' }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
  }

  // ── filter + sort ──────────────────────────────────────────────────────────
  const filtered = reviews
    .filter(r => {
      if (ratingFilter !== '0' && r.rating !== Number(ratingFilter)) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const client = r.reviewer ? `${r.reviewer.first_name ?? ''} ${r.reviewer.last_name ?? ''}`.toLowerCase() : ''
        if (!r.title?.toLowerCase().includes(q) && !r.description?.toLowerCase().includes(q) && !client.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'rating_desc') return b.rating - a.rating
      if (sortBy === 'rating_asc')  return a.rating - b.rating
      if (sortBy === 'helpful')     return (b.helpful_count ?? 0) - (a.helpful_count ?? 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <HandymanNavbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Recenzii & Ratinguri</h1>
          <p className="text-gray-500 mt-1">{totalReviews} recenzii primite</p>
        </div>

        {/* ── SUMMARY ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Big number */}
              <div className="text-center flex-shrink-0">
                <p className="text-6xl font-bold text-gray-800">{avgRating}</p>
                <StarRow value={Math.round(Number(avgRating))} size="lg" />
                <p className="text-sm text-gray-400 mt-1">{totalReviews} recenzii</p>
              </div>

              {/* Breakdown bars */}
              <div className="flex-1 w-full space-y-2">
                {ratingBreakdown.map(item => (
                  <div key={item.stars} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-10 justify-end flex-shrink-0">
                      <span className="text-sm font-medium text-gray-600">{item.stars}</span>
                      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-yellow-400 h-3 rounded-full transition-all"
                        style={{ width: `${(item.count / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-sm text-gray-400 w-6 text-right">{item.count}</span>
                  </div>
                ))}
              </div>

              {/* Right stats */}
              <div className="flex-shrink-0 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <ThumbsUp className="w-4 h-4 text-green-500" />
                  <span className="text-gray-600">{pct5}% recenzii de 5 stele</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Award className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-600">Rating mediu {avgRating}/5</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FILTERS ── */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Caută după client, titlu sau text..."
              className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="0">Toate ratingurile</option>
            {[5, 4, 3, 2, 1].map(s => <option key={s} value={s}>{s} stele</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="recent">Cele mai recente</option>
            <option value="rating_desc">Rating descrescător</option>
            <option value="rating_asc">Rating crescător</option>
            <option value="helpful">Cele mai utile</option>
          </select>
        </div>

        {/* ── REVIEWS LIST ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {totalReviews === 0 ? 'Nicio recenzie încă' : 'Nicio recenzie găsită'}
            </h3>
            <p className="text-gray-400 text-sm">
              {totalReviews === 0 ? 'Recenziile vor apărea după ce clienții aprobă lucrările.' : 'Încearcă să modifici filtrele.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(review => {
              const clientName = review.reviewer
                ? `${review.reviewer.first_name ?? ''} ${review.reviewer.last_name ?? ''}`.trim() || 'Client'
                : 'Client'
              const serviceName = review.task?.categories?.name ?? review.task?.title ?? null
              const isHelpful = helpfulSet.has(review.id)
              const isReplying = replyingTo === review.id
              const tags = Array.isArray(review.tags) ? review.tags : []
              const photos = Array.isArray(review.photos) ? review.photos : []

              return (
                <div key={review.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={clientName} avatarUrl={review.reviewer?.avatar_url} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">{clientName}</span>
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                            <CheckCircle className="w-3 h-3" /> Verificat
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StarRow value={review.rating} />
                          <span className="text-xs text-gray-400">{fmtDate(review.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {serviceName && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg flex-shrink-0 ml-2">
                        {serviceName}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  {review.title && <h4 className="font-bold text-gray-800 mb-1.5">{review.title}</h4>}
                  {review.description && <p className="text-sm text-gray-600 leading-relaxed mb-3">{review.description}</p>}

                  {/* Photos */}
                  {photos.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                      {photos.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {tags.map((tag, i) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg font-medium">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Owner reply */}
                  {review.owner_reply && !isReplying && (
                    <div className="bg-blue-50 rounded-xl p-4 mb-3 border-l-4 border-blue-400">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {myAvatar
                            ? <img src={myAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                            : <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">{myName[0]}</div>
                          }
                          <span className="font-bold text-gray-800 text-sm">{myName || 'Tu'}</span>
                          <span className="text-xs text-gray-400">{fmtDate(review.owner_reply_at)}</span>
                        </div>
                        <button onClick={() => startReply(review)}
                          className="text-xs text-blue-600 hover:underline">Editează</button>
                      </div>
                      <p className="text-sm text-gray-700">{review.owner_reply}</p>
                    </div>
                  )}

                  {/* Client reply to handyman */}
                  {review.client_reply && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-3 border-l-4 border-gray-300">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar
                          name={review.reviewer ? `${review.reviewer.first_name ?? ''} ${review.reviewer.last_name ?? ''}`.trim() : 'Client'}
                          avatarUrl={review.reviewer?.avatar_url}
                        />
                        <div>
                          <span className="font-bold text-gray-800 text-sm">
                            {review.reviewer ? `${review.reviewer.first_name ?? ''} ${review.reviewer.last_name ?? ''}`.trim() || 'Client' : 'Client'}
                          </span>
                          <p className="text-xs text-gray-400">{fmtDate(review.client_reply_at)}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{review.client_reply}</p>
                    </div>
                  )}

                  {/* Reply form */}
                  {isReplying && (
                    <div className="mb-3 border border-blue-200 rounded-xl p-3 bg-blue-50">
                      <p className="text-xs font-bold text-blue-700 mb-2">
                        {editingReply ? 'Editează răspunsul tău' : 'Răspunde la această recenzie'}
                      </p>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={3}
                        placeholder="Scrie răspunsul tău..."
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => { setReplyingTo(null); setReplyText('') }}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                          <X className="w-3.5 h-3.5" /> Anulează
                        </button>
                        <button onClick={() => submitReply(review.id)} disabled={replySaving || !replyText.trim()}
                          className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                          {replySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {editingReply ? 'Salvează' : 'Trimite'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Util?</span>
                      <button onClick={() => toggleHelpful(review.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition
                          ${isHelpful ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'}`}>
                        <ThumbsUp className={`w-3.5 h-3.5 ${isHelpful ? 'fill-green-500' : ''}`} />
                        {review.helpful_count ?? 0}
                      </button>
                      <button onClick={() => toggleNotHelpful(review.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition
                          ${notHelpfulSet.has(review.id) ? 'bg-red-100 text-red-500' : 'text-gray-400 hover:bg-red-50 hover:text-red-500'}`}>
                        <ThumbsDown className={`w-3.5 h-3.5 ${notHelpfulSet.has(review.id) ? 'fill-red-500' : ''}`} />
                        {review.not_helpful_count ?? 0}
                      </button>
                      <button onClick={() => handleShare(review)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition ml-1">
                        <Share2 className="w-3.5 h-3.5" /> Distribuie
                      </button>
                    </div>
                    {!isReplying && !review.owner_reply && (
                      <button onClick={() => startReply(review)}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition">
                        <MessageSquare className="w-4 h-4" /> Răspunde
                      </button>
                    )}
                    {!isReplying && review.owner_reply && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Ai răspuns
                      </span>
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
