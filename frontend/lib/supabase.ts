// LOCATION: frontend/lib/supabase.ts
// Session is stored in localStorage automatically by Supabase client
// This means it persists across page refreshes WITHOUT any extra code
// The key is passing persistSession: true (which is the default)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL)      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set in frontend/.env.local')
if (!SUPABASE_ANON_KEY) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in frontend/.env.local')

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,        // ✅ saves session to localStorage
    autoRefreshToken:  true,        // ✅ auto-refreshes before expiry
    detectSessionInUrl: true,       // ✅ handles magic link / OAuth redirects
    storageKey: 'warroom-auth',     // custom key so it doesn't clash
  },
})