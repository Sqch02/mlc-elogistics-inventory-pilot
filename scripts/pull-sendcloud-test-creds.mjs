// Récupère les clés Sendcloud d'Anteos depuis la base et les écrit dans .env.local
// comme SENDCLOUD_TEST_*. Les clés ne sont JAMAIS affichées (DB -> fichier direct).
// Usage : node scripts/pull-sendcloud-test-creds.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync, appendFileSync, existsSync } from 'node:fs'

const TENANT = 'anteos'

const envRaw = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : ''
const get = (k) => {
  const m = envRaw.match(new RegExp('^' + k + '\\s*=\\s*(.*)$', 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}

const url = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL')
const svc = get('SUPABASE_SERVICE_ROLE_KEY')

if (!url || !svc) {
  console.error('Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.')
  process.exit(1)
}

if (envRaw.includes('SENDCLOUD_TEST_API_KEY=')) {
  console.log('SENDCLOUD_TEST_* est deja present dans .env.local — rien fait.')
  process.exit(0)
}

const sb = createClient(url, svc)

const { data: tenant, error: tErr } = await sb
  .from('tenants').select('id, name').ilike('name', TENANT).single()
if (tErr || !tenant) {
  console.error('Tenant Anteos introuvable :', tErr?.message || 'aucun resultat')
  process.exit(1)
}

const { data: ts, error: sErr } = await sb
  .from('tenant_settings')
  .select('sendcloud_api_key, sendcloud_secret')
  .eq('tenant_id', tenant.id).single()
if (sErr || !ts?.sendcloud_api_key || !ts?.sendcloud_secret) {
  console.error('Cles Sendcloud Anteos absentes en base :', sErr?.message || 'champs vides')
  process.exit(1)
}

appendFileSync(
  '.env.local',
  `\n# Sendcloud test creds (Anteos) - validation ecriture phase 2\n` +
  `SENDCLOUD_TEST_API_KEY=${ts.sendcloud_api_key}\n` +
  `SENDCLOUD_TEST_SECRET=${ts.sendcloud_secret}\n` +
  `SENDCLOUD_WRITE_VALIDATION_ENABLED=false\n`,
)

console.log('OK - cles Anteos ajoutees a .env.local (SENDCLOUD_TEST_API_KEY, SENDCLOUD_TEST_SECRET, SENDCLOUD_WRITE_VALIDATION_ENABLED=false).')
console.log('Les cles n ont PAS ete affichees.')
