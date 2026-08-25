import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Un abandon doit TOUJOURS laisser une trace.
 *
 * Le travailleur comptait une tache « ecartee » puis passait a la suivante,
 * sans rien enregistrer. La tache restait en 'claimed', son verrou expirait,
 * elle etait reprise au passage suivant, echouait pareil — quatre fois par
 * heure, indefiniment. Elle ne comptait ni comme echec, ni comme file
 * manuelle : seulement comme « ecartee », un compteur que personne ne regarde.
 *
 * Deux taches ont tourne ainsi le 25/08 avant qu'on ne s'en apercoive, et
 * uniquement parce qu'on les attendait.
 *
 * `refuse()` est le SEUL endroit autorise a incrementer ce compteur, parce
 * qu'il enregistre aussi la raison cote base. Toute autre incrementation
 * recree le silence.
 */
const source = readFileSync(
  join(process.cwd(), 'src/lib/auto-fix/live-worker.ts'),
  'utf8',
)

describe('tout abandon laisse une trace', () => {
  it('seul refuse() compte une tache ecartee', () => {
    const incrementations = source.match(/result\.skipped\s*\+=\s*1/g) ?? []
    // Une seule : celle qui se trouve dans refuse(), juste avant l'appel a
    // fail_auto_fix_live.
    expect(incrementations).toHaveLength(1)

    // On delimite la fonction par son ouverture et sa fermeture plutot que
    // par un nombre de caracteres : une fenetre fixe casse des qu'on ajoute
    // une ligne, et casse pour une mauvaise raison.
    const debut = source.indexOf('const refuse = async')
    const refuse = source.slice(debut, source.indexOf('\n      }', debut))
    expect(refuse).toContain('result.skipped += 1')
    expect(refuse).toContain('fail_auto_fix_live')
  })

  it('refuse() verifie que le refus a bien ete enregistre', () => {
    // Le mecanisme cense rendre les choses visibles avalait sa propre panne :
    // il comptait un refus sans verifier qu'il avait pris. Deux taches sont
    // restees bloquees des heures avec un compte rendu affichant
    // tranquillement `skipped: 2, failed: 0`.
    const debut = source.indexOf('const refuse = async')
    const refuse = source.slice(debut, source.indexOf('\n      }', debut))
    expect(refuse).toContain('const { data, error } = await client.rpc')
    // Une fonction qui ne trouve aucune ligne a mettre a jour renvoie null :
    // c'est un echec, pas un succes silencieux.
    expect(refuse).toContain('data === null')
    expect(refuse).toContain('result.failed += 1')
    expect(refuse).toContain('refusalErrors')
  })

  it('un verrou perdu est signale comme reprenable', () => {
    // Ni un echec definitif — la tache n'a rien de fautif — ni un silence.
    expect(source).toContain("refuse('lock_expired_before_plan', 'retryable')")
    expect(source).toContain("refuse('lock_expired_before_write', 'retryable')")
  })

  it('le verrou couvre le travail reel du travailleur live', () => {
    // 120 s ne suffisaient pas : plusieurs allers-retours Sendcloud par tache.
    const claim = source.slice(source.indexOf("'claim_auto_fix_jobs'"), source.indexOf("'claim_auto_fix_jobs'") + 600)
    expect(claim).toContain('p_lock_seconds: 300')
  })
})
