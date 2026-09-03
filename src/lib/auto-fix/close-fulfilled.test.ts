import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { closeFulfilledOrders } from './close-fulfilled'

function client(candidats: Array<{ id: string; source_order_ref: string }>) {
  const appels: Array<{ name: string; args: Record<string, unknown> }> = []
  return {
    appels,
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      appels.push({ name, args })
      if (name === 'pending_manual_order_candidates') return { data: candidats, error: null }
      if (name === 'close_auto_fix_job_obsolete') return { data: true, error: null }
      return { data: null, error: null }
    }),
  }
}
const creds = { apiKey: 'k', secret: 's' }
const commande = (code: string) => ({
  ok: true as const,
  order: { id: 'x', order_number: '#1', order_details: { status: { code } } },
})

describe('fermeture des taches dont la commande est partie', () => {
  it('referme une commande fulfilled, avec le statut lu en detail', async () => {
    const c = client([{ id: 'j1', source_order_ref: '#1' }])
    const res = await closeFulfilledOrders(c, 't', creds, 50, false, {
      findOrder: vi.fn(async () => commande('fulfilled')),
    })
    expect(res.closed).toBe(1)
    const cloture = c.appels.find((a) => a.name === 'close_auto_fix_job_obsolete')
    expect(cloture?.args.p_reason).toBe('order_not_corrigible')
    expect(String(cloture?.args.p_detail)).toContain('fulfilled')
  })

  it('NE referme PAS une commande encore corrigeable, mais l horodate', async () => {
    // C'est la garde qui fait toute la difference avec un coup de balai : une
    // commande on_hold est du vrai travail en attente.
    const c = client([{ id: 'j1', source_order_ref: '#1' }])
    const res = await closeFulfilledOrders(c, 't', creds, 50, false, {
      findOrder: vi.fn(async () => commande('on_hold')),
    })
    expect(res.closed).toBe(0)
    expect(res.stillOpen).toBe(1)
    expect(c.appels.some((a) => a.name === 'close_auto_fix_job_obsolete')).toBe(false)
    expect(c.appels.some((a) => a.name === 'touch_auto_fix_job_checked')).toBe(true)
  })

  it('ne conclut rien d une commande introuvable', async () => {
    // Introuvable n'est pas « partie » : ce peut etre un mauvais numero.
    const c = client([{ id: 'j1', source_order_ref: '#1' }])
    const res = await closeFulfilledOrders(c, 't', creds, 50, false, {
      findOrder: vi.fn(async () => ({ ok: false as const, reason: 'not_found' as const })),
    })
    expect(res.notFound).toBe(1)
    expect(res.closed).toBe(0)
    expect(c.appels.some((a) => a.name === 'close_auto_fix_job_obsolete')).toBe(false)
  })

  it('en simulation, ne touche a rien', async () => {
    const c = client([{ id: 'j1', source_order_ref: '#1' }])
    const res = await closeFulfilledOrders(c, 't', creds, 50, true, {
      findOrder: vi.fn(async () => commande('fulfilled')),
    })
    expect(res.closed).toBe(1)
    expect(c.appels.filter((a) => a.name !== 'pending_manual_order_candidates')).toEqual([])
  })

  it('un echec de lecture des candidats compte comme un echec', async () => {
    const c = { rpc: vi.fn(async () => ({ data: null, error: { message: 'timeout' } })) }
    const res = await closeFulfilledOrders(c, 't', creds, 50, false)
    expect(res.errors).toBe(1)
    expect(res.scanned).toBe(0)
  })

  it('la migration ne referme que pending_manual, sans ecriture commencee', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/00130_fermer_les_taches_manuelles_dont_la_commande_est_partie.sql'),
      'utf8',
    )
    expect(sql).toContain("AND state = 'pending_manual'")
    expect(sql).toContain('AND write_started_at IS NULL')
    expect(sql).toContain("j.source_kind = 'integration_shipment'")
    expect(sql).toContain('LEAST(p_limit, 100)')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.close_auto_fix_job_obsolete(uuid, text, text) FROM PUBLIC')
  })
})
