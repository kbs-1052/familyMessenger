import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xlnutoklpjnhzbiknrme.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnV0b2tscGpuaHpiaWtucm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDYzNTQsImV4cCI6MjA4NzkyMjM1NH0.QW-PTfgS-hSRyDvKkFUwYec908ZaM3pRyJJBxQ1uEL8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInsert() {
  console.log('Attempting to insert test data...')
  const { data, error } = await supabase.from('family_auth').insert([
    { access_code: 'kimfamily', password: '1234', family_name: '김씨네 가족' }
  ]).select()
  
  if (error) {
    console.log('Insert FAILED. Error code:', error.code)
    console.log('Error message:', error.message)
  } else {
    console.log('Insert SUCCESS! Data:', data)
  }
}

testInsert()
