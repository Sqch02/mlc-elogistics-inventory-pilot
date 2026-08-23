import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Le balayage horaire est la SEULE sortie de la file manuelle. Deux fois deja
 * il a laisse s'accumuler du travail qui n'existait plus : d'abord parce
 * qu'aucun etat de sortie n'existait (07/08), puis parce qu'il ignorait les
 * commandes parties par un autre colis (24/08). Ces criteres sont donc
 * verrouilles ici : une reecriture qui en perd un doit echouer bruyamment.
 */
const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00119_fermer_les_taches_dont_la_commande_est_partie.sql'),
  'utf8',
)

describe('balayage de la file manuelle', () => {
  it('referme une tache dont la commande est partie par un autre colis', () => {
    expect(sql).toContain("s.status_id = 1002")
    expect(sql).toContain('s.date_announced IS NULL')
    expect(sql).toContain('autre.date_announced IS NOT NULL')
    expect(sql).toContain("'order_shipped_by_another_parcel'")
  })

  it('epargne une commande dont les colis sont encore en cours', () => {
    // Sans ce delai, une commande partant legitimement en deux colis le meme
    // jour verrait la tache du second refermee a tort.
    expect(sql).toContain("s.created_at < now() - interval '48 hours'")
  })

  it('conserve la regle d origine sur le colis devenu non corrigeable', () => {
    expect(sql).toContain("'parcel_no_longer_correctable'")
    expect(sql).toContain('s.status_id NOT IN (1000, 1002)')
  })

  it('inscrit de quoi relire et defaire une fermeture', () => {
    expect(sql).toContain("'shipped_by_parcel', c.colis_parti")
    expect(sql).toContain("'closed_at', now()")
  })

  it('reste concurrent et cloisonne par client', () => {
    expect(sql).toContain('FOR UPDATE OF j SKIP LOCKED')
    expect(sql).toContain('autre.tenant_id = s.tenant_id')
    expect(sql).toContain("SET search_path TO 'public'")
  })
})
