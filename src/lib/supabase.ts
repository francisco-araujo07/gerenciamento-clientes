import { createClient } from '@supabase/supabase-js'
import { publicConfig } from '../utils/public-config'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function initialize() {
  try {
    const config = publicConfig(supabaseUrl, supabaseAnonKey, import.meta.env.DEV)
    return createClient(config.url, config.key, {
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) },
    })
  } catch { return null }
}
export const supabase = initialize()
export const isSupabaseConfigured = Boolean(supabase)
