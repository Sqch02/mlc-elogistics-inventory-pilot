import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A partir du 30/10/2026, Supabase n'accorde plus automatiquement l'acces a
 * la Data API aux nouvelles tables du schema public — y compris dans une
 * base reconstruite depuis les migrations. Une table creee sans GRANT sera
 * injoignable par l'application.
 *
 * Ces tests verrouillent deux choses :
 *   - la migration 00143, qui rend les droits explicites et retire `anon` ;
 *   - toute migration POSTERIEURE qui cree une table doit porter ses droits.
 */
const dossier = join(process.cwd(), 'supabase', 'migrations')
const fichiers = readdirSync(dossier)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('ROLLBACK'))
  .sort()

const lire = (f: string) => readFileSync(join(dossier, f), 'utf8')
const numero = (f: string) => Number(f.slice(0, 5))

const REFERENCE = '00143_droits_explicites_avant_le_30_octobre.sql'
const migration = lire(REFERENCE)

describe('migration 00143 : droits explicites', () => {
  it('retire tout droit anonyme sur les tables, maintenant et a l avenir', () => {
    expect(migration).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon')
    expect(migration).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL ON TABLES FROM anon/)
  })

  it('accorde tout au role serveur, indispensable apres une reconstruction', () => {
    expect(migration).toContain('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role')
  })

  it('n accorde jamais rien a anon', () => {
    // L'exemple du mail de Supabase accorde la lecture a anon : on ne le
    // copie pas, l'application n'en a jamais besoin.
    expect(migration).not.toMatch(/GRANT[^;]*TO\s+anon/i)
  })

  it('garde les deux tables de suivi en lecture seule pour la session', () => {
    const lectureSeule = migration.slice(migration.indexOf('lecture_seule text[]'))
    expect(lectureSeule.slice(0, 120)).toContain("'auto_fix_jobs'")
    expect(lectureSeule.slice(0, 120)).toContain("'auto_fixes'")
    const complet = migration.slice(migration.indexOf('complet text[]'), migration.indexOf('lecture_seule text[]'))
    expect(complet).not.toContain("'auto_fix_jobs'")
    expect(complet).not.toContain("'auto_fixes'")
  })

  it('ne donne jamais la session sur les tables reservees au serveur', () => {
    const complet = migration.slice(migration.indexOf('complet text[]'), migration.indexOf('BEGIN'))
    for (const reservee of [
      'app_config', 'exchange_rates_cache', 'notification_outbox',
      'sendcloud_sync_checkpoints', 'backup_20260724_shipments_markers',
      'backup_20260724_stock_snapshots',
    ]) {
      expect(complet).not.toContain(`'${reservee}'`)
    }
  })

  it('ne touche que les tables qui existent, pour survivre a une reconstruction', () => {
    expect(migration).toContain("to_regclass('public.' || t) IS NOT NULL")
  })
})

describe('migrations posterieures a 00143', () => {
  const posterieures = fichiers.filter((f) => numero(f) > numero(REFERENCE))

  it('aucune n accorde de droit a anon sur une table', () => {
    for (const f of posterieures) {
      expect(lire(f), f).not.toMatch(/GRANT[^;]*ON\s+(TABLE\s+)?(public\.)?\w+[^;]*TO\s+anon/i)
    }
  })

  it('chaque table creee porte ses droits pour le role serveur', () => {
    // Apres le 30/10, une table creee sans GRANT est injoignable.
    for (const f of posterieures) {
      const sql = lire(f)
      for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?(\w+)/gi)) {
        const table = m[1]
        const accorde = new RegExp(`GRANT[^;]*ON\\s+(TABLE\\s+)?(public\\.)?${table}\\b[^;]*TO[^;]*service_role`, 'i')
        expect(accorde.test(sql), `${f} cree ${table} sans GRANT a service_role`).toBe(true)
      }
    }
  })
})
