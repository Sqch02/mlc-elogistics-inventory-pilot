'use client'

import { cn } from '@/lib/utils'
import type { Location } from '@/hooks/useLocations'

interface LocationCellProps {
  location: Location
  onClick: () => void
}

export function LocationCell({ location, onClick }: LocationCellProps) {
  // Déterminer le statut effectif
  const hasContent = !!location.content || !!location.assignment?.sku
  const isBlocked = location.status === 'blocked' ||
    location.label?.toLowerCase().includes('inaccessible') ||
    location.label?.toLowerCase().includes('impossible')
  const isOccupied = location.status === 'occupied' || hasContent

  // Vérifier si date de péremption proche (< 30 jours) ou dépassée
  const isExpired = location.expiry_date && new Date(location.expiry_date) < new Date()
  const isExpiringSoon = location.expiry_date &&
    !isExpired &&
    new Date(location.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Contenu à afficher
  const displayContent = location.content || location.assignment?.sku?.sku_code || ''

  // Couleurs selon le statut (exactement comme le Google Sheet)
  const bgColor = isBlocked
    ? 'bg-orange-200'
    : isOccupied
    ? 'bg-blue-200'
    : 'bg-white'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full h-full text-left rounded border border-gray-300 transition-all cursor-pointer overflow-hidden',
        'hover:shadow-md hover:border-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        bgColor
      )}
    >
      {/* Warning icon pour bloqué ou expiré */}
      {(isBlocked || isExpired) && (
        <div className="absolute top-0.5 left-1/2 transform -translate-x-1/2 text-yellow-600 text-xs">
          ⚠️
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex flex-col items-center justify-center h-full p-1 pt-3">
        {/* Texte du contenu */}
        {displayContent ? (
          <div className={cn(
            'text-[10px] font-semibold text-center leading-tight line-clamp-2',
            isBlocked ? 'text-orange-800' : 'text-gray-800'
          )}>
            {displayContent}
          </div>
        ) : isBlocked ? (
          <div className="text-[10px] font-semibold text-center text-orange-800 leading-tight">
            Impossible de<br />stocker
          </div>
        ) : null}

        {/* Date de péremption */}
        {location.expiry_date && !isBlocked && (
          <div className={cn(
            'text-[9px] mt-0.5',
            isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-orange-600' : 'text-gray-500'
          )}>
            {formatDate(location.expiry_date)}
          </div>
        )}
      </div>

      {/* Code en bas */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-100/80 border-t border-gray-200 text-center py-0.5">
        <span className="text-[9px] font-mono text-gray-600">
          {location.code}
        </span>
      </div>
    </button>
  )
}
