'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MonthlyData {
  month: string
  shipments: number
  cost: number
  claims: number
  indemnity: number
}

interface CostTrendChartProps {
  data: MonthlyData[]
  percentChange: number
  shipmentsPercentChange: number
}

export function CostTrendChart({ data, percentChange, shipmentsPercentChange }: CostTrendChartProps) {
  // Format month labels (YYYY-MM -> Jan, Feb, etc.)
  const chartData = data.map(d => {
    const [year, month] = d.month.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    const label = date.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()
    return {
      ...d,
      label,
      costK: Math.round(d.cost / 100) / 10, // Convert to K€ for better readability
    }
  })

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-red-500" />
    if (value < 0) return <TrendingDown className="h-4 w-4 text-emerald-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const currentMonth = data[data.length - 1]

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Évolution des Coûts</CardTitle>
            <CardDescription>Coûts transport sur 12 mois</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatEuro(currentMonth?.cost || 0)}</p>
            <div className="flex items-center justify-end gap-1 text-sm">
              <TrendIcon value={percentChange} />
              <span className={percentChange > 0 ? 'text-red-500' : percentChange < 0 ? 'text-emerald-500' : 'text-gray-500'}>
                {percentChange > 0 ? '+' : ''}{percentChange}% vs mois dernier
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                yAxisId="cost"
                orientation="left"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => `${value}k€`}
              />
              <YAxis
                yAxisId="shipments"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value, name) => {
                  const v = Number(value) || 0
                  if (name === 'Coût') return [formatEuro(v * 1000), name]
                  return [v, name]
                }}
              />
              <Legend />
              <Line
                yAxisId="cost"
                type="monotone"
                dataKey="costK"
                name="Coût"
                stroke="#1F7A5A"
                strokeWidth={2}
                dot={{ fill: '#1F7A5A', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#1F7A5A' }}
              />
              <Line
                yAxisId="shipments"
                type="monotone"
                dataKey="shipments"
                name="Expéditions"
                stroke="#008080"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#008080', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Expéditions ce mois</p>
            <p className="text-xl font-semibold">{currentMonth?.shipments || 0}</p>
            <div className="flex items-center justify-center gap-1 text-xs">
              <TrendIcon value={shipmentsPercentChange} />
              <span className={shipmentsPercentChange > 0 ? 'text-emerald-500' : shipmentsPercentChange < 0 ? 'text-red-500' : 'text-gray-500'}>
                {shipmentsPercentChange > 0 ? '+' : ''}{shipmentsPercentChange}%
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Réclamations indemnisées</p>
            <p className="text-xl font-semibold">{formatEuro(currentMonth?.indemnity || 0)}</p>
            <p className="text-xs text-muted-foreground">{currentMonth?.claims || 0} réclamation(s)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
