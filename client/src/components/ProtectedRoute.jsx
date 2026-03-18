import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function ProtectedRoute({ children, allowedRoles = [], requireOnboarding = true }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        navigate('/login')
        return
      }

      // Verifică rolul
      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)

      const userRoles = roles?.map(r => r.roles.name) || []
      const hasAccess = allowedRoles.length === 0 || allowedRoles.some(role => userRoles.includes(role))

      if (!hasAccess) {
        navigate('/')
        return
      }

      // Verifică dacă a completat onboarding-ul
      if (requireOnboarding) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single()

        if (!profile?.onboarding_completed) {
          navigate(userRoles.includes('handyman') ? '/handyman-onboarding' : '/onboarding')
          return
        }
      }

      setAuthorized(true)
      setLoading(false)
    }

    checkAccess()
  }, [navigate, allowedRoles, requireOnboarding])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return authorized ? children : null
}