"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DashboardKPIData } from "@/types/dashboard"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

interface KpiCardProps {
  title: string
  icon: LucideIcon
  data: DashboardKPIData
}

export function KpiCard({ title, icon: Icon, data }: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-md bg-muted/50", 
          data.status === 'success' && "bg-green-100 text-green-700",
          data.status === 'warning' && "bg-amber-100 text-amber-700",
          data.status === 'danger' && "bg-red-100 text-red-700"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-bold">{data.value}</div>
            {data.subValue && (
              <p className="text-xs text-muted-foreground mt-1">{data.subValue}</p>
            )}
          </div>
          
          {data.trend && (
            <div className={cn("flex items-center text-xs font-medium",
              data.trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {data.trend.isPositive ? "+" : ""}{data.trend.value}%
            </div>
          )}
        </div>

        {data.sparklineData && (
          <div className="h-[40px] mt-4 -mx-6 -mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sparklineData}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E3A5F" stopOpacity={0.1}/>
                    <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#1E3A5F"
                  strokeWidth={2}
                  fill={`url(#gradient-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
