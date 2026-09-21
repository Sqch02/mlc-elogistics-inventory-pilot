import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Aucun compte utilisateur n'a pu etre cree entre le 30/05 et le 21/09.
 *
 * La migration 00059 a durci `handle_new_user` en exigeant une invitation, et
 * a introduit au passage cette insertion :
 *
 *   INSERT INTO profiles (..., role) VALUES (..., v_invitation.role);
 *
 * `tenant_invitations.role` est du TEXTE, `profiles.role` est l'enum
 * `user_role`. PL/pgSQL ne convertit pas, l'insertion levait 42804, le
 * declencheur annulait la creation, et le service d'authentification renvoyait
 * « Database error creating new user » — un message qui ne designait ni la
 * table ni la colonne.
 *
 * Le test verrouille la DERNIERE definition de la fonction, celle qui fait foi
 * en base, pas une definition ancienne restee dans l'historique.
 */
const dossier = join(process.cwd(), 'supabase', 'migrations')

function derniereDefinition(): string {
  const fichiers = readdirSync(dossier)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('ROLLBACK'))
    .sort()
  let derniere = ''
  for (const f of fichiers) {
    const sql = readFileSync(join(dossier, f), 'utf8')
    const i = sql.indexOf('FUNCTION public.handle_new_user')
    if (i === -1) continue
    derniere = sql.slice(i)
  }
  return derniere
}

const definition = derniereDefinition()

describe('creation de compte utilisateur', () => {
  it('trouve bien la derniere definition du declencheur', () => {
    expect(definition).toContain('tenant_invitations')
    expect(definition).toContain('INSERT INTO profiles')
  })

  it('convertit le role vers le type de la colonne', () => {
    // Sans la conversion : 42804, et plus aucun compte creable.
    const insertion = definition.slice(definition.indexOf('INSERT INTO profiles'))
    expect(insertion).toContain('v_invitation.role::public.user_role')
    expect(insertion).not.toMatch(/NEW\.email,\s*v_invitation\.role\s*\)/)
  })

  it('laisse au service d authentification le droit de declencher', () => {
    // Le declencheur est appele par supabase_auth_admin, pas par une RPC.
    // 00079 lui avait retire ce droit en fermant les fonctions a PUBLIC.
    expect(definition).toContain('GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin')
  })

  it('exige toujours une invitation, et refuse toujours super_admin', () => {
    // Le durcissement de 00059 reste en place : on repare la conversion, on
    // ne rouvre pas la porte.
    expect(definition).toContain('No invitation found for email')
    expect(definition).toContain('super_admin role cannot be assigned via invitation')
    expect(definition).toContain('UPDATE tenant_invitations SET used_at = now()')
  })
})
