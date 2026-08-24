import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AUTO_FIX_PATTERNS } from './types'
import { AUTO_FIX_PATTERN_LABELS } from './dashboard-labels'

/**
 * La liste des motifs vit a deux endroits : la contrainte CHECK en base et
 * AUTO_FIX_PATTERNS cote code. Un motif connu du code mais absent de la base
 * ne provoque pas une tache perdue — il fait echouer TOUT LE LOT d'insertion,
 * qui va jusqu'a 250 taches.
 *
 * Ce n'est pas theorique. Le 24/08, la contrainte ignorait `address_missing`
 * (livre en production la veille) et `currency_unsupported`. La panne serait
 * survenue au premier colis sans rue, un jour ou personne n'aurait rien
 * modifie — le pire moment pour chercher la cause.
 *
 * Le decalage inverse compte aussi : un motif autorise en base et inconnu du
 * code n'a ni libelle ni comptage sur le tableau de bord.
 */
/** Les noms des contraintes qui enumerent des motifs, telles qu'on les ecrit. */
const CONTRAINTES = ['auto_fix_jobs_patterns_known', 'auto_fix_jobs_primary_pattern_check']

function motifsDeLaDerniereContrainte(nom: string): string[] {
  const dossier = join(process.cwd(), 'supabase', 'migrations')
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()

  let dernier: string[] = []
  for (const fichier of fichiers) {
    const sql = readFileSync(join(dossier, fichier), 'utf8')
    // La DERNIERE definition appliquee fait foi, pas la premiere rencontree.
    const blocs = sql.matchAll(
      new RegExp(`${nom}\\s+CHECK\\s*\\(([\\s\\S]*?)\\)\\s*;`, 'g'),
    )
    for (const bloc of blocs) {
      const motifs = [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
      if (motifs.length > 0) dernier = motifs
    }
  }
  return dernier
}

describe('motifs des taches auto-fix', () => {
  it.each(CONTRAINTES)('retrouve bien la contrainte %s dans les migrations', (nom) => {
    // Sans cette garde, une expression devenue introuvable rendrait les tests
    // suivants vides — donc toujours verts, et donc inutiles.
    expect(motifsDeLaDerniereContrainte(nom).length).toBeGreaterThan(5)
  })

  it.each(CONTRAINTES)('%s autorise tous les motifs que le code produit', (nom) => {
    const enBase = motifsDeLaDerniereContrainte(nom)
    const manquants = AUTO_FIX_PATTERNS.filter((motif) => !enBase.includes(motif))
    expect(manquants).toEqual([])
  })

  it.each(CONTRAINTES)('le code connait tous les motifs de %s', (nom) => {
    const enBase = motifsDeLaDerniereContrainte(nom)
    const manquants = enBase.filter((motif) => !AUTO_FIX_PATTERNS.includes(motif as never))
    expect(manquants).toEqual([])
  })

  it('chaque motif a un libelle lisible sur le tableau', () => {
    const sansLibelle = AUTO_FIX_PATTERNS.filter((motif) => !AUTO_FIX_PATTERN_LABELS[motif])
    expect(sansLibelle).toEqual([])
  })
})
