import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function RetoursLoading() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 lg:h-8 w-36 lg:w-48" />
          <Skeleton className="h-4 w-28 lg:w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3 lg:p-4">
            <Skeleton className="h-3 lg:h-4 w-16 lg:w-20 mb-2" />
            <Skeleton className="h-6 lg:h-8 w-12 lg:w-16" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
