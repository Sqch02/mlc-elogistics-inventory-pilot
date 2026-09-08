import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Un colis en statut 1002 est cree mais n'est jamais parti : le transporteur
 * a refuse l'annonce. Rien ne le signalait. Les 07 et 08/09, 23 colis sont
 * restes ainsi, contre environ un tous les quelques jours en temps normal.
 *
 * Le piege verrouille ici est celui des listes blanches : un type d'evenement
 * ajoute a la base mais absent du rendu partirait en courriel vide, et un type
 * rendu mais absent de la contrainte ferait echouer l'insertion. Les deux
 * listes doivent se correspondre ENTIEREMENT.
 */
const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00137_alerte_colis_bloques_en_echec_d_annonce.sql'),
  'utf8',
)
const rendu = readFileSync(join(process.cwd(), 'src/lib/notifications/resend-sender.ts'), 'utf8')

function typesAutorisesEnBase(): string[] {
  const bloc = migration.slice(
    migration.indexOf('notification_outbox_event_type_check CHECK'),
    migration.indexOf('CREATE OR REPLACE FUNCTION'),
  )
  return [...bloc.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
}

function typesRendusParLeCourriel(): string[] {
  return [...rendu.matchAll(/message\.event_type === '([a-z_]+)'/g)].map((m) => m[1]).sort()
}

describe('alerte des colis bloques en echec d annonce', () => {
  it('chaque type accepte en base sait se rendre en courriel', () => {
    const enBase = typesAutorisesEnBase()
    const rendus = typesRendusParLeCourriel()
    expect(enBase).toContain('blocked_announcements')
    expect(enBase.filter((t) => !rendus.includes(t))).toEqual([])
  })

  it('compte les colis sur 48 heures, pas 6', () => {
    // Un colis bloque le reste : le decouvrir deux jours plus tard vaut mieux
    // que pas du tout.
    expect(migration).toContain("p_window interval DEFAULT interval '48 hours'")
  })

  it('ne compte que les vrais echecs d annonce, retours exclus', () => {
    expect(migration).toContain('s.status_id = 1002')
    expect(migration).toContain('s.is_return = false')
  })

  it('une seule alerte par client et par tranche de six heures', () => {
    expect(migration).toContain("'blocked_announcements:' || v_tenant.tenant_id::text")
    expect(migration).toContain('ON CONFLICT (idempotency_key) DO NOTHING')
  })

  it('la fonction est reservee au service technique', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.alert_blocked_announcements(integer, interval) FROM PUBLIC')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.alert_blocked_announcements(integer, interval) TO service_role')
  })
})
