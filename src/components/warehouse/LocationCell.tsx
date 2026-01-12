'use client'

import { cn } from '@/lib/utils'
import type { Location } from '@/hooks/useLocations'

interface LocationCellProps {
  location: Location
  onClick: () => void
  compact?: boolean
}

export function LocationCell({ location, onClick, compact = false }: LocationCellProps) {
  // Déterminer le statut effectif
  const hasContent = !!location.content || !!location.assignment?.sku
  const isBlocked = location.status === 'blocked' ||
    location.label?.toLowerCase().includes('inaccessible') ||
    location.label?.toLowerCase().includes('impossible')
  const isOccupied = location.status === 'occupied' || hasContent

  // Couleurs selon le statut (comme le Google Sheet)
  const bgColor = isBlocked
    ? 'bg-orange-100 border-orange-400 hover:bg-orange-200'
    : isOccupied
    ? 'bg-blue-100 border-blue-400 hover:bg-blue-200'
    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'

  // Vérifier si date de péremption proche (< 30 jours) ou dépassée
  const isExpired = location.expiry_date && new Date(location.expiry_date) < new Date()
  const isExpiringSoon = location.expiry_date &&
    !isExpired &&
    new Date(location.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  // Contenu à afficher
  const displayContent = location.content || location.assignment?.sku?.sku_code || ''

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full text-left rounded-lg border-2 transition-all cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        compact ? 'p-1.5' : 'p-2',
        bgColor
      )}
    >
      {/* Date de péremption en haut */}
      {location.expiry_date && (
        <div className={cn(
          'text-center font-medium mb-1',
          compact ? 'text-[9px]' : 'text-[10px]',
          isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-gray-600'
        )}>
          {formatDate(location.expiry_date)}
        </div>
      )}

      {/* Contenu au milieu */}
      {displayContent ? (
        <div className={cn(
          'font-medium text-gray-800 text-center leading-tight',
          compact ? 'text-[10px] line-clamp-2 min-h-[24px]' : 'text-xs line-clamp-3 min-h-[36px]'
        )}>
          {displayContent}
        </div>
      ) : (
        <div className={cn(
          'text-center text-gray-400 italic',
          compact ? 'text-[9px] min-h-[24px]' : 'text-[10px] min-h-[36px]',
          'flex items-center justify-center'
        )}>
          {isBlocked ? 'Bloqué' : 'Vide'}
        </div>
      )}

      {/* Code en bas */}
      <div className={cn(
        'text-center font-mono text-gray-500 mt-1',
        compact ? 'text-[9px]' : 'text-[10px]'
      )}>
        {location.code}
      </div>

      {/* Indicateur de warning */}
      {(isExpired || isBlocked) && (
        <div className="absolute top-1 right-1">
          <span className={cn(
            'text-[10px]',
            isExpired ? 'text-red-500' : 'text-orange-500'
          )}>
            ⚠️
          </span>
        </div>
      )}
    </button>
  )
}
