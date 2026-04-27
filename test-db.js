import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xlnutoklpjnhzbiknrme.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbnV0b2tscGpuaHpiaWtucm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDYzNTQsImV4cCI6MjA4NzkyMjM1NH0.QW-PTfgS-hSRyDvKkFUwYec908ZaM3pRyJJBxQ1uEL8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('Testing Supabase Connection...')
  // Using a simple rpc call or just fetching a non-existent table to see if we get a network error vs a 404/empty array.
  // We can just try to fetch 1 row from a table we assume doesn't exist, or just check the connection.
  const { data, error } = await supabase.from('non_existent_table_for_test').select('*').limit(1)
  
  if (error) {
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message.includes('relation "public.non_existent_table_for_test" does not exist')) {
       console.log('SUCCESS: Connected to DB! (Table not found error means connection was successful)')
    } else {
       console.log('Error details:', error)
       console.log('FAILED: Something went wrong.')
    }
  } else {
    console.log('SUCCESS: Connected to DB!')
  }
}

testConnection()
