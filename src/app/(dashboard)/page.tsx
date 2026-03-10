'use client'

import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-48 rounded-full" />
      </div>

      {/* Hero KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-10 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-16 mb-1" />
            <Skeleton className="h-3 w-12" />
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-[250px] w-full rounded-lg" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-[250px] w-full rounded-lg" />
        </Card>
      </div>
    </div>
  )
}

const DashboardV2 = dynamic(
  () => import('@/components/dashboard-v2').then(m => ({ default: m.DashboardV2 })),
  { ssr: false, loading: () => <DashboardSkeleton /> }
)

export default function DashboardPage() {
  return (
    <div className="max-w-[1280px] mx-auto">
      <DashboardV2 />
    </div>
  )
}
