import { createClient } from '@supabase/supabase-js'

// 환경 변수에서 Supabase 설정 불러오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
