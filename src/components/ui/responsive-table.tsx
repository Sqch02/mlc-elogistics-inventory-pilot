'use client'

import { cn } from '@/lib/utils'

interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0", className)}>
      <div className="min-w-[600px] sm:min-w-0">
        {children}
      </div>
    </div>
  )
}
