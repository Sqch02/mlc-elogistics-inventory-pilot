'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Truck, AlertTriangle, Info } from 'lucide-react'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCarrierName, formatEuro } from '@/lib/utils'

interface CarrierStats {
  carrier: string
  shipments: number
  totalCost: number
  avgCost: number
  claims: number
  claimRate: number
}

interface CarrierPerformanceProps {
  data: CarrierStats[]
  totalCarriers: number
  periodLabel?: string
}

// Color palette for carriers
const CARRIER_COLORS: Record<string, string> = {
  colissimo: '#FFD700',
  chronopost: '#00008B',
  mondial_relay: '#FF6B35',
  dhl: '#FFCC00',
  ups: '#351C15',
  gls: '#003399',
  dpd: '#DC0032',
  fedex: '#4D148C',
}

export function CarrierPerformance({ data, totalCarriers, periodLabel }: CarrierPerformanceProps) {
  const getCarrierName = (carrier: string) => formatCarrierName(carrier)

  const getCarrierColor = (carrier: string) => {
    return CARRIER_COLORS[carrier] || '#1E3A5F'
  }

  // Prepare chart data
  const chartData = data.slice(0, 6).map(d => ({
    ...d,
    name: getCarrierName(d.carrier),
  }))

  // Find carrier with highest claim rate
  const highestClaimRate = data.length > 0
    ? data.reduce((max, d) => d.claimRate > max.claimRate ? d : max, data[0])
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Truck className="h-5 w-5 text-muted-foreground" />
              Performance Transporteurs
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Methode de calcul"
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs leading-relaxed">
                      Donnees agregees sur la periode selectionnee,
                      par transporteur :
                      <br />
                      <br />
                      <strong>Expeditions</strong> : nombre de colis expedies
                      (hors retours).
                      <br />
                      <strong>Cout total</strong> : somme des tarifs
                      transporteur.
                      <br />
                      <strong>Cout moyen</strong> : cout total / nombre de
                      colis.
                      <br />
                      <strong>Taux de reclamations</strong> : reclamations
                      ouvertes / expeditions × 100.
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>{periodLabel ? `${periodLabel} • ${totalCarriers} transporteurs` : `${totalCarriers} transporteurs`}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value) => [Number(value || 0).toLocaleString('fr-FR'), 'Expéditions']}
              />
              <Bar dataKey="shipments" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCarrierColor(entry.carrier)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stats table */}
        <div className="mt-4 border-t pt-4">
          <div className="space-y-2">
            {data.slice(0, 4).map((carrier) => (
              <div key={carrier.carrier} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: getCarrierColor(carrier.carrier) }}
                  />
                  <span className="font-medium">{getCarrierName(carrier.carrier)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{formatEuro(carrier.avgCost)}/exp</span>
                  {carrier.claimRate > 0 && (
                    <Badge variant={carrier.claimRate > 1 ? 'destructive' : 'outline'} className="text-xs">
                      {carrier.claimRate.toFixed(2)}% récl.
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert for high claim rate */}
        {highestClaimRate && highestClaimRate.claimRate > 1 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span>
              <strong>{getCarrierName(highestClaimRate.carrier)}</strong> a le taux de réclamation le plus élevé ({highestClaimRate.claimRate.toFixed(2)}%)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
