import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  refuserFichierTropGros,
  refuserTropDeLignes,
  TAILLE_MAX_IMPORT_OCTETS,
  LIGNES_MAX_IMPORT,
} from './upload-limits'

describe('plafond des imports', () => {
  it('laisse passer un import de taille normale', () => {
    expect(refuserFichierTropGros({ size: 200 * 1024 } as File)).toBeNull()
    expect(refuserTropDeLignes(1500)).toBeNull()
  })

  it('refuse un fichier au-dela du plafond, et dit quoi faire', () => {
    const refus = refuserFichierTropGros({ size: TAILLE_MAX_IMPORT_OCTETS + 1 } as File)
    expect(refus?.status).toBe(413)
    // Un refus qui n'indique pas la sortie laisse l'utilisateur bloque.
    expect(refus?.message).toContain('découpez')
  })

  it('refuse un fichier compact mais trop dense', () => {
    // Un CSV de quelques centaines de Ko peut porter des centaines de milliers
    // de lignes : la taille seule ne protege pas du traitement.
    const refus = refuserTropDeLignes(LIGNES_MAX_IMPORT + 1)
    expect(refus?.status).toBe(413)
  })
})

/**
 * Les huit routes d'import lisaient le fichier entier en memoire sans aucun
 * controle. Un export mal filtre suffisait a remplir la memoire de l'instance
 * et a faire tomber l'application pour TOUS les clients, pas seulement pour
 * celui qui importe.
 *
 * Le test porte sur la couverture, pas sur une route en particulier : une
 * neuvieme route d'import ajoutee sans garde fera echouer la suite.
 */
describe('couverture des routes d import', () => {
  const dossier = join(process.cwd(), 'src', 'app', 'api', 'import')
  const routes = readdirSync(dossier)
    .filter((d) => existsSync(join(dossier, d, 'route.ts')))

  it('trouve bien les routes a inspecter', () => {
    expect(routes.length).toBeGreaterThanOrEqual(8)
  })

  it.each(routes)('%s mesure le fichier AVANT de le lire', (route) => {
    const sql = readFileSync(join(dossier, route, 'route.ts'), 'utf8')
    const posGarde = sql.indexOf('refuserFichierTropGros(file)')
    const posLecture = sql.indexOf('await file.text()')

    expect(posGarde).toBeGreaterThan(-1)
    // Lire d'abord pour mesurer ensuite, c'est deja subir la panne.
    expect(posGarde).toBeLessThan(posLecture)
  })

  it.each(routes)('%s plafonne aussi le nombre de lignes', (route) => {
    const sql = readFileSync(join(dossier, route, 'route.ts'), 'utf8')
    expect(sql).toContain('refuserTropDeLignes(rawData.length)')
  })
})
