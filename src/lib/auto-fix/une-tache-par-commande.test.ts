import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Releve le 21/09 : 18 taches en file manuelle pour 15 commandes. La commande
 * #564722, en leu roumain, en portait trois a elle seule — detectee le 19 en
 * erreur latente, puis deux fois le 21 apres l'echec d'annonce. Meme commande,
 * meme motif, meme travail : l'exploitant voyait trois lignes.
 *
 * La cle d'operation dedoublonne une MEME detection ; elle ne dit rien d'une
 * redetection dans un contexte different.
 */
const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00140_une_seule_tache_manuelle_par_commande_et_motif.sql'),
  'utf8',
)

// La borne vise la clause reelle, pas le mot present dans les commentaires.
const garde = migration.slice(
  migration.indexOf('AND NOT EXISTS'),
  migration.indexOf('ON CONFLICT (operation_key)'),
)

describe('une seule tache manuelle par commande et par motif', () => {
  it('la garde compare le client, la commande ET le motif', () => {
    expect(garde).toContain('ouverte.tenant_id = i.tenant_id')
    expect(garde).toContain('ouverte.source_order_ref = i.source_order_ref')
    expect(garde).toContain('ouverte.primary_pattern = i.primary_pattern')
  })

  it('ne bloque que sur une tache encore devant l exploitant', () => {
    // Une tache close ne doit rien bloquer : une erreur qui revient doit
    // pouvoir etre redetectee.
    expect(garde).toContain("ouverte.state = 'pending_manual'")
    for (const terminal of ['verified', 'obsolete', 'manual_resolved', 'permanent_failed']) {
      expect(garde).not.toContain(terminal)
    }
  })

  it('laisse passer la meme cle, sinon la tache existante ne serait plus rafraichie', () => {
    expect(garde).toContain('ouverte.operation_key <> i.operation_key')
  })

  it('ne bloque pas sur une commande sans numero', () => {
    // source_order_ref null des deux cotes s'egaliserait a NULL, mais la
    // garde doit etre explicite : deux taches sans numero ne sont pas la
    // meme commande.
    expect(garde).toContain('ouverte.source_order_ref IS NOT NULL')
  })

  it('le reste de la fonction est inchange', () => {
    // La garde s'ajoute, elle ne remplace rien : la cle d'operation reste le
    // dedoublonnage principal et le rafraichissement reste en place.
    expect(migration).toContain('ON CONFLICT (operation_key) DO UPDATE SET')
    expect(migration).toContain('last_seen_at = now()')
    expect(migration).toContain('source_order_ref = COALESCE(auto_fix_jobs.source_order_ref, EXCLUDED.source_order_ref)')
    expect(migration).toContain('jsonb_array_length(p_jobs) > 250')
  })
})
