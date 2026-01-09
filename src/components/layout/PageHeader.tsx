"use client"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode // For actions/filters
  className?: string
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-3">
          {children}
        </div>
      )}
    </div>
  )
}

