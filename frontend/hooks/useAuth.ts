'use client'
// LOCATION: frontend/hooks/useAuth.ts
// Fixed: session persists across page refreshes
// Supabase stores the session in localStorage automatically —
// we just need to read it correctly on mount

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export function useAuth() {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ✅ getSession() reads from localStorage — persists across refreshes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // ✅ Listen for all auth changes: login, logout, token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // State updates handled by onAuthStateChange above
  }, [])

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!user,
    accessToken: session?.access_token ?? null,
  }
}