'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface PricingRule {
  id: string
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

interface MissingPricing {
  carrier: string
  count: number
}

const columns: ColumnDef<PricingRule>[] = [
  {
    accessorKey: 'carrier',
    header: 'Transporteur',
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.carrier}</Badge>
    ),
  },
  {
    id: 'weight_range',
    header: 'Tranche poids',
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.original.weight_min_grams}g - {row.original.weight_max_grams}g
      </span>
    ),
  },
  {
    accessorKey: 'price_eur',
    header: 'Prix (EUR)',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.price_eur.toFixed(2)} EUR</span>
    ),
  },
]

export default function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([])
  const [missingPricing, setMissingPricing] = useState<MissingPricing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPricing()
  }, [])

  async function fetchPricing() {
    try {
      const [rulesRes, shipmentsRes] = await Promise.all([
        fetch('/api/pricing'),
        fetch('/api/shipments?pricing_status=missing'),
      ])

      const rulesData = await rulesRes.json()
      const shipmentsData = await shipmentsRes.json()

      setRules(rulesData.rules || [])

      // Group missing pricing by carrier
      const shipments = shipmentsData.shipments || []
      const missingByCarrier: Record<string, number> = {}
      shipments.forEach((s: { carrier: string }) => {
        missingByCarrier[s.carrier] = (missingByCarrier[s.carrier] || 0) + 1
      })

      setMissingPricing(
        Object.entries(missingByCarrier).map(([carrier, count]) => ({
          carrier,
          count,
        }))
      )
    } catch (error) {
      console.error('Error fetching pricing:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group rules by carrier
  const rulesByCarrier = rules.reduce((acc, rule) => {
    if (!acc[rule.carrier]) {
      acc[rule.carrier] = []
    }
    acc[rule.carrier].push(rule)
    return acc
  }, {} as Record<string, PricingRule[]>)

  const carriers = Object.keys(rulesByCarrier).sort()

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Grille Tarifaire</h1>
        <p className="text-muted-foreground">
          Tarifs transport par transporteur et tranche de poids
        </p>
      </div>

      {missingPricing.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Tarifs manquants detectes:</strong>
            <ul className="mt-2 list-disc list-inside">
              {missingPricing.map((m) => (
                <li key={m.carrier}>
                  {m.carrier}: {m.count} expedition(s) sans tarif
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">
              Importez les tarifs manquants depuis{' '}
              <a href="/parametres" className="underline">
                Parametres → Import Pricing
              </a>
            </p>
          </AlertDescription>
        </Alert>
      )}

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Aucune grille tarifaire configuree. Importez vos tarifs depuis{' '}
              <a href="/parametres" className="underline">
                Parametres → Import
              </a>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {carriers.map((carrier) => (
            <Card key={carrier}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge>{carrier}</Badge>
                  <span className="text-muted-foreground font-normal text-sm">
                    ({rulesByCarrier[carrier].length} tranches)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={rulesByCarrier[carrier].sort(
                    (a, b) => a.weight_min_grams - b.weight_min_grams
                  )}
                  searchKey="carrier"
                  searchPlaceholder=""
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Regles de tarification</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Matching:</strong> Le tarif est determine par le transporteur et le poids
            de l expedition (poids label Sendcloud).
          </p>
          <p>
            <strong>Tranches:</strong> min inclusif, max exclusif.
            Exemple: 0g-500g inclut les poids de 0 a 499g.
          </p>
          <p>
            <strong>Tarif manquant:</strong> Si aucune tranche ne correspond, l expedition
            est marquee tarif manquant et exclue du total facture.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
