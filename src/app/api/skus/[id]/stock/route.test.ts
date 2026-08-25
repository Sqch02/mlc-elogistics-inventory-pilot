import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('tenant-1'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  requireRole: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/untyped', () => ({
  getServerDb: vi.fn(),
}))

import { PATCH } from './route'
import { getServerDb } from '@/lib/supabase/untyped'

const mockGetServerDb = getServerDb as ReturnType<typeof vi.fn>

/** Un client minimal : un SKU du bon client, et un stock courant donne. */
function client(stockReel: number) {
  const ecritures: Record<string, unknown>[] = []
  return {
    ecritures,
    from: vi.fn((table: string) => {
      if (table === 'skus') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'sku-1', sku_code: 'ABC' } }),
        }
      }
      if (table === 'stock_snapshots') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { qty_current: stockReel } }),
          upsert: vi.fn((row: Record<string, unknown>) => {
            ecritures.push(row)
            return Promise.resolve({ error: null })
          }),
        }
      }
      return {
        insert: vi.fn((row: Record<string, unknown>) => {
          ecritures.push(row)
          return Promise.resolve({ error: null })
        }),
      }
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  }
}

function requete(corps: unknown) {
  return new NextRequest('http://localhost/api/skus/sku-1/stock', {
    method: 'PATCH',
    body: JSON.stringify(corps),
    headers: { 'Content-Type': 'application/json' },
  })
}

const params = Promise.resolve({ id: 'sku-1' })

describe('ajustement de stock', () => {
  beforeEach(() => vi.clearAllMocks())

  /**
   * Le 25/08, un arrivage de 100 flacons a ete accepte pendant qu'une page
   * Produits ouverte affichait encore 0. L'operateur a saisi +99 en voyant
   * l'apercu annoncer "Nouveau stock: 99". Le serveur a applique ces 99 au
   * stock reel, deja passe a 100 : 199 au lieu de 99. Cent unites d'ecart,
   * sans le moindre message.
   */
  it('refuse un ajustement calcule sur un stock qui a change depuis', async () => {
    mockGetServerDb.mockResolvedValue(client(100))

    const reponse = await PATCH(requete({ adjustment: 99, expected_qty: 0 }), { params })
    const corps = await reponse.json()

    expect(reponse.status).toBe(409)
    // Le message doit dire quoi faire, pas seulement que ca a rate.
    expect(corps.detail).toContain('0')
    expect(corps.detail).toContain('100')
    expect(corps.detail).toContain('Rechargez')
  })

  it('applique un ajustement calcule sur la bonne valeur', async () => {
    const db = client(100)
    mockGetServerDb.mockResolvedValue(db)

    const reponse = await PATCH(requete({ adjustment: 99, expected_qty: 100 }), { params })
    const corps = await reponse.json()

    expect(reponse.status).toBe(200)
    expect(corps.previous_qty).toBe(100)
    expect(corps.new_qty).toBe(199)
  })

  it('exige de savoir sur quelle valeur l ajustement a ete calcule', async () => {
    mockGetServerDb.mockResolvedValue(client(100))

    const reponse = await PATCH(requete({ adjustment: 99 }), { params })

    // Sans cette exigence, un appelant qui oublie le champ retrouve
    // exactement le defaut qu'on vient de corriger.
    expect(reponse.status).toBe(400)
  })

  it('laisse passer une valeur absolue sans exiger la valeur attendue', async () => {
    mockGetServerDb.mockResolvedValue(client(100))

    const reponse = await PATCH(requete({ qty_current: 99 }), { params })
    const corps = await reponse.json()

    // Poser un chiffre ne depend d'aucune base de calcul : il n'y a rien a
    // verifier, et c'est la sortie de secours quand le stock a bouge.
    expect(reponse.status).toBe(200)
    expect(corps.new_qty).toBe(99)
  })
})
