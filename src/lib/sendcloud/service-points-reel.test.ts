import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { getServicePoint, findReplacementServicePoint } from './service-points'

const REEL = process.env.TEST_SERVICE_POINTS_REEL

describe.skipIf(!REEL)('confrontation a l API reelle', () => {
  it('retrouve le transporteur et propose un remplacant du meme reseau', async () => {
    const env = readFileSync('.env.local', 'utf8')
    const get = (k: string) =>
      (env.match(new RegExp('^' + k + '\\s*=\\s*(.*)$', 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
    const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'))
    const { data } = await sb
      .from('tenant_settings')
      .select('sendcloud_api_key, sendcloud_secret')
      .eq('tenant_id', 'f1073a00-0000-4000-a000-000000000001')
      .single()

    const credentials = { apiKey: data!.sendcloud_api_key!, secret: data!.sendcloud_secret! }

    const lu = await getServicePoint(credentials, '11627787')
    expect(lu.ok).toBe(true)
    if (!lu.ok) return
    console.log(`point d origine : ${lu.point.carrier} — ${lu.point.name} — ${lu.point.city}`)

    const remplacant = await findReplacementServicePoint(credentials, {
      carrier: lu.point.carrier,
      country: lu.point.country ?? 'FR',
      postalCode: lu.point.postal_code ?? '11000',
      origin: lu.point,
      excludeId: lu.point.id,
    })

    expect(remplacant.ok).toBe(true)
    if (!remplacant.ok) return
    console.log(
      `remplacant : ${remplacant.point.carrier} — ${remplacant.point.name} — ${remplacant.point.city}\n`
      + `   rayon ${remplacant.radius} m, distance ${remplacant.distanceKm?.toFixed(2)} km, `
      + `${remplacant.alternatives} autres possibles`,
    )

    // La regle qui ne se negocie pas.
    expect(remplacant.point.carrier).toBe(lu.point.carrier)
    expect(remplacant.point.is_active).toBe(true)
    expect(String(remplacant.point.id)).not.toBe(String(lu.point.id))
  })
})
