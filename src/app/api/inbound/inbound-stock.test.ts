import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Accepter un arrivage doit passer par le meme chemin que tout le reste.
 *
 * Cette route ecrivait le stock EN DIRECT dans stock_snapshots. Trois defauts,
 * tous constates le 25/08 sur un arrivage de 100 flacons chez REBORN21 :
 *
 *   1. Aucune trace dans le registre des mouvements — le stock passait de 0 a
 *      100 sans qu'on puisse dire d'ou venait l'ecart, alors que c'est
 *      exactement ce qu'on consulte quand un comptage ne tombe pas juste.
 *   2. Lecture puis ecriture sans verrou : une expedition traitee entre les
 *      deux etait perdue.
 *   3. Un arrivage declare sur un LOT creditait le lot au lieu de ses
 *      composants.
 *
 * Et surtout, elle etait la SEULE route touchant au stock a ne pas rafraichir
 * la vue des metriques : le stock etait bien credite, mais la page Produits
 * continuait d'afficher l'ancien chiffre. C'est ce qui a fait dire "j'ai
 * declare un arrivage et le stock n'apparait pas" — puis conduit a saisir un
 * ajustement calcule sur une valeur perimee.
 */
const source = readFileSync(
  join(process.cwd(), 'src/app/api/inbound/[id]/route.ts'),
  'utf8',
)

describe('acceptation d un arrivage', () => {
  it('credite le stock par apply_stock_delta, pas par une ecriture directe', () => {
    expect(source).toContain("rpc('apply_stock_delta'")
    // L'ecriture directe laissait le mouvement, le verrou et les lots de cote.
    expect(source).not.toMatch(/from\('stock_snapshots'\)[\s\S]{0,200}\.update\(/)
    expect(source).not.toMatch(/from\('stock_snapshots'\)[\s\S]{0,200}\.insert\(/)
  })

  it('rattache le mouvement a l arrivage qui l a cause', () => {
    // Sans reference, le registre montre un ecart sans en donner l'origine.
    expect(source).toContain("p_reference_type: 'inbound_restock'")
    expect(source).toContain("p_movement_type: 'restock'")
  })

  it('rafraichit la vue pour que le stock apparaisse tout de suite', () => {
    expect(source).toContain("rpc('refresh_sku_metrics')")
  })
})
