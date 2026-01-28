'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
  // Prepare data for chart - truncate long names
  const chartData = data.map((item, index) => ({
    ...item,
    shortCode: item.sku_code.length > 15 ? item.sku_code.slice(0, 15) + '...' : item.sku_code,
    fill: COLORS[index % COLORS.length],
  }))

  const maxQuantity = Math.max(...data.map(d => d.quantity_sold), 1)

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5 text-muted-foreground" />
              Produits vendus par SKU
            </CardTitle>
            <CardDescription>
              Top 10 des produits les plus expedies sur la periode
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{totalSkus} SKUs</Badge>
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
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, maxQuantity]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toLocaleString('fr-FR')}
                />
                <YAxis
                  type="category"
                  dataKey="shortCode"
                  tick={{ fontSize: 11 }}
                  width={95}
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
