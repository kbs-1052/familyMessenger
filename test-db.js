import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xlnutoklpjnhzbiknrme.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnV0b2tscGpuaHpiaWtucm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDYzNTQsImV4cCI6MjA4NzkyMjM1NH0.QW-PTfgS-hSRyDvKkFUwYec908ZaM3pRyJJBxQ1uEL8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('Testing Supabase Connection...')
  
  console.time('SupabaseRequest')
  const { data, error } = await supabase.from('messages').insert([{
    room_id: 1,
    sender: '테스트',
    text: '테스트 메시지',
    time: '오후 1:00',
    image_url: null,
    family_code: 'kimfamily',
    type: 'text',
    poll_data: null,
    read_by: ''
  }])
  console.timeEnd('SupabaseRequest')

  if (error) {
    console.error(`INSERT ERROR:`, error)
  } else {
    console.log(`INSERT OK!`)
  }
  process.exit(0)
}

testConnection()
