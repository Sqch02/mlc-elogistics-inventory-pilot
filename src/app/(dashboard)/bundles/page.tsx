'use client'

import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Card className="p-4">
        <div className="flex gap-3 mb-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}

const BundlesClient = dynamic(
  () => import('./BundlesClient').then(m => ({ default: m.BundlesClient })),
  { ssr: false, loading: () => <PageSkeleton /> }
)

export default function BundlesPage() {
  return <BundlesClient />
}
