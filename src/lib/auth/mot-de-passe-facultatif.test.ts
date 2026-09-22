import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Le 22/09, l'exploitant ne pouvait pas valider la creation d'un utilisateur
 * sans saisir un mot de passe : le bouton ne faisait rien, SANS AUCUN MESSAGE.
 *
 *   if (!newUserEmail || !newUserPassword) return
 *
 * La route accepte pourtant l'absence de mot de passe, et c'est le chemin
 * recommande : elle renvoie alors un lien d'invitation, le client choisit son
 * mot de passe, et l'exploitant ne le connait jamais. Ce chemin etait
 * inatteignable depuis l'interface. Resultat : trois comptes clients crees
 * avec un mot de passe choisi par l'exploitant.
 */
const page = readFileSync(
  join(process.cwd(), 'src/app/(admin)/admin/tenants/[id]/page.tsx'),
  'utf8',
)
const handler = page.slice(
  page.indexOf('async function handleCreateUser'),
  page.indexOf('const copyInviteLink'),
)

describe('creation d utilisateur depuis la fiche client', () => {
  it('n exige plus le mot de passe', () => {
    expect(handler).not.toContain('!newUserEmail || !newUserPassword')
    expect(handler).toContain('!newUserEmail.trim()')
  })

  it('ne sort jamais en silence : chaque refus a son message', () => {
    // Un bouton qui ne fait rien est pire qu'un bouton qui refuse.
    const sorties = handler.match(/return\b/g) ?? []
    const messages = handler.match(/toast\.error\(/g) ?? []
    expect(messages.length).toBeGreaterThanOrEqual(sorties.length - 1)
    expect(handler).toContain("toast.error(\"L'email est obligatoire\")")
  })

  it('n envoie la cle mot de passe que si elle est remplie', () => {
    // Une chaine vide declencherait la validation de longueur cote serveur.
    expect(handler).toContain('...(newUserPassword ? { password: newUserPassword } : {})')
  })

  it('affiche le lien d invitation au lieu de le perdre', () => {
    expect(handler).toContain('data.invite_link')
    expect(handler).toContain('setInviteLink(data.invite_link)')
    // La boite reste ouverte tant que le lien est affiche : il ne se
    // reaffiche pas.
    const brancheAvecLien = handler.slice(handler.indexOf('if (data.invite_link)'))
    expect(brancheAvecLien.slice(0, brancheAvecLien.indexOf('} else')))
      .not.toContain('setCreateUserOpen(false)')
  })

  it('le champ est presente comme facultatif', () => {
    expect(page).toContain('(facultatif)')
    expect(page).toContain('Laissez vide : le client choisira le sien')
  })

  it('le lien peut etre copie', () => {
    expect(page).toContain('const copyInviteLink')
    expect(page).toContain('navigator.clipboard.writeText(inviteLink)')
  })
})

/**
 * La route qui genere un lien de reinitialisation existait depuis longtemps,
 * mais n'etait branchee nulle part. Il n'y avait donc aucun moyen de faire
 * choisir son mot de passe a un compte deja cree — ce qui etait precisement
 * la situation des trois comptes VITALIENCE du 22/09.
 */
describe('lien de reinitialisation depuis la fiche client', () => {
  it('chaque utilisateur a son bouton', () => {
    expect(page).toContain('handleResetLink(user.id)')
    expect(page).toContain('Lien de reinitialisation')
  })

  it('appelle la route existante, sans la reecrire', () => {
    expect(page).toContain('/api/admin/users/${userId}/reset-link')
    expect(page).toContain("method: 'POST'")
  })

  it('affiche le lien avec le compte concerne, et permet de le copier', () => {
    // Afficher un lien sans dire a qui il appartient invite a le transmettre
    // a la mauvaise personne.
    expect(page).toContain('Lien de reinitialisation pour {resetLink.email}')
    expect(page).toContain('navigator.clipboard.writeText(resetLink.link)')
  })

  it('dit pourquoi ce chemin est preferable', () => {
    expect(page).toContain('il choisira lui-meme son mot de passe')
  })
})
