import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/**
 * requireTenant() ne verifie QUE l'authentification et resout le tenant : un
 * compte 'client' la passe sans probleme. La vraie garde est requireRole().
 * Le middleware exclut les routes api/, il n'y a donc aucun filet en amont.
 *
 * Ces tests figent les gardes des routes mutantes. Sans eux, rien n'empeche de
 * retirer un requireRole en refactorisant, et le trou se rouvre en silence.
 */

const OPS = "['super_admin', 'admin', 'ops']"
const SAV = "['super_admin', 'admin', 'ops', 'sav']"

describe('gardes de role des routes mutantes', () => {
  it.each([
    ['src/app/api/shipments/create/route.ts', OPS, 'cree un vrai colis Sendcloud et peut generer une etiquette facturable'],
    ['src/app/api/shipments/[id]/cancel/route.ts', OPS, 'annule un vrai colis et rend du stock'],
    ['src/app/api/shipments/[id]/update/route.ts', OPS, 'reachemine un colis et change le poids facture'],
    ['src/app/api/shipments/[id]/refresh/route.ts', OPS, 'interroge Sendcloud et reecrit la ligne locale'],
    ['src/app/api/sync/sendcloud/run/route.ts', OPS, 'consomme du stock et retarife tout un tenant'],
    ['src/app/api/bundles/[id]/route.ts', OPS, 'modifier un bundle change retroactivement la consommation'],
    ['src/app/api/locations/[id]/route.ts', OPS, 'detruit des emplacements et leurs affectations'],
    ['src/app/api/claims/[id]/route.ts', SAV, 'engage une indemnisation'],
    ['src/app/api/import/claims/route.ts', SAV, 'ecrase en masse statut et indemnite, sans historique'],
    ['src/app/api/skus/[id]/stock/route.ts', OPS, 'ecrit directement le stock'],
  ])('%s exige un role interne (%s)', (path, roles) => {
    const code = source(path)
    expect(code).toContain('requireRole')
    expect(code).toContain(roles)
  })

  it('la garde precede tout effet de bord dans l annulation', () => {
    const code = source('src/app/api/shipments/[id]/cancel/route.ts')
    const guard = code.indexOf('await requireRole(')
    expect(guard).toBeGreaterThan(-1)
    // Annuler chez Sendcloud est irreversible : la garde doit passer avant.
    expect(guard).toBeLessThan(code.indexOf('cancelParcel('))
    // lastIndexOf : le premier match est la definition du helper, pas son appel.
    expect(guard).toBeLessThan(code.lastIndexOf('restockCancelledShipmentWithRetry('))
  })

  it('la garde precede la creation du colis chez Sendcloud', () => {
    const code = source('src/app/api/shipments/create/route.ts')
    const guard = code.indexOf('await requireRole(')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(code.indexOf('createParcel('))
  })

  /**
   * Ces routes sont volontairement ouvertes aux comptes client. Les verrouiller
   * casserait un usage reel : le client declare son arrivage, renomme son
   * profil, previsualise sa facture, consulte ses donnees. Le test echoue si
   * quelqu'un applique requireRole en masse sans se poser la question.
   */
  it.each([
    ['src/app/api/inbound/route.ts', 'le client declare son arrivage, l ops l accepte'],
    ['src/app/api/profile/route.ts', 'self-service : renommer son propre profil'],
    ['src/app/api/invoices/preview/route.ts', 'POST mais purement lecture, bouton visible aux clients'],
  ])('%s reste accessible aux clients (%s)', (path) => {
    const code = source(path)
    expect(code).not.toContain('requireRole')
  })
})

describe('coherence entre les gardes et l interface', () => {
  it('les bundles ne proposent pas Modifier/Supprimer a un client', () => {
    const code = source('src/app/(dashboard)/bundles/BundlesClient.tsx')
    // L API refuse desormais ces actions : laisser les boutons visibles
    // produirait une erreur au clic.
    expect(code).toContain('const { isClient } = useTenant()')
    const menu = code.slice(code.indexOf('<DropdownMenuTrigger'), code.indexOf('</DropdownMenu>'))
    expect(code.slice(0, code.indexOf('<DropdownMenuTrigger'))).toContain('{!isClient && (')
    expect(menu).toContain('Supprimer')
  })

  it('les reclamations ne proposent pas la creation a un client', () => {
    const code = source('src/app/(dashboard)/reclamations/ReclamationsClient.tsx')
    const button = code.indexOf('Nouvelle réclamation')
    expect(button).toBeGreaterThan(-1)
    expect(code.slice(0, button)).toMatch(/\{!isClient && \([\s\S]{0,200}$/)
  })
})
