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
          <CardTitle className="text-base font-semibold">Expéditions par jour</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
          Aucune donnée disponible pour ce mois
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full min-h-[350px] shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">Expéditions par jour</CardTitle>
      </CardHeader>
      <CardContent className="pl-0 pr-4 pb-2">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => new Date(value).getDate().toString()}
                dy={10}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                dx={-10}
              />
              <Tooltip
                cursor={{ fill: '#F3F4F6' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-border bg-white p-3 shadow-md">
                        <div className="grid gap-1">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-medium">
                              {new Date(payload[0].payload.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                            <span className="font-semibold text-foreground text-sm">
                              {payload[0].value} expéditions
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar
                dataKey="shipments"
                fill="#1F7A5A"
                radius={[4, 4, 0, 0]}
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
