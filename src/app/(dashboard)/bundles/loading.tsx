import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function BundlesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
