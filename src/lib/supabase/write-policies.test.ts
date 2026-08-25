import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Une ecriture ne doit jamais dependre du seul client.
 *
 * Les politiques d'ecriture ne verifiaient que `tenant_id`. Aucune ne regardait
 * le role, si bien qu'un compte `client` authentifie pouvait supprimer les
 * tarifs, les factures ou les expeditions de son propre client en s'adressant
 * directement a l'API REST. 5 comptes `client` sont actifs, et le navigateur
 * detient une vraie session : l'interface ne propose pas ces actions, mais
 * l'interface n'est pas une securite.
 *
 * `profiles` est la seule exclusion legitime — PATCH /api/profile met a jour
 * son propre nom en libre-service, et sa politique l'encadre deja par
 * `id = auth.uid()`.
 */
const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00124_ecritures_reservees_au_personnel.sql'),
  'utf8',
)

const politiques = [...sql.matchAll(/CREATE POLICY (\w+) ON public\.(\w+) FOR (\w+)([\s\S]*?);/g)]

describe('les ecritures exigent le personnel', () => {
  it('reecrit bien un ensemble de politiques', () => {
    // Sans cette garde, une expression devenue introuvable rendrait le reste
    // vert sans rien verifier.
    expect(politiques.length).toBeGreaterThan(50)
  })

  it('chaque politique reecrite exige is_staff sur la branche client', () => {
    const sansRole = politiques
      .filter(([corps]) => !corps.includes('is_staff'))
      .map(([, nom]) => nom)
    expect(sansRole).toEqual([])
  })

  it('chaque politique garde la voie du super-administrateur', () => {
    // Sans elle, l'equipe MLC perdrait l'acces transverse aux clients.
    const sansSuperAdmin = politiques
      .filter(([corps]) => !corps.includes('is_super_admin'))
      .map(([, nom]) => nom)
    expect(sansSuperAdmin).toEqual([])
  })

  it('ne touche jamais a profiles', () => {
    // Le libre-service sur son propre nom passe par la session utilisateur :
    // resserrer ici empecherait un client de corriger son nom.
    const surProfiles = politiques.filter(([, , table]) => table === 'profiles')
    expect(surProfiles).toEqual([])
  })

  it('ne concerne que des ecritures', () => {
    const commandes = new Set(politiques.map((m) => m[3]))
    expect([...commandes].sort()).toEqual(['DELETE', 'INSERT', 'UPDATE'])
  })
})
