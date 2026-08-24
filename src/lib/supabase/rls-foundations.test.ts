import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Une base reconstruite depuis ce depot doit fonctionner.
 *
 * `get_tenant_id`, `is_super_admin` et `get_my_profile` n'existaient QUE dans
 * la base de production : aucune migration ne les creait. 94 politiques RLS
 * sur 28 tables les appellent — c'est toute l'isolation entre clients. Une
 * reprise apres incident, un environnement de recette ou un poste neuf
 * n'auraient eu aucune des trois.
 *
 * L'ORDRE compte autant que l'existence. La premiere politique qui s'y refere
 * apparait des la migration 00018 : une definition ajoutee en fin de liste ne
 * repare rien, la reconstruction echoue avant de l'atteindre. Le test verifie
 * donc que la creation precede le premier usage, pas seulement qu'elle existe.
 */
const FONCTIONS = ['get_tenant_id', 'is_super_admin', 'get_my_profile']

const dossier = join(process.cwd(), 'supabase', 'migrations')
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()
const contenus = new Map(fichiers.map((f) => [f, readFileSync(join(dossier, f), 'utf8')]))

function premierFichier(predicat: (sql: string) => boolean): string | null {
  return fichiers.find((f) => predicat(contenus.get(f) ?? '')) ?? null
}

describe('fondations RLS versionnees', () => {
  it('trouve bien des migrations a inspecter', () => {
    // Sans cette garde, un dossier introuvable rendrait tout le reste vert.
    expect(fichiers.length).toBeGreaterThan(50)
  })

  it.each(FONCTIONS)('%s est creee par une migration', (nom) => {
    const creation = premierFichier((sql) =>
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nom}\\s*\\(`).test(sql),
    )
    expect(creation).not.toBeNull()
  })

  it.each(FONCTIONS)('%s est creee AVANT sa premiere utilisation', (nom) => {
    const creation = premierFichier((sql) =>
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nom}\\s*\\(`).test(sql),
    )
    const usage = premierFichier((sql) => {
      const sansBruit = sql
        // La definition elle-meme n'est pas un usage.
        .replace(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nom}[\\s\\S]*?\\$function\\$;`, 'g'), '')
        // Attribuer un droit sur une fonction ne l'APPELLE pas.
        .replace(/^\s*(GRANT|REVOKE)\b.*$/gm, '')
      return new RegExp(`\\b(public\\.)?${nom}\\s*\\(\\s*\\)`).test(sansBruit)
    })

    expect(creation).not.toBeNull()
    if (usage === null) return // jamais appelee depuis une migration : rien a ordonner
    expect(creation!.localeCompare(usage)).toBeLessThan(0)
  })
})
