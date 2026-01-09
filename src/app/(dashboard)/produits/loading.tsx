import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProduitsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 p-4 bg-white rounded-2xl border">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Table */}
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
