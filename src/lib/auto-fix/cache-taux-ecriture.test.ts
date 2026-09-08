import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSupabaseExchangeRateRepository } from './exchange-rate'

/**
 * Le 08/09, la commande #560292 a ete refusee pour « taux indisponible » alors
 * que la Banque centrale repondait. Cause : le tableau de bord du moteur ecrivait
 * le cache des taux avec une COPIE LOCALE du depot, qui oubliait `expires_at`.
 * La table l'exige des qu'un taux est renseigne, l'ecriture violait la
 * contrainte, et l'erreur n'etait pas regardee. Le cache est donc reste vide
 * depuis sa creation : chaque commande en francs rappelait la BCE, et le
 * premier hoquet reseau refusait la commande.
 *
 * Le test ne verifie pas UN champ. Il verifie la correspondance ENTIERE entre
 * ce que la contrainte de la table exige et ce que le depot ecrit. Une colonne
 * ajoutee a la contrainte et oubliee dans le code fera echouer ce test.
 */
const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/00094_exchange_rates_cache.sql'),
  'utf8',
)

function colonnesExigeesParLaContrainte(): string[] {
  const bloc = migration.slice(migration.indexOf('exchange_rates_cache_complete_rate'))
  // La branche « taux renseigne » est celle qui enumere les NOT NULL.
  const branche = bloc.slice(bloc.indexOf('OR'), bloc.indexOf('CONSTRAINT exchange_rates_cache_provider'))
  return [...new Set([...branche.matchAll(/(\w+) IS NOT NULL/g)].map((m) => m[1]))].sort()
}

async function ligneEcriteParLeDepot(): Promise<Record<string, unknown>> {
  let capturee: Record<string, unknown> = {}
  const client = {
    from() {
      return {
        async upsert(ligne: Record<string, unknown>) {
          capturee = ligne
          return { error: null }
        },
      }
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await createSupabaseExchangeRateRepository(client as any).save({
    baseCurrency: 'CHF', targetCurrency: 'EUR',
    rate: '1.063264221159', rateDate: '2026-09-07',
    provider: 'ECB', providerSeries: 'EXR.D.CHF.EUR.SP00.A',
    providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: '0.9405' },
    fetchedAt: '2026-09-08T06:00:00.000Z',
    expiresAt: '2026-09-09T06:00:00.000Z',
    cacheStatus: 'refreshed',
  })
  return capturee
}

describe('ecriture du cache des taux', () => {
  it('ecrit toutes les colonnes que la contrainte de la table exige', async () => {
    const exigees = colonnesExigeesParLaContrainte()
    expect(exigees).toContain('expires_at')
    expect(exigees.length).toBeGreaterThanOrEqual(6)

    const ligne = await ligneEcriteParLeDepot()
    const manquantes = exigees.filter(
      (colonne) => ligne[colonne] === undefined || ligne[colonne] === null,
    )
    expect(manquantes).toEqual([])
  })

  it('pose la date de peremption apres la date de recuperation', async () => {
    const ligne = await ligneEcriteParLeDepot()
    // La contrainte l'exige : expires_at > fetched_at.
    expect(new Date(String(ligne.expires_at)).getTime())
      .toBeGreaterThan(new Date(String(ligne.fetched_at)).getTime())
  })

  it('remonte l echec d ecriture au lieu de l avaler', async () => {
    const client = {
      from() {
        return { async upsert() { return { error: { message: 'violates check constraint' } } } }
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const depot = createSupabaseExchangeRateRepository(client as any)
    // Un cache dont l'ecriture est ignoree ne se repare jamais : il faut que
    // l'echec remonte, sinon le taux repart chercher la BCE a chaque commande.
    await expect(depot.save({
      baseCurrency: 'CHF', targetCurrency: 'EUR', rate: '1.06', rateDate: '2026-09-07',
      provider: 'ECB', providerSeries: 'EXR.D.CHF.EUR.SP00.A',
      providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: '0.9405' },
      fetchedAt: '2026-09-08T06:00:00.000Z', expiresAt: '2026-09-09T06:00:00.000Z',
      cacheStatus: 'refreshed',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)).rejects.toThrow(/exchange_rates_cache write/)
  })

  it('aucune route ne reecrit le cache pour son compte', () => {
    // La copie locale du depot est precisement ce qui a casse le cache.
    const routes = ['src/app/api/auto-fix/run-live/route.ts', 'src/app/api/auto-fix/run/route.ts']
    for (const chemin of routes) {
      let source: string
      try { source = readFileSync(join(process.cwd(), chemin), 'utf8') } catch { continue }
      expect(source).not.toMatch(/from\(['"]exchange_rates_cache['"]\)/)
    }
  })
})
