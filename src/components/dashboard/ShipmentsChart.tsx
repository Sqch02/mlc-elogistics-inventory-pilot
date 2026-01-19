"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardChartData } from "@/types/dashboard"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

interface ShipmentsChartProps {
  data: DashboardChartData[]
}

export function ShipmentsChart({ data }: ShipmentsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full min-h-[350px]">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Expeditions par jour</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p>Aucune donnee disponible pour ce mois</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full min-h-[350px]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Expeditions par jour</CardTitle>
          <span className="text-xs text-muted-foreground font-medium">
            {data.reduce((acc, d) => acc + d.shipments, 0)} total
          </span>
        </div>
      </CardHeader>
      <CardContent className="pl-0 pr-4 pb-2">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DC" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="#6B6B6B"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => new Date(value).getDate().toString()}
                dy={10}
              />
              <YAxis
                stroke="#6B6B6B"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                dx={-10}
              />
              <Tooltip
                cursor={{ fill: 'rgba(27, 77, 62, 0.04)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-border/60 bg-white p-3 shadow-lg">
                        <div className="grid gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                            {new Date(payload[0].payload.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                          <span className="font-semibold text-foreground text-lg">
                            {payload[0].value} <span className="text-sm font-normal text-muted-foreground">expeditions</span>
                          </span>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar
                dataKey="shipments"
                fill="#1E3A5F"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
