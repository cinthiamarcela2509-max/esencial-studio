import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zopnqimfigufrurtmbao.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcG5xaW1maWd1ZnJ1cnRtYmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4Nzk4OTUsImV4cCI6MjA5NzQ1NTg5NX0._qm5mGFp8A-4tHoeqYp6tBQIVIhWAkrqy-AINzqbDEA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
