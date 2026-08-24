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

const sqlModeBloque = readFileSync(
  join(process.cwd(), 'supabase/migrations/00125_taches_bloquees_par_un_changement_de_mode.sql'),
  'utf8',
)

const sqlIntrouvables = readFileSync(
  join(process.cwd(), 'supabase/migrations/00122_fermer_les_taches_sans_commande_identifiable.sql'),
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

  /**
   * Le cron supprime la ligne de commande des que le colis est cree. Une tache
   * qui n'a pas fige son numero devient alors introuvable pour tout le monde.
   * 42 des 51 taches de la file etaient dans ce cas le 24/08.
   */
  it('referme une tache dont la commande n est identifiable par personne', () => {
    expect(sqlIntrouvables).toContain("j.source_kind = 'integration_shipment'")
    expect(sqlIntrouvables).toContain('NOT EXISTS')
    expect(sqlIntrouvables).toContain("'order_row_deleted_after_parcel_created'")
  })

  it('ne touche JAMAIS une tache dont le numero est fige', () => {
    // C'est la seule garde qui empeche cette regle d'avaler du travail reel :
    // depuis la migration 00121 toute tache neuve porte son numero.
    expect(sqlIntrouvables).toContain('j.source_order_ref IS NULL')
  })

  it('n ouvre pas la fonction au public', () => {
    // REVOKE sur anon seul est un no-op tant que PUBLIC garde le droit.
    expect(sqlIntrouvables).toContain('REVOKE ALL ON FUNCTION public.close_unidentifiable_auto_fix_jobs(integer) FROM PUBLIC')
    expect(sqlIntrouvables).toContain('GRANT EXECUTE ON FUNCTION public.close_unidentifiable_auto_fix_jobs(integer) TO service_role')
  })

  /**
   * `claim_auto_fix_jobs` exige que le mode de la tache et celui du client
   * coincident. Un client qui passe de `simulated` a `live` laisse donc
   * derriere lui des taches qu'AUCUN travailleur ne peut plus reclamer : ni
   * en echec, ni en attente manuelle, simplement hors d'atteinte. Quatre
   * attendaient ainsi depuis un mois le 24/08.
   */
  it('referme une tache rendue inatteignable par un changement de mode', () => {
    expect(sqlModeBloque).toContain('j.mode <> ts.auto_fix_mode')
    expect(sqlModeBloque).toContain("j.state IN ('queued', 'retry_wait')")
    expect(sqlModeBloque).toContain("'mode_changed_job_unreachable'")
  })

  it('laisse le temps a un basculement de mode de se terminer', () => {
    // Sans ce delai, on refermerait des taches pendant le basculement lui-meme.
    expect(sqlModeBloque).toContain("j.updated_at < now() - interval '24 hours'")
  })

  it('n ouvre pas la fonction de mode au public', () => {
    expect(sqlModeBloque).toContain('REVOKE ALL ON FUNCTION public.close_mode_stranded_auto_fix_jobs(integer) FROM PUBLIC')
    expect(sqlModeBloque).toContain('GRANT EXECUTE ON FUNCTION public.close_mode_stranded_auto_fix_jobs(integer) TO service_role')
  })
})
