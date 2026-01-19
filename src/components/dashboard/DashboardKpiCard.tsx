"use client"

import { Card, CardContent } from "@/components/ui/card"
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

  // Status-based accent colors
  const statusColors = {
    success: {
      border: "border-l-success",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    warning: {
      border: "border-l-warning",
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
    },
    danger: {
      border: "border-l-error",
      iconBg: "bg-error/10",
      iconColor: "text-error",
    },
    default: {
      border: "border-l-primary",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
  }

  const colors = statusColors[data.status || 'default'] || statusColors.default

  return (
    <Card className={cn(
      "overflow-hidden border-l-[3px] transition-all duration-200",
      "hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5",
      colors.border
    )}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <div className={cn(
            "p-2 rounded-lg",
            colors.iconBg
          )}>
            <Icon className={cn("h-4 w-4", colors.iconColor)} />
          </div>
        </div>

        {/* Value */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[28px] font-semibold text-foreground tracking-tight leading-none">
              {data.value}
            </div>
            {data.subValue && (
              <p className="text-xs text-muted-foreground mt-1.5">{data.subValue}</p>
            )}
          </div>

          {data.trend && (
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full",
              data.trend.isPositive
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            )}>
              {data.trend.isPositive ? (
                <LucideIcons.TrendingUp className="h-3 w-3" />
              ) : (
                <LucideIcons.TrendingDown className="h-3 w-3" />
              )}
              {data.trend.isPositive ? "+" : ""}{data.trend.value}%
            </div>
          )}
        </div>

        {/* Sparkline */}
        {data.sparklineData && (
          <div className="h-[36px] mt-4 -mx-5 -mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sparklineData}>
                <defs>
                  <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E3A5F" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#1E3A5F"
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title.replace(/\s/g, '')})`}
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
