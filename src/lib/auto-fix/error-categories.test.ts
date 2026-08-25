import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Toute categorie que le code produit doit etre autorisee par la base.
 *
 * C'est la TROISIEME contrainte de cette table sur laquelle on bute pour la
 * meme raison : le code emet une valeur, la base l'enumere ailleurs, et
 * personne ne verifie que les deux listes coincident.
 *
 *   - motifs, contrainte `patterns_known` (24/08)
 *   - motifs, contrainte `primary_pattern_check` — trouvee uniquement parce
 *     que la premiere avait deja refuse
 *   - categories d'erreur, ici : `obsolete` etait produite par la migration
 *     00120 sans jamais avoir ete autorisee
 *
 * A chaque fois le symptome differe. Ici, l'enregistrement du refus echouait
 * en silence et la tache tournait en boucle, quatre fois par heure, avec un
 * compte rendu affichant `failed: 0`.
 */
const racine = process.cwd()

const source = [
  'src/lib/auto-fix/live-worker.ts',
  'src/lib/auto-fix/worker.ts',
].map((f) => readFileSync(join(racine, f), 'utf8')).join('\n')

/** Les categories citees dans les migrations SQL, cote fonctions. */
const sqlMigrations = (() => {
  const dossier = join(racine, 'supabase', 'migrations')
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dossier, f), 'utf8'))
})()

function categoriesAutorisees(): string[] {
  let dernier: string[] = []
  for (const sql of sqlMigrations) {
    const blocs = sql.matchAll(
      /auto_fix_jobs_error_category_check\s+CHECK\s*\(([\s\S]*?)\)\s*;/g,
    )
    for (const bloc of blocs) {
      const valeurs = [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
      if (valeurs.length > 0) dernier = valeurs
    }
  }
  return dernier
}

/** Les categories que le code passe reellement a fail_auto_fix_*. */
function categoriesEmises(): string[] {
  const trouvees = new Set<string>()
  // refuse('raison', 'categorie')
  for (const m of source.matchAll(/refuse\(\s*[^,)]+,\s*'([a-z_]+)'/g)) trouvees.add(m[1])
  // category: 'xxx' et category = 'xxx' (valeur par defaut)
  for (const m of source.matchAll(/category\s*[:=]\s*'([a-z_]+)'/g)) trouvees.add(m[1])
  return [...trouvees].sort()
}

describe('categories d erreur', () => {
  const autorisees = categoriesAutorisees()
  const emises = categoriesEmises()

  it('retrouve la contrainte et les categories du code', () => {
    // Sans ces gardes, une expression devenue introuvable rendrait le test
    // suivant vide — donc toujours vert.
    expect(autorisees.length).toBeGreaterThan(5)
    expect(emises.length).toBeGreaterThan(2)
  })

  it('la base autorise toutes les categories que le code produit', () => {
    const manquantes = emises.filter((c) => !autorisees.includes(c))
    expect(manquantes).toEqual([])
  })

  it('autorise explicitement obsolete, introduite par la migration 00120', () => {
    expect(autorisees).toContain('obsolete')
  })
})
