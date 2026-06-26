import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './db/database.types'

// Reuse existing client across HMR reloads to prevent NavigatorLock conflicts
const g = globalThis as typeof globalThis & { __supabase?: SupabaseClient<Database> }

if (!g.__supabase) {
  g.__supabase = createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}

export const supabase = g.__supabase
