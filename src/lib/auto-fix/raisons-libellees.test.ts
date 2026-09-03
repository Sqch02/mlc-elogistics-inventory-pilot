import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Chaque raison que le moteur peut emettre doit avoir un libelle sur le
 * tableau de bord.
 *
 * Sans libelle, la ligne retombe sur le message generique du motif —
 * « Adresse a raccourcir avant annonce transporteur » — qui laisse croire a
 * une coupe a faire la ou le moteur a RENONCE (`no_repair_available`), manque
 * de temps (`lock_expired_*`) ou constate un changement. Constate le 03/09 :
 * onze raisons emises n'avaient aucun libelle, dont plusieurs ajoutees cette
 * semaine.
 *
 * Le test ne verifie pas UNE raison mais la correspondance entiere : la
 * prochaine raison ajoutee au moteur sera couverte sans qu'on y pense.
 */
const moteur = readFileSync(join(process.cwd(), 'src/lib/auto-fix/live-worker.ts'), 'utf8')
const tableau = readFileSync(join(process.cwd(), 'src/lib/auto-fix/dashboard-query.ts'), 'utf8')

function raisonsEmises(): string[] {
  const trouvees = new Set<string>()
  for (const m of moteur.matchAll(/refuse\(\s*'([a-z_]+)'/g)) trouvees.add(m[1])
  // refuse(`order_lookup_${lookup.reason}`) : les trois variantes possibles.
  if (/refuse\(`order_lookup_\$\{/.test(moteur)) {
    for (const v of ['not_found', 'ambiguous', 'http_error']) trouvees.add(`order_lookup_${v}`)
  }
  // Les raisons portees par le plan et par la construction du patch.
  for (const r of ['nothing_to_shorten', 'no_repair_available', 'lossy_shortening_requires_review']) trouvees.add(r)
  return [...trouvees].sort()
}

function raisonsLibellees(): string[] {
  const debut = tableau.indexOf('function refusLisible')
  const bloc = tableau.slice(debut, tableau.indexOf('return messages[raison]', debut))
  return [...bloc.matchAll(/^\s*([a-z_]+):\s*['"]/gm)].map((m) => m[1])
}

describe('raisons du moteur et libelles du tableau', () => {
  const emises = raisonsEmises()
  const libellees = raisonsLibellees()

  it('retrouve bien les deux listes', () => {
    expect(emises.length).toBeGreaterThan(10)
    expect(libellees.length).toBeGreaterThan(10)
  })

  it('chaque raison emise a un libelle', () => {
    // `nothing_to_shorten` n'atteint jamais le tableau : elle devient
    // `already_resolved` avant. On l'exclut a dessein.
    const manquantes = emises.filter((r) => r !== 'nothing_to_shorten' && !libellees.includes(r))
    expect(manquantes).toEqual([])
  })
})
