import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AUTO_FIX_JOB_STATES } from './types'
import { AUTO_FIX_STATE_LABELS } from './dashboard-labels'

/**
 * La liste des etats vit a deux endroits : la contrainte CHECK en base et
 * AUTO_FIX_JOB_STATES cote code. Le tableau de bord compte par etat en
 * parcourant la liste du code — un etat present en base mais absent du code
 * n'est donc compte NULLE PART.
 *
 * Ce n'est pas theorique : `applying`, `retry_verify` et `applied_unverified`
 * manquaient, si bien qu'une tache bloquee en cours d'ecriture etait invisible
 * sur le tableau, alors que c'est exactement le cas qu'il faut voir. Une tache
 * l'est deja restee 24 h sans que rien ne l'indique.
 */
function etatsDeLaDerniereContrainte(): string[] {
  const dossier = join(process.cwd(), 'supabase', 'migrations')
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()

  let dernier: string[] = []
  for (const fichier of fichiers) {
    const sql = readFileSync(join(dossier, fichier), 'utf8')
    // On veut la DERNIERE definition appliquee, pas la premiere rencontree.
    const blocs = sql.matchAll(/auto_fix_jobs_state_check\s+CHECK\s*\(\s*state\s+IN\s*\(([\s\S]*?)\)\s*\)/g)
    for (const bloc of blocs) {
      const etats = [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
      if (etats.length > 0) dernier = etats
    }
  }
  return dernier
}

describe('etats des taches auto-fix', () => {
  it('le code connait tous les etats autorises en base', () => {
    const enBase = etatsDeLaDerniereContrainte()
    expect(enBase.length).toBeGreaterThan(0)

    const manquants = enBase.filter((etat) => !AUTO_FIX_JOB_STATES.includes(etat as never))
    expect(manquants, `etats en base mais absents du code : ${manquants.join(', ')}`).toEqual([])
  })

  it('n inclut aucun etat que la base refuserait', () => {
    // L'inverse compte aussi : compter un etat impossible affiche une colonne
    // toujours a zero, ce qui use la confiance dans le reste du tableau.
    const enBase = etatsDeLaDerniereContrainte()
    const inconnus = AUTO_FIX_JOB_STATES.filter((etat) => !enBase.includes(etat))
    expect(inconnus, `etats du code refuses par la base : ${inconnus.join(', ')}`).toEqual([])
  })

  it('chaque etat porte un libelle lisible', () => {
    for (const etat of AUTO_FIX_JOB_STATES) {
      expect(AUTO_FIX_STATE_LABELS[etat], `libelle manquant pour ${etat}`).toBeTruthy()
    }
  })
})
