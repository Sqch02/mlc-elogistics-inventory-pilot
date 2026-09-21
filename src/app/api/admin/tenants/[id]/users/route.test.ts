import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Le 21/09, aucun utilisateur ne pouvait etre ajoute depuis l'administration :
 * « Database error creating new user », sans autre explication.
 *
 * Cause : un declencheur sur auth.users refuse tout compte dont l'email n'a pas
 * d'invitation ouverte dans tenant_invitations. C'est ce qui empeche quelqu'un
 * de s'inscrire seul et d'obtenir un profil. La route creait le compte sans
 * jamais creer l'invitation, donc le declencheur annulait tout.
 *
 * Le test verrouille l'ORDRE, qui est le fond du sujet : l'invitation d'abord,
 * le compte ensuite, et le menage si le compte echoue.
 */
const source = readFileSync(
  join(process.cwd(), 'src/app/api/admin/tenants/[id]/users/route.ts'),
  'utf8',
)

const posInvitation = source.indexOf("from('tenant_invitations')")
const posCreation = source.indexOf('auth.admin.createUser')

describe('creation d un utilisateur pour un client', () => {
  it("cree l'invitation AVANT le compte", () => {
    expect(posInvitation).toBeGreaterThan(-1)
    expect(posCreation).toBeGreaterThan(-1)
    expect(posInvitation).toBeLessThan(posCreation)
  })

  it("l'invitation porte le client et le role demandes", () => {
    const bloc = source.slice(posInvitation, posCreation)
    expect(bloc).toContain('tenant_id: tenantId')
    expect(bloc).toContain('role: roleDemande')
    expect(bloc).toContain('email,')
  })

  it('retire l invitation si le compte ne se cree pas', () => {
    // Une invitation ouverte derriere un compte inexistant autoriserait une
    // inscription que personne n'a demandee.
    const apres = source.slice(posCreation)
    expect(apres).toContain("from('tenant_invitations').delete()")
  })

  it('refuse un role que l invitation n accepte pas', () => {
    // La contrainte de la table n'accepte que admin, ops, sav, client.
    // super_admin ne s'attribue jamais par ce chemin.
    expect(source).toContain("const ROLES_INVITABLES = ['admin', 'ops', 'sav', 'client'] as const")
    expect(source).toContain('ROLES_INVITABLES as readonly string[]).includes(roleDemande)')
    expect(source).not.toMatch(/ROLES_INVITABLES[^\n]*super_admin/)
  })

  it('dit clairement qu un compte existe deja', () => {
    expect(source).toContain('Un compte existe deja pour')
  })

  it('reste reserve au super administrateur', () => {
    expect(source).toContain("requireRole(['super_admin'])")
  })
})
