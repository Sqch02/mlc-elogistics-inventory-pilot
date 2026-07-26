/**
 * Liste des commandes qui VONT etre refusees par Sendcloud, avec la correction
 * exacte de chacune.
 *
 * A quoi ca sert. Sendcloud ne remplit le champ `errors` d'une commande qu'au
 * moment ou l'on tente de creer l'etiquette. L'exploitation decouvre donc les
 * erreurs en lot, le soir, et les corrige une par une a la main. Ce script
 * applique les memes regles a l'avance et dit, pour chaque commande, ce qu'il
 * faut ecrire dans le champ adresse.
 *
 * Pourquoi ce n'est pas automatise. L'API Sendcloud ne permet PAS de modifier
 * une commande importee : seul le crayon du panneau le fait. Verifie le 27/07 —
 * la ressource individuelle renvoie 404 et le changelog officiel de l'Order API
 * v3 ne decrit qu'un sens panneau -> API. Tant que cela n'evolue pas, la
 * correction reste manuelle et ce script sert a la rendre mecanique.
 *
 * Lecture seule : aucune ecriture, ni chez Sendcloud ni en base.
 *
 * Usage :
 *   npx tsx scripts/liste-corrections-sendcloud.mts <nom-du-tenant> [fichier-de-sortie]
 *   npx tsx scripts/liste-corrections-sendcloud.mts florna
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { detectAutoFixCause } from '../src/lib/auto-fix/detect'
import { OBSERVED_RULES } from '../src/lib/auto-fix/validate'
import { planAddressShortening, type AddressLimit } from '../src/lib/auto-fix/address'

async function main(): Promise<void> {
  const TENANT = process.argv[2]
  const SORTIE = process.argv[3]

  if (!TENANT) {
    console.error('Usage : npx tsx scripts/liste-corrections-sendcloud.mts <nom-du-tenant> [fichier]')
    process.exit(1)
  }

  const envRaw = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : ''
  const env = (key: string): string => {
    const match = envRaw.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'))
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
  }

  const url = env('NEXT_PUBLIC_SUPABASE_URL') || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.')
    process.exit(1)
  }

  const sb = createClient(url, key)

  const { data: tenant } = await sb.from('tenants').select('id, name').ilike('name', `%${TENANT}%`).limit(1).single()
  if (!tenant) {
    console.error(`Tenant introuvable pour "${TENANT}".`)
    process.exit(1)
  }

  const { data: settings } = await sb
    .from('tenant_settings')
    .select('sendcloud_api_key, sendcloud_secret')
    .eq('tenant_id', tenant.id)
    .single()

  if (!settings?.sendcloud_api_key || !settings?.sendcloud_secret) {
    console.error(`Aucune cle Sendcloud pour ${tenant.name}.`)
    process.exit(1)
  }

  // Les cles ne transitent que vers Sendcloud, jamais vers la sortie.
  const auth = 'Basic ' + Buffer.from(`${settings.sendcloud_api_key}:${settings.sendcloud_secret}`).toString('base64')
  const appel = (u: string) => fetch(u, { headers: { Authorization: auth } })

  const integrationsRes = await appel('https://panel.sendcloud.sc/api/v2/integrations')
  const integrationsBody = await integrationsRes.json()
  const integrations: Array<{ id: number; system?: string }> = Array.isArray(integrationsBody)
    ? integrationsBody
    : integrationsBody.integrations ?? []

  const commandes: Array<Record<string, unknown>> = []
  for (const integration of integrations) {
    // L'integration 'api' est la notre : elle ne porte pas de commandes boutique.
    if (integration.system === 'api') continue
    let suivante: string | null = `https://panel.sendcloud.sc/api/v2/integrations/${integration.id}/shipments?limit=100`
    for (let page = 1; suivante && page <= 20; page++) {
      const res: Response = await appel(suivante)
      if (!res.ok) break
      const body = await res.json()
      commandes.push(...(body.results ?? []))
      suivante = body.next ?? null
    }
  }

  const estAnnulee = (c: Record<string, unknown>): boolean => {
    const statut = c.order_status as { id?: string } | undefined
    return /cancel|annul/i.test(statut?.id ?? '')
  }

  const aTraiter = commandes.filter((c) => !estAnnulee(c))

  const sures: string[] = []
  const aTrancher: string[] = []
  const autres: string[] = []

  for (const commande of aTraiter) {
    const detection = detectAutoFixCause(commande, 'integration_shipment', { latentRules: OBSERVED_RULES })
    if (!detection) continue
    const ref = String(commande.order_number ?? '?')

    if (!detection.detectedPatterns.includes('address_too_long')) {
      autres.push(`${ref}   cause : ${detection.detectedPatterns.join(', ')}`)
      continue
    }

    const limites = detection.sourceSummary.address_limits as unknown as AddressLimit[]
    const plan = planAddressShortening(commande, limites)
    const avant = String(commande.address ?? '')
    const apres = plan.patch.address ?? avant
    const complement = plan.patch.address_2

    if (plan.ready) {
      sures.push(
        `${ref}\n` +
          `   remplacer   ${avant}\n` +
          `   par         ${apres}` +
          (complement ? `\n   et mettre dans le complement d'adresse (vide aujourd'hui)   ${complement}` : ''),
      )
    } else {
      aTrancher.push(
        `${ref}\n` +
          `   actuel        ${avant}   (${avant.length} caracteres, maximum 32)\n` +
          `   proposition   ${apres}\n` +
          `   a verifier : une information disparait, la destination peut changer.`,
      )
    }
  }

  const rapport = [
    `${tenant.name} — commandes qui vont etre refusees par Sendcloud`,
    '',
    `${aTraiter.length} commandes en attente examinees.`,
    `${sures.length + aTrancher.length + autres.length} a corriger.`,
    '',
    `${sures.length} CORRECTIONS SÛRES — aucune information perdue`,
    '',
    ...sures,
    '',
    `${aTrancher.length} A TRANCHER — la coupe peut changer la destination`,
    '',
    ...aTrancher,
    ...(autres.length ? ['', `${autres.length} AUTRES CAUSES`, '', ...autres] : []),
  ].join('\n')

  console.log(rapport)
  if (SORTIE) {
    writeFileSync(SORTIE, rapport)
    console.log(`\nEcrit dans ${SORTIE}`)
  }

}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
