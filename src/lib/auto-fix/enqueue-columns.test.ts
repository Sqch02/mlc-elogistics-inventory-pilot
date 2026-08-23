import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ParsedShipment } from '@/lib/sendcloud/types'
import { buildAutoFixCandidate } from './queue'

/**
 * Chaque champ produit par le code doit etre accepte par la fonction qui
 * insere la tache.
 *
 * `enqueue_auto_fix_jobs` declare explicitement les colonnes qu'elle extrait
 * du JSON via `jsonb_to_recordset`. Un champ absent de cette liste est jete
 * EN SILENCE : aucune erreur, aucune trace, la valeur disparait simplement.
 *
 * C'est arrive avec `source_order_ref`. La migration 00116 avait ajoute la
 * colonne, la PR #107 avait appris au moteur a la lire, et personne n'avait
 * regarde le maillon du milieu. Resultat mesure le 24/08 : sur 303 taches
 * creees en dix jours, le hachage renseigne 303 fois et le numero en clair
 * zero fois — alors que les deux viennent de la meme ligne de code.
 *
 * Ce test ne verifie pas UN champ, il verifie la correspondance entiere. Le
 * prochain champ ajoute sera couvert sans que personne y pense.
 */
const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00121_enqueue_numero_de_commande.sql'),
  'utf8',
)

function shipmentFixture(): ParsedShipment {
  return {
    sendcloud_id: '123',
    shipped_at: '2026-08-24T08:00:00.000Z',
    carrier: 'mondial_relay', service: null, weight_grams: 500,
    order_ref: '#552926', tracking: null,
    raw_json: {
      id: 123,
      address: 'une rue beaucoup trop longue pour tenir dans la limite',
      errors: { address: ['Address too long, maximum 32 characters'] },
    } as never,
    recipient_name: 'Personne', recipient_email: 'x@example.com',
    recipient_phone: '+33123456789', recipient_company: null,
    address_line1: 'une rue beaucoup trop longue pour tenir dans la limite',
    address_line2: null, house_number: '10',
    city: 'Paris', postal_code: '75001', country_code: 'FR', country_name: 'France',
    status_id: 1002, status_message: 'Announcement failed', tracking_url: null,
    label_url: null, total_value: 10, currency: 'EUR', service_point_id: null,
    is_return: false, collo_count: 1, length_cm: null, width_cm: null, height_cm: null,
    external_order_id: null, date_created: '2026-08-24T08:00:00.000Z',
    date_updated: '2026-08-24T08:01:00.000Z', date_announced: null,
    has_error: true, error_message: 'Address too long',
  }
}

describe('correspondance code / fonction d insertion', () => {
  const candidate = buildAutoFixCandidate(
    '00000000-0000-0000-0000-000000000001',
    { shipmentId: 'shipment-1', shipment: shipmentFixture() },
    { defaultHsCode: null, defaultOriginCountry: null },
    null,
    'live',
  )

  it('produit bien une tache a partir du montage de test', () => {
    // Sans cette garde, un montage devenu invalide rendrait le test suivant
    // vide — donc toujours vert, et donc inutile.
    expect(candidate).not.toBeNull()
    expect(Object.keys(candidate ?? {}).length).toBeGreaterThan(10)
  })

  it('declare chaque champ produit dans le recordset de la fonction', () => {
    const declaration = sql.slice(
      sql.indexOf('jsonb_to_recordset'),
      sql.indexOf('), upserted AS'),
    )
    const manquants = Object.keys(candidate ?? {}).filter(
      (champ) => !new RegExp(`\\b${champ}\\b`).test(declaration),
    )
    expect(manquants).toEqual([])
  })

  it('insere effectivement chaque champ declare', () => {
    const insertion = sql.slice(
      sql.indexOf('INSERT INTO public.auto_fix_jobs ('),
      sql.indexOf('FROM input i'),
    )
    const manquants = Object.keys(candidate ?? {}).filter(
      (champ) => !new RegExp(`\\b${champ}\\b`).test(insertion),
    )
    expect(manquants).toEqual([])
  })

  it('ne perd pas le numero de commande fige', () => {
    expect(candidate?.source_order_ref).toBe('#552926')
    expect(sql).toContain('source_order_ref = COALESCE(auto_fix_jobs.source_order_ref, EXCLUDED.source_order_ref)')
  })
})
