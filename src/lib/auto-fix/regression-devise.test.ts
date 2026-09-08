import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detecterRegressionsDevise, devisesRestantes } from './regression-devise'

const identifiants = { apiKey: 'k', secret: 's' }
const argent = (value: number, currency: string) => ({ value, currency })

function commande(devise: string, statut: string) {
  return {
    ok: true as const,
    order: {
      id: 'x', order_details: { status: { code: statut } },
      payment_details: {
        subtotal_price: argent(91.44, devise),
        estimated_shipping_price: argent(0, devise),
        total_price: argent(91.44, devise),
      },
    },
  }
}

function client(
  candidats: Array<{ id: string; source_order_ref: string; parcel_blocked?: boolean }>,
  erreur: unknown = null,
) {
  const appels: Array<{ nom: string; args: Record<string, unknown> }> = []
  return {
    appels,
    rpc: vi.fn(async (nom: string, args: Record<string, unknown>) => {
      appels.push({ nom, args })
      if (nom === 'verified_currency_candidates') return { data: candidats, error: erreur }
      return { data: true, error: null }
    }),
  }
}

describe('detection des conversions de devise defaites', () => {
  it('signale une commande revenue en francs et encore ouverte', async () => {
    const c = client([{ id: 'j1', source_order_ref: '#560195' }])
    const res = await detecterRegressionsDevise(c, 't', identifiants, 10, false, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findOrder: (async () => commande('CHF', 'on_hold')) as any,
    })
    expect(res.reverted).toBe(1)
    expect(res.samples[0]).toEqual({ order_ref: '#560195', status: 'on_hold', currencies: ['CHF'] })
    expect(c.appels.map((a) => a.nom)).toContain('flag_auto_fix_currency_regression')
  })

  it('signale une commande dont le COLIS est bloque, meme si elle n est plus corrigeable', async () => {
    // Les onze colis Delivengo des 07 et 08/09 : conversion marquee verifiee,
    // commande plus corrigeable parce qu'un colis existe, et pourtant le colis
    // n'est jamais parti. Le franc revenu est ce que le transporteur refuse.
    // C'etaient les cas les plus graves, et les seuls que la detection ecartait.
    const c = client([{ id: 'j1', source_order_ref: '#559113', parcel_blocked: true }])
    const res = await detecterRegressionsDevise(c, 't', identifiants, 10, false, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findOrder: (async () => commande('CHF', 'fulfilled')) as any,
    })
    expect(res.reverted).toBe(1)
    expect(res.blockedParcels).toBe(1)
    expect(res.revertedButShipped).toBe(0)
    expect(res.samples[0].status).toContain('colis bloque')
    expect(c.appels.map((a) => a.nom)).toContain('flag_auto_fix_currency_regression')
  })

  it('ne signale pas une commande revenue en francs mais deja partie', async () => {
    // La conversion avait tenu le temps de faire l'etiquette : rien a dire.
    const c = client([{ id: 'j1', source_order_ref: '#559852', parcel_blocked: false }])
    const res = await detecterRegressionsDevise(c, 't', identifiants, 10, false, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findOrder: (async () => commande('CHF', 'fulfilled')) as any,
    })
    expect(res.revertedButShipped).toBe(1)
    expect(res.reverted).toBe(0)
    expect(c.appels.map((a) => a.nom)).not.toContain('flag_auto_fix_currency_regression')
  })

  it('ne touche a rien quand la conversion tient', async () => {
    const c = client([{ id: 'j1', source_order_ref: '#560292' }])
    const res = await detecterRegressionsDevise(c, 't', identifiants, 10, false, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findOrder: (async () => commande('EUR', 'on_hold')) as any,
    })
    expect(res.stillConverted).toBe(1)
    expect(c.appels.map((a) => a.nom)).not.toContain('flag_auto_fix_currency_regression')
  })

  it('en simulation, aucune ecriture', async () => {
    const c = client([{ id: 'j1', source_order_ref: '#560195' }])
    await detecterRegressionsDevise(c, 't', identifiants, 10, true, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findOrder: (async () => commande('CHF', 'on_hold')) as any,
    })
    expect(c.appels.map((a) => a.nom)).toEqual(['verified_currency_candidates'])
  })

  it('une erreur de lecture compte comme erreur, pas comme absence de candidat', async () => {
    const c = client([], { message: 'boom' })
    const res = await detecterRegressionsDevise(c, 't', identifiants, 10, true)
    expect(res.errors).toBe(1)
    expect(res.scanned).toBe(0)
  })

  it('lit les devises de tous les montants, y compris melangees', () => {
    expect(devisesRestantes({
      subtotal_price: argent(91.44, 'EUR'), total_price: argent(86, 'CHF'),
    })).toEqual(['CHF', 'EUR'])
    expect(devisesRestantes(null)).toEqual([])
  })

  it('la migration ne signale que des taches verifiees de devise', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/00133_signaler_les_conversions_de_devise_defaites.sql'),
      'utf8',
    )
    expect(sql).toContain("state = 'verified'")
    expect(sql).toContain("primary_pattern = 'currency_chf'")
    // Le signalement ne doit pas pouvoir reprendre une tache deja rouverte.
    expect(sql).toMatch(/WHERE id = p_job_id\s+AND state = 'verified'/)
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.flag_auto_fix_currency_regression(uuid, text) FROM PUBLIC')
  })

  it('les conversions les plus recentes sont relues en premier', () => {
    // Trier par la plus ancienne faisait travailler le balayage sur des
    // commandes parties depuis longtemps : 100 candidates, 100 sans interet.
    // Ce sont les recentes, encore ouvertes, qu'il faut rattraper.
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/00134_relire_les_conversions_les_plus_recentes_d_abord.sql'),
      'utf8',
    )
    expect(sql).toContain('ORDER BY j.verified_at DESC')
  })

  it('le candidat porte l etat du colis, statut 1002 compris', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/00136_un_colis_en_echec_d_annonce_n_est_pas_parti.sql'),
      'utf8',
    )
    expect(sql).toContain('parcel_blocked')
    expect(sql).toContain('s.status_id = 1002')
  })
})
