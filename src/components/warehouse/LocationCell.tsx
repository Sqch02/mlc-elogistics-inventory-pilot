'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Location } from '@/hooks/useLocations'

interface LocationCellProps {
  location: Location
  onClick: () => void
  compact?: boolean
}

export function LocationCell({ location, onClick, compact = false }: LocationCellProps) {
  const statusColors = {
    occupied: 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300',
    empty: 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300',
    blocked: 'bg-orange-50 border-orange-200 hover:bg-orange-100 hover:border-orange-300',
  }

  const statusDot = {
    occupied: 'bg-blue-500',
    empty: 'bg-gray-300',
    blocked: 'bg-orange-500',
  }

  // Vérifier si date de péremption proche (< 30 jours)
  const isExpiringSoon = location.expiry_date &&
    new Date(location.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Vérifier si date de péremption dépassée
  const isExpired = location.expiry_date &&
    new Date(location.expiry_date) < new Date()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full text-left rounded-lg border-2 transition-all cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        compact ? 'p-1.5 min-h-[60px]' : 'p-2 min-h-[80px]',
        'flex flex-col justify-between',
        statusColors[location.status || 'empty']
      )}
    >
      {/* Header: Code + Status dot */}
      <div className="flex items-start justify-between gap-1">
        <span className={cn(
          'font-mono text-muted-foreground',
          compact ? 'text-[10px]' : 'text-xs'
        )}>
          {location.code}
        </span>
        <span className={cn(
          'rounded-full flex-shrink-0',
          compact ? 'w-1.5 h-1.5' : 'w-2 h-2',
          statusDot[location.status || 'empty']
        )} />
      </div>

      {/* Content */}
      {location.content && (
        <span className={cn(
          'font-medium text-foreground line-clamp-2 leading-tight mt-1',
          compact ? 'text-[10px]' : 'text-xs'
        )}>
          {location.content}
        </span>
      )}

      {/* SKU assigné (si pas de content) */}
      {!location.content && location.assignment?.sku && (
        <span className={cn(
          'font-mono text-muted-foreground line-clamp-1 mt-1',
          compact ? 'text-[10px]' : 'text-xs'
        )}>
          {location.assignment.sku.sku_code}
        </span>
      )}

      {/* Footer: Expiry badge */}
      {location.expiry_date && (
        <Badge
          variant={isExpired ? 'destructive' : isExpiringSoon ? 'warning' : 'muted'}
          className={cn(
            'mt-1 self-start',
            compact ? 'text-[8px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'
          )}
        >
          {isExpired ? 'Exp!' : formatDate(location.expiry_date)}
        </Badge>
      )}

      {/* Empty state indicator */}
      {!location.content && !location.assignment?.sku && location.status === 'empty' && (
        <span className={cn(
          'text-muted-foreground/50 italic mt-1',
          compact ? 'text-[9px]' : 'text-[10px]'
        )}>
          Vide
        </span>
      )}
    </button>
  )
}
