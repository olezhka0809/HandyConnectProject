import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function AdminProtectedRoute({ children }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        navigate('/hc-portal')
        return
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)

      const userRoles = roles?.map(r => r.roles?.name) || []

      if (!userRoles.includes('admin')) {
        navigate('/hc-portal')
        return
      }

      setAuthorized(true)
      setLoading(false)
    }

    checkAdmin()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return authorized ? children : null
}
