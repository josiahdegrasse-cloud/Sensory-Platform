import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Reuse existing client across HMR reloads to prevent NavigatorLock conflicts
const g = globalThis as typeof globalThis & { __supabase?: SupabaseClient }

if (!g.__supabase) {
  g.__supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}

export const supabase = g.__supabase
