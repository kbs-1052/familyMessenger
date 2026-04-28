import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xlnutoklpjnhzbiknrme.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnV0b2tscGpuaHpiaWtucm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDYzNTQsImV4cCI6MjA4NzkyMjM1NH0.QW-PTfgS-hSRyDvKkFUwYec908ZaM3pRyJJBxQ1uEL8'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runPerfTest() {
  console.log('--- Perf Test Start ---')
  const familyCode = 'kimfamily' // Or whatever the most common is

  console.log('--- Checking family_members ---')
  console.time('UpsertTime')
  const { data, error } = await supabase.from('family_members').upsert([
    { family_code: 'kimfamily', username: '테스트' }
  ], { onConflict: 'family_code, username' })
  console.timeEnd('UpsertTime')

  if (error) {
    console.error(`ERROR:`, error)
  } else {
    console.log(`OK!`, data)
  }
  process.exit(0)
}

runPerfTest()
