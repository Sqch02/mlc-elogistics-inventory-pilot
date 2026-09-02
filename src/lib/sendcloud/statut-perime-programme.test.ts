import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00128_rattrapage_statuts_programme.sql'),
  'utf8',
)

describe('rattrapage des statuts programme', () => {
  it('appelle le mode statuts en reel, avec le plafond dur', () => {
    expect(sql).toContain('mode=statuts')
    expect(sql).toContain('dry_run=false')
    expect(sql).toContain('limit=200')
  })

  it('s authentifie par le coffre, jamais par un secret en clair', () => {
    expect(sql).toContain("vault.decrypted_secrets")
    expect(sql).not.toMatch(/Bearer [A-Za-z0-9-]{8,}/)
  })

  it('tourne une fois par heure sur un creneau libre', () => {
    // :45 — aucune autre tache ne tourne a cette minute.
    expect(sql).toContain("'45 * * * *'")
  })

  it('n ouvre pas la fonction au public', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.trigger_stale_status_reconcile() FROM PUBLIC')
  })
})
