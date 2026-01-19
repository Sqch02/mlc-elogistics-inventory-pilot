import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load env vars from .env.local
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createSuperAdmin() {
  const email = 'aurelien@famillia.fr'
  const password = 'Famillia2024!'
  const fullName = 'Aurélien Famillia'
  const tenantId = '00000000-0000-0000-0000-000000000001' // FLORNA tenant

  console.log(`Creating super_admin account for ${email}...`)

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    console.error('Auth error:', authError.message)
    process.exit(1)
  }

  console.log('Auth user created:', authData.user.id)

  // Update profile to super_admin (trigger already created it with 'ops' role)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role: 'super_admin',
      full_name: fullName,
    })
    .eq('id', authData.user.id)

  if (profileError) {
    console.error('Profile error:', profileError.message)
    // Rollback: delete auth user
    await supabase.auth.admin.deleteUser(authData.user.id)
    process.exit(1)
  }

  console.log('✅ Super admin account created successfully!')
  console.log('')
  console.log('📧 Email:', email)
  console.log('🔑 Password:', password)
  console.log('👤 Role: super_admin')
}

createSuperAdmin()
