'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SkuSalesData {
  sku_id: string
  sku_code: string
  name: string
  quantity_sold: number
}

interface SkuSalesChartProps {
  data: SkuSalesData[]
  totalSkus: number
  totalQuantity: number
}

const COLORS = [
  '#059669', // emerald-600
  '#0891b2', // cyan-600
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
  '#c026d3', // fuchsia-600
  '#dc2626', // red-600
  '#ea580c', // orange-600
  '#ca8a04', // yellow-600
  '#16a34a', // green-600
  '#0d9488', // teal-600
]

export function SkuSalesChart({ data, totalSkus, totalQuantity }: SkuSalesChartProps) {
  // Prepare data for chart. On affiche le NOM du produit (pas le code SKU
  // technique) : la cliente veut voir "combien de Perte de Poids vendus", pas
  // "FLRN-PPOIDS-FBCG" (demande Florna 25/06).
  const chartData = data.map((item, index) => {
    const label = item.name || item.sku_code
    return {
      ...item,
      shortName: label.length > 24 ? label.slice(0, 24) + '…' : label,
      fill: COLORS[index % COLORS.length],
    }
  })

  const maxQuantity = Math.max(...data.map(d => d.quantity_sold), 1)

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5 text-muted-foreground" />
              Unités vendues par produit
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground/70 hover:text-foreground transition-colors"
                      aria-label="Plus d'informations"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs leading-relaxed">
                      Nombre d&apos;articles physiques reellement expedies. Les bundles (ex: Pack Minceur = 3 flacons) sont automatiquement decomposes en composants individuels. Ce chiffre represente ce qui sort de l&apos;entrepot, pas les lignes Shopify.
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Tous les produits, du plus vendu au moins vendu, sur la periode
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{totalSkus} produits</Badge>
            <Badge variant="success">{totalQuantity.toLocaleString('fr-FR')} unites</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aucune vente sur cette periode</p>
          </div>
        ) : (
          <div style={{ height: Math.max(300, data.length * 42 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 140, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, maxQuantity]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toLocaleString('fr-FR')}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  tick={{ fontSize: 11 }}
                  width={135}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as SkuSalesData & { fill: string }
                      return (
                        <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
                          <p className="font-mono font-medium text-sm">{item.sku_code}</p>
                          <p className="text-xs text-muted-foreground mb-2 max-w-[200px] truncate">{item.name}</p>
                          <p className="font-bold text-lg" style={{ color: item.fill }}>
                            {item.quantity_sold.toLocaleString('fr-FR')} unites
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="quantity_sold" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="quantity_sold"
                    position="right"
                    formatter={(value) => Number(value).toLocaleString('fr-FR')}
                    style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
                  />
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
