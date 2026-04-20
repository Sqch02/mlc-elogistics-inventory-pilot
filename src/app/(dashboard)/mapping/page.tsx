'use client'

import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}

const MappingClient = dynamic(
  () => import('./MappingClient').then((m) => ({ default: m.MappingClient })),
  { ssr: false, loading: () => <PageSkeleton /> }
)

export default function MappingPage() {
  return <MappingClient />
}
