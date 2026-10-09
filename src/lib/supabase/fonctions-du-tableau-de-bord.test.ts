import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Le 30/05, le durcissement de securite a reecrit get_dashboard_metrics de SQL
 * en PL/pgSQL. En PL/pgSQL, les colonnes de sortie d'un RETURNS TABLE
 * deviennent des variables : citees sans prefixe dans une requete qui lit une
 * colonne du meme nom, elles font echouer CHAQUE appel (42702, colonne
 * ambigue). Le tableau de bord a affiche 0 pendant plus de quatre mois.
 *
 * Ce garde-fou relit les migrations : toute fonction PL/pgSQL a RETURNS TABLE
 * ajoutee depuis 00147 doit prefixer ses colonnes (ou declarer
 * #variable_conflict). Il est valide contre la version fautive du 30/05.
 */
const dossier = join(process.cwd(), 'supabase', 'migrations')
const lire = (fichier: string) => readFileSync(join(dossier, fichier), 'utf8')
const numero = (fichier: string) => Number(fichier.slice(0, 5))

/** Contenu entre la parenthese ouvrante a `debut` et sa fermante. */
function entreParentheses(texte: string, debut: number): string {
  let profondeur = 0
  for (let i = debut; i < texte.length; i++) {
    if (texte[i] === '(') profondeur++
    if (texte[i] === ')' && --profondeur === 0) return texte.slice(debut + 1, i)
  }
  return ''
}

/** Les colonnes de sortie citees sans prefixe dans le corps, par fonction. */
function colonnesCiteesSansPrefixe(sql: string): Record<string, string[]> {
  const resultat: Record<string, string[]> = {}
  const morceaux = sql.split(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+/i).slice(1)
  for (const morceau of morceaux) {
    const nom = morceau.match(/^(?:public\.)?(\w+)/)?.[1] ?? '?'
    const table = morceau.search(/RETURNS\s+TABLE\s*\(/i)
    const corpsDebut = morceau.match(/AS\s+(\$\w*\$)/)
    if (table < 0 || !corpsDebut || !/LANGUAGE\s+plpgsql/i.test(morceau)) continue
    const sorties = entreParentheses(morceau, morceau.indexOf('(', table))
      .split(',')
      .map((colonne) => colonne.trim().split(/\s+/)[0])
      .filter(Boolean)
    const tag = corpsDebut[1]
    const debut = morceau.indexOf(tag) + tag.length
    let corps = morceau.slice(debut, morceau.indexOf(tag, debut))
    if (corps.includes('#variable_conflict')) continue
    corps = corps.replace(/--[^\n]*/g, ' ').replace(/'[^']*'/g, "''")
    const fautives = sorties.filter((sortie) =>
      [...corps.matchAll(new RegExp(`(?<![.\\w])${sortie}(?!\\w)`, 'gi'))].some(
        (m) => !/AS\s+$/i.test(corps.slice(Math.max(0, m.index - 4), m.index)),
      ),
    )
    if (fautives.length) resultat[nom] = fautives
  }
  return resultat
}

describe('colonnes ambigues en PL/pgSQL', () => {
  it('attrape la version du 30/05 qui a casse le tableau de bord', () => {
    const fautive = lire('00055_p0_secu_tenant_guard_dashboard_and_cursors.sql')
    expect(colonnesCiteesSansPrefixe(fautive).get_dashboard_metrics).toEqual(
      expect.arrayContaining(['shipments_count', 'shipments_cost', 'shipments_missing_pricing']),
    )
  })

  it('aucune migration depuis 00147 ne cite une colonne de sortie sans prefixe', () => {
    const recentes = readdirSync(dossier)
      .filter((f) => f.endsWith('.sql') && !f.startsWith('ROLLBACK') && numero(f) >= 147)
    expect(recentes.length).toBeGreaterThan(0)
    for (const fichier of recentes) {
      expect(colonnesCiteesSansPrefixe(lire(fichier)), fichier).toEqual({})
    }
  })
})

describe('chiffres du tableau de bord', () => {
  it('get_dashboard_metrics garde la garde de client et les droits', () => {
    const sql = lire('00147_reparer_les_chiffres_du_tableau_de_bord.sql')
    expect(sql).toContain('SUM(d.shipments_count)')
    expect(sql).toContain("forbidden: cannot access tenant %")
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_dashboard_metrics\([^)]*\) FROM PUBLIC, anon/)
    expect(sql).not.toMatch(/GRANT[^;]*TO[^;]*anon/i)
  })

  it('l evolution mensuelle lit la vue, plus les colis un par un', () => {
    const sql = lire('00148_evolution_mensuelle_depuis_la_vue.sql')
    const corps = sql.slice(sql.indexOf('RETURN QUERY'))
    expect(corps).toContain('FROM public.mv_dashboard_daily d')
    expect(corps).not.toMatch(/FROM\s+(public\.)?shipments\b/)
  })

  it('la derniere synchro se lit par un index qui suit la date de fin', () => {
    expect(lire('00149_index_derniere_synchro.sql'))
      .toMatch(/ON public\.sync_runs \(tenant_id, source, ended_at DESC\)/)
  })
})

describe('transporteurs et bundles', () => {
  const sql = lire('00150_vues_transporteurs_et_bundles.sql')

  it('les deux vues ne sont lisibles que par le role serveur', () => {
    expect(sql).toContain('REVOKE ALL ON public.mv_carrier_daily, public.mv_bundle_daily FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('GRANT SELECT ON public.mv_carrier_daily, public.mv_bundle_daily TO service_role')
  })

  it('sont rafraichies par une tache a part, qui ne bloque pas les vues existantes', () => {
    expect(sql).toMatch(/cron\.schedule\(\s*'refresh-activity-views'/)
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.refresh_all_analytics_views')
  })

  it('les fonctions lisent les vues au lieu de relire les colis', () => {
    const transporteurs = sql.slice(sql.indexOf('FUNCTION public.get_carrier_performance'), sql.indexOf('FUNCTION public.get_products_metrics'))
    expect(transporteurs).toContain('FROM public.mv_carrier_daily m')
    const produits = sql.slice(sql.indexOf('FUNCTION public.get_products_metrics'))
    expect(produits).toContain('FROM public.mv_bundle_daily bd')
    expect(produits).not.toMatch(/JOIN\s+(public\.)?shipments\b/)
  })

  it('force un plan calcule avec les vraies dates pour les indicateurs produits', () => {
    // Le plan generique garde en cache relisait toute l'histoire : coupe a 8 s
    // meme sur un mois, 0,3 s une fois force.
    const produits = sql.slice(sql.indexOf('FUNCTION public.get_products_metrics'))
    expect(produits).toContain("SET plan_cache_mode TO 'force_custom_plan'")
  })
})
