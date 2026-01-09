import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ExpeditionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-4 p-4 bg-white rounded-2xl border">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Table skeleton */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
