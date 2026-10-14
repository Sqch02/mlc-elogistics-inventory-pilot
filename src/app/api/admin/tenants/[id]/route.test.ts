import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, PATCH } from './route'
import { requireRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const PROFILS = [
  { id: 'actif', email: 'actif@client.test', role: 'client', created_at: '2026-09-21' },
  { id: 'banni', email: 'banni@client.test', role: 'client', created_at: '2026-09-21' },
  { id: 'echu', email: 'echu@client.test', role: 'client', created_at: '2026-09-21' },
  { id: 'injoignable', email: 'injoignable@client.test', role: 'client', created_at: '2026-09-21' },
]

const BANNI_JUSQU_A: Record<string, string | undefined> = {
  actif: undefined,
  banni: '2126-09-20T06:19:37.530857Z',
  echu: '2020-01-01T00:00:00Z',
}

function adminClient() {
  const getUserById = vi.fn(async (id: string) => (
    id === 'injoignable'
      ? { data: { user: null }, error: { message: 'service unavailable' } }
      : { data: { user: { id, banned_until: BANNI_JUSQU_A[id] } }, error: null }
  ))
  const ligne = (data: unknown) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error: null }),
        then: (resoudre: (r: unknown) => unknown) => resoudre({ data, error: null }),
      })),
    })),
  })
  const from = vi.fn((table: string) => {
    if (table === 'tenants') return ligne({ id: 't1', name: 'VITALIENCE' })
    if (table === 'tenant_settings') return ligne({ tenant_id: 't1' })
    return ligne(PROFILS)
  })
  return { client: { from, auth: { admin: { getUserById } } }, getUserById }
}

describe('GET /api/admin/tenants/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(undefined as never)
  })

  it('donne l etat d acces de chaque utilisateur, lu dans Supabase Auth', async () => {
    const { client, getUserById } = adminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const response = await GET(
      new NextRequest('https://example.test/api/admin/tenants/t1'),
      { params: Promise.resolve({ id: 't1' }) },
    )

    expect(response.status).toBe(200)
    const { users } = await response.json()
    const etat = Object.fromEntries(users.map((u: { id: string; disabled: boolean | null }) => [u.id, u.disabled]))
    expect(etat).toEqual({ actif: false, banni: true, echu: false, injoignable: null })
    expect(getUserById).toHaveBeenCalledTimes(PROFILS.length)
  })

  it('est reserve au super_admin', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await GET(
      new NextRequest('https://example.test/api/admin/tenants/t1'),
      { params: Promise.resolve({ id: 't1' }) },
    )

    expect(response.status).not.toBe(200)
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['super_admin'])
  })
})

describe('PATCH /api/admin/tenants/[id] : emails envoyes au client', () => {
  function clientPourPatch() {
    const ecritures: Array<{ table: string; champs: Record<string, unknown> }> = []
    const from = vi.fn((table: string) => ({
      update: vi.fn((champs: Record<string, unknown>) => {
        ecritures.push({ table, champs })
        return { eq: vi.fn().mockResolvedValue({ error: null }) }
      }),
      insert: vi.fn((champs: Record<string, unknown>) => {
        ecritures.push({ table, champs })
        return Promise.resolve({ error: null })
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'reglages-1' }, error: null }) })),
      })),
    }))
    return { client: { from }, ecritures }
  }

  const envoyer = (corps: Record<string, unknown>) => PATCH(
    new NextRequest('https://example.test/api/admin/tenants/t1', { method: 'PATCH', body: JSON.stringify(corps) }),
    { params: Promise.resolve({ id: 't1' }) },
  )

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(undefined as never)
  })

  it('enregistre les adresses nettoyees, et un champ vide devient null', async () => {
    // La base saute l'envoi quand l'adresse est vide ; '' et null doivent
    // donc dire la meme chose, et on ne garde que null.
    const { client, ecritures } = clientPourPatch()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const response = await envoyer({ invoice_email: '  compta@vitalience.fr ', stock_alert_email: '', inbound_email: null })

    expect(response.status).toBe(200)
    const reglages = ecritures.find((e) => e.table === 'tenant_settings')!.champs
    expect(reglages).toMatchObject({ invoice_email: 'compta@vitalience.fr', stock_alert_email: null, inbound_email: null })
  })

  it('refuse une adresse invalide sans rien enregistrer du reste de la fiche', async () => {
    const { client, ecritures } = clientPourPatch()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    // Deux adresses dans un champ : elles partiraient telles quelles comme
    // destinataire unique.
    const response = await envoyer({ name: 'VITALIENCE', invoice_email: 'a@client.fr, b@client.fr' })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('une seule adresse') })
    expect(ecritures).toEqual([])
  })

  it('ne touche pas aux adresses absentes de la requete', async () => {
    const { client, ecritures } = clientPourPatch()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await envoyer({ name: 'VITALIENCE' })

    const reglages = ecritures.find((e) => e.table === 'tenant_settings')!.champs
    expect(reglages).not.toHaveProperty('invoice_email')
    expect(reglages).not.toHaveProperty('stock_alert_email')
  })

  it('accepte chaque reglage que la fiche client envoie', () => {
    // La fiche envoie tout son etat de reglages ; un champ absent de la liste
    // de la route serait jete sans erreur (cf. les listes blanches qui ont
    // deja perdu des donnees).
    const fiche = readFileSync(join(process.cwd(), 'src/app/(admin)/admin/tenants/[id]/page.tsx'), 'utf8')
    const route = readFileSync(join(process.cwd(), 'src/app/api/admin/tenants/[id]/route.ts'), 'utf8')
    const bloc = fiche.slice(fiche.indexOf('interface TenantSettings {'), fiche.indexOf('}', fiche.indexOf('interface TenantSettings {')))
    const envoyes = [...bloc.matchAll(/^\s+(\w+):/gm)].map((m) => m[1])
    expect(envoyes).toEqual(expect.arrayContaining(['invoice_email', 'stock_alert_email', 'inbound_email']))
    for (const champ of envoyes) expect(route, champ).toContain(`'${champ}'`)
  })
})
