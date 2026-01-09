import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ParametresLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      <Skeleton className="h-10 w-[400px]" />

      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
