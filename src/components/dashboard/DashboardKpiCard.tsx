"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"
import { DashboardKPIData } from "@/types/dashboard"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

interface KpiCardProps {
  title: string
  iconName: keyof typeof LucideIcons
  data: DashboardKPIData
}

export function KpiCard({ title, iconName, data }: KpiCardProps) {
  const Icon = LucideIcons[iconName] as LucideIcons.LucideIcon

  return (
    <Card className="overflow-hidden border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className={cn("p-1.5 rounded-md bg-muted/30 text-muted-foreground", 
          data.status === 'success' && "bg-green-50 text-green-700",
          data.status === 'warning' && "bg-amber-50 text-amber-700",
          data.status === 'danger' && "bg-red-50 text-red-700"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-semibold text-foreground tracking-tight">{data.value}</div>
            {data.subValue && (
              <p className="text-xs text-muted-foreground mt-1 font-medium">{data.subValue}</p>
            )}
          </div>
          
          {data.trend && (
            <div className={cn("flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
              data.trend.isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            )}>
              {data.trend.isPositive ? "+" : ""}{data.trend.value}%
            </div>
          )}
        </div>

        {data.sparklineData && (
          <div className="h-[32px] mt-3 -mx-6 -mb-6 opacity-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sparklineData}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1F7A5A" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#1F7A5A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#1F7A5A"
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
