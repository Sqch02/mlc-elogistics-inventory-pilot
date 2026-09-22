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
