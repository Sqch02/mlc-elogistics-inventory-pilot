import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Une migration doit APPLIQUER, pas seulement decrire.
 *
 * `00092_perf_indexes_and_cleanup.sql` ne contenait que des commentaires et un
 * `SELECT 1;`. Les commandes avaient ete jouees a la main en production, et le
 * fichier servait de trace. Une base reconstruite depuis le depot n'aurait eu
 * aucun de ces index — dont celui qui ramene la lecture du repere de
 * synchronisation de 564 ms a 6 ms.
 *
 * C'est le pire cas de figure : on lit le depot, on croit l'index present, et
 * il ne l'est pas. Le mensonge est silencieux et ne se voit qu'a la
 * reconstruction, c'est-a-dire le jour ou l'on peut le moins se le permettre.
 */
const dossier = join(process.cwd(), 'supabase', 'migrations')
const fichiers = readdirSync(dossier)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('ROLLBACK'))
  .sort()

/** Le contenu prive de ses commentaires et de ses lignes vides. */
function instructions(sql: string): string {
  return sql
    .split('\n')
    .filter((ligne) => !/^\s*--/.test(ligne) && ligne.trim() !== '')
    .join('\n')
    .trim()
}

describe('hygiene des migrations', () => {
  it('trouve bien des migrations a inspecter', () => {
    expect(fichiers.length).toBeGreaterThan(50)
  })

  it('aucune migration ne se contente d une instruction de remplissage', () => {
    const inertes = fichiers.filter((f) => {
      const corps = instructions(readFileSync(join(dossier, f), 'utf8'))
      // Un fichier vide, ou dont tout le contenu tient dans un SELECT sans
      // effet, ne construit rien.
      return corps === '' || /^SELECT\s+1\s*;?$/i.test(corps)
    })
    expect(inertes).toEqual([])
  })
})
