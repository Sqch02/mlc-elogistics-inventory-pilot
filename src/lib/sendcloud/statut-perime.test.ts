import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Colis dont le statut s'est fige chez nous alors que Sendcloud l'a fait
 * evoluer.
 *
 * Verifie le 02/09 sur trois colis reels de decembre 2025 :
 *   588437255  Sendcloud « Ready to send »  -> jamais scanne, normal
 *   595209458  Sendcloud « Delivered »      -> perime chez nous depuis le 05/01
 *   595210478  Sendcloud « Delivered »      -> perime chez nous depuis le 08/01
 *
 * Le cron lit les colis par pages, plafonnees a deux depuis l'incident de
 * saturation du 13/07 : au-dela, les mises a jour passent a la trappe et rien
 * ne les rattrape.
 */
const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00127_colis_au_statut_perime.sql'),
  'utf8',
)
const source = readFileSync(
  join(process.cwd(), 'src/lib/sendcloud/reconcile.ts'),
  'utf8',
)

describe('rattrapage des statuts perimes', () => {
  it('ne cible que des COLIS, jamais des commandes', () => {
    // L'identifiant d'une commande contient des tirets, celui d'un colis est
    // numerique. Melanger les deux ferait rappeler l'API sur des ressources
    // qui n'existent pas.
    expect(sql).toContain("s.sendcloud_id NOT LIKE '%-%'")
    expect(sql).toContain('s.status_id = 1000')
  })

  it('reste borne, pour ne pas refaire l incident de saturation', () => {
    // Sept jours avant d'etre candidat, sept avant d'etre reexamine, et un
    // plafond dur meme si l'appelant demande davantage.
    expect(sql).toContain("s.shipped_at < now() - interval '7 days'")
    expect(sql).toContain("s.reconcile_checked_at < now() - interval '7 days'")
    expect(sql).toContain('LEAST(p_limit, 200)')
  })

  it('n ouvre pas la fonction au public', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.stale_parcel_status_candidates(uuid, integer) FROM PUBLIC')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.stale_parcel_status_candidates(uuid, integer) TO service_role')
  })

  it('horodate un colis inchange au lieu de le reproposer chaque semaine', () => {
    // Un colis que le transporteur n'a jamais scanne reviendrait sinon a chaque
    // passage, pour rien.
    expect(source).toContain('if (colis.status_id === 1000)')
    expect(source).toContain('reconcile_checked_at')
  })

  it('n ecrit que si le statut a reellement change', () => {
    const bloc = source.slice(source.indexOf('reconcileStaleParcelStatuses'))
    expect(bloc).toContain('status_id: colis.status_id')
    expect(bloc).toContain('status_message: colis.status_message')
  })

  it('un echec de lecture des candidats compte comme un echec, pas comme zero candidat', () => {
    // Le 02/09, Florna affichait « 0 examine, 0 erreur » alors que 200 colis
    // attendaient : la lecture echouait et l'erreur etait avalee par un
    // `candidates || []`. Meme defaut que celui corrige dans refuse() la
    // semaine precedente.
    const bloc = source.slice(source.indexOf('reconcileStaleParcelStatuses'))
    expect(bloc).toContain('error: erreurCandidats')
    expect(bloc).toContain('if (erreurCandidats)')
    expect(bloc).toContain('res.errors++')
  })

  it('le predicat de la recherche est materialise dans un index partiel', () => {
    // 2,8 s sans index pour 50 lignes (29 238 colis filtres) ; 0,1 s avec,
    // pour 200 lignes. Sous le delai de 8 s de PostgREST, l'ecart est celui
    // entre un rattrapage qui tourne et un rattrapage qui echoue en silence.
    const index = readFileSync(
      join(process.cwd(), 'supabase/migrations/00129_index_partiel_statuts_figes.sql'),
      'utf8',
    )
    expect(index).toContain('WHERE status_id = 1000 AND is_return = false')
    expect(index).toContain('ON public.shipments (tenant_id, shipped_at DESC)')
  })
})
