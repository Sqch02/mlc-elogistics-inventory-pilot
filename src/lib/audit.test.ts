import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Le journal d'administration n'a jamais rien enregistre jusqu'au 04/10 : la
 * migration qui creait la table (00018) n'avait pas ete appliquee, et
 * logAudit() avale l'erreur. Ces tests verrouillent la table qui la remplace
 * (00146) et sa correspondance avec ce que l'application y ecrit.
 */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')
const migration = lire('supabase/migrations/00146_journal_des_actions_admin.sql')
const ecriture = lire('src/lib/audit.ts')

describe('journal des actions d administration', () => {
  it('chaque colonne ecrite par logAudit existe dans la table', () => {
    const insertion = ecriture.slice(ecriture.indexOf(".from('audit_logs').insert({"), ecriture.indexOf('})', ecriture.indexOf(".from('audit_logs')")))
    const colonnes = [...insertion.matchAll(/^\s+(\w+):/gm)].map((m) => m[1])
    expect(colonnes.length).toBeGreaterThan(5)
    const table = migration.slice(migration.indexOf('CREATE TABLE'), migration.indexOf(');'))
    for (const colonne of colonnes) {
      expect(table, colonne).toMatch(new RegExp(`\\n\\s+${colonne}\\s`))
    }
  })

  it('accepte un en-tete x-forwarded-for entier, sans limite de longueur', () => {
    // Les routes passent l'en-tete brut : varchar(45) aurait fait echouer
    // l'insertion, en silence, des qu'un proxy s'ajoute a la chaine.
    expect(migration).toMatch(/ip_address text,/)
  })

  it('reste immuable et hors de portee des comptes connectes', () => {
    expect(migration).toContain('REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role')
    expect(migration).toContain('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM service_role')
    expect(migration).not.toMatch(/GRANT[^;]*TO\s+(anon|authenticated)/i)
  })
})
