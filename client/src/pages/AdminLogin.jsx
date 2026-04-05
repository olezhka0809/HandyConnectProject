import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Eye, EyeOff, Lock } from 'lucide-react'
import logo from '../assets/Logo_pin.png'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setError('Credențiale introduse sunt incorecte.')
      setLoading(false)
      return
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', data.user.id)

    const userRoles = roles?.map(r => r.roles?.name) || []

    if (!userRoles.includes('admin')) {
      await supabase.auth.signOut()
      setError('Acces neautorizat.')
      setLoading(false)
      return
    }

    navigate('/admin/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo + brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-900 border border-gray-800 mb-4 shadow-2xl">
            <img src={logo} alt="HandyConnect" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">HandyConnect</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="w-4 h-px bg-gray-700" />
            <span className="text-gray-500 text-xs uppercase tracking-widest font-medium">Panou Admin</span>
            <span className="w-4 h-px bg-gray-700" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="bg-red-950/60 border border-red-800/60 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="admin@handyconnect.ro"
                required
                autoComplete="email"
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Parolă
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 px-4 py-3 pr-11 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-900/30"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Se autentifică...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Autentificare
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          &copy; {new Date().getFullYear()} HandyConnect — Sistem intern restricționat
        </p>
      </div>
    </div>
  )
}
