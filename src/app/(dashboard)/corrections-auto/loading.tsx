import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function CorrectionsAutoLoading() {
  return (
    <div className="space-y-6" aria-label="Chargement des corrections automatiques">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="mb-4 h-10 w-10 rounded-lg" />
            <Skeleton className="mb-2 h-7 w-16" />
            <Skeleton className="h-4 w-28" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
