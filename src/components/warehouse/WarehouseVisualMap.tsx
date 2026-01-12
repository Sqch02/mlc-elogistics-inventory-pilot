'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LocationCell } from './LocationCell'
import { useLocationsByZone, type Location } from '@/hooks/useLocations'
import { LayoutGrid, ZoomIn, ZoomOut } from 'lucide-react'

interface WarehouseVisualMapProps {
  onLocationClick: (location: Location) => void
}

// Définition des allées avec leurs racks (gauche et droite de l'allée)
const AISLES = [
  { id: 'ALLEE1', label: 'Allée 1', leftRack: 'A', rightRack: 'B' },
  { id: 'ALLEE2', label: 'Allée 2', leftRack: 'C', rightRack: 'D' },
  { id: 'ALLEE3', label: 'Allée 3', leftRack: 'E', rightRack: 'F' },
  { id: 'ZONEG', label: 'Zone G', leftRack: 'G', rightRack: null },
]

export function WarehouseVisualMap({ onLocationClick }: WarehouseVisualMapProps) {
  const { data: zones, isLoading } = useLocationsByZone()
  const [activeAisle, setActiveAisle] = useState<string>('ALLEE1')
  const [compact, setCompact] = useState(false)

  // Organiser les locations par rack
  const locationsByRack = useMemo(() => {
    if (!zones || zones.length === 0) return new Map<string, Location[]>()

    const allLocations = zones.flatMap(z => z.cells)
    const byRack = new Map<string, Location[]>()

    for (const loc of allLocations) {
      const rackLetter = loc.code.charAt(0).toUpperCase()
      if (!byRack.has(rackLetter)) {
        byRack.set(rackLetter, [])
      }
      byRack.get(rackLetter)!.push(loc)
    }

    return byRack
  }, [zones])

  // Stats par allée
  const aisleStats = useMemo(() => {
    const stats: Record<string, { total: number; occupied: number }> = {}

    for (const aisle of AISLES) {
      let total = 0
      let occupied = 0
      const racks = [aisle.leftRack, aisle.rightRack].filter(Boolean) as string[]
      for (const rack of racks) {
        const locs = locationsByRack.get(rack) || []
        total += locs.length
        occupied += locs.filter(l => l.status === 'occupied' || l.content).length
      }
      stats[aisle.id] = { total, occupied }
    }

    return stats
  }, [locationsByRack])

  if (isLoading) {
    return <WarehouseMapSkeleton />
  }

  if (locationsByRack.size === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun emplacement configuré.</p>
      </Card>
    )
  }

  const currentAisle = AISLES.find(a => a.id === activeAisle)

  return (
    <div className="space-y-4">
      {/* Aisle Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-border shadow-sm">
        <div className="flex flex-wrap gap-1 flex-1">
          {AISLES.map((aisle) => {
            const stats = aisleStats[aisle.id]
            return (
              <Button
                key={aisle.id}
                variant={activeAisle === aisle.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveAisle(aisle.id)}
                className="text-xs"
              >
                {aisle.label}
                <span className="ml-1.5 opacity-70">
                  ({stats?.occupied || 0}/{stats?.total || 0})
                </span>
              </Button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 border-l pl-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCompact(!compact)}
            title={compact ? 'Vue normale' : 'Vue compacte'}
          >
            {compact ? <ZoomIn className="h-4 w-4" /> : <ZoomOut className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-300 border border-blue-400" />
          <span>Occupé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-300 border border-orange-400" />
          <span>Bloqué</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          <span>Vide</span>
        </div>
      </div>

      {/* Aisle View */}
      {currentAisle && (
        <AisleFloorPlan
          aisle={currentAisle}
          locationsByRack={locationsByRack}
          onLocationClick={onLocationClick}
          compact={compact}
        />
      )}
    </div>
  )
}

interface AisleFloorPlanProps {
  aisle: { id: string; label: string; leftRack: string; rightRack: string | null }
  locationsByRack: Map<string, Location[]>
  onLocationClick: (location: Location) => void
  compact: boolean
}

function AisleFloorPlan({ aisle, locationsByRack, onLocationClick, compact }: AisleFloorPlanProps) {
  // Organiser les locations par niveau pour chaque rack
  const organizeRack = (rackLetter: string) => {
    const locations = locationsByRack.get(rackLetter) || []
    const levels = new Map<string, Map<number, Location>>()
    let maxCol = 0

    for (const loc of locations) {
      const level = loc.code.charAt(1) // '0', '1', '2'
      const col = parseInt(loc.code.slice(2), 10)

      if (!levels.has(level)) {
        levels.set(level, new Map())
      }
      levels.get(level)!.set(col, loc)
      maxCol = Math.max(maxCol, col)
    }

    return { levels, maxCol }
  }

  const leftRackData = organizeRack(aisle.leftRack)
  const rightRackData = aisle.rightRack ? organizeRack(aisle.rightRack) : null
  const maxCols = Math.max(leftRackData.maxCol, rightRackData?.maxCol || 0, 1)

  // Niveaux triés (2, 1, 0) pour afficher de haut en bas
  const allLevels = Array.from(
    new Set([
      ...leftRackData.levels.keys(),
      ...(rightRackData?.levels.keys() || [])
    ])
  ).sort().reverse()

  const cellSize = compact ? 'w-20 h-16' : 'w-28 h-20'
  const aisleWidth = compact ? 'py-3' : 'py-4'

  return (
    <Card className="overflow-x-auto shadow-sm">
      <div className="p-4 min-w-max">
        {/* Pour chaque niveau */}
        {allLevels.map((level, levelIdx) => {
          const levelLabel = level === '0' ? 'Sol (Niveau 0)' : `Niveau ${level}`
          const leftCells = leftRackData.levels.get(level)
          const rightCells = rightRackData?.levels.get(level)

          return (
            <div key={level} className={cn(levelIdx > 0 && 'mt-2')}>
              {/* Barre de séparation entre niveaux */}
              {levelIdx > 0 && (
                <div className="flex items-center justify-center my-3">
                  <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent rounded" />
                </div>
              )}

              {/* Rack gauche (haut de l'écran) */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs font-bold text-gray-600 w-16">
                    Rack {aisle.leftRack}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {levelLabel}
                  </div>
                  <div className="text-[10px] text-blue-500 ml-auto">
                    ↕ 1m28
                  </div>
                </div>
                <div className="flex gap-1">
                  {/* Dimension gauche */}
                  <div className="w-8 flex items-center justify-center">
                    <span className="text-[9px] text-gray-400 writing-mode-vertical transform -rotate-90 whitespace-nowrap">
                      1m28
                    </span>
                  </div>
                  {/* Cellules */}
                  {Array.from({ length: maxCols }, (_, i) => {
                    const col = i + 1
                    const location = leftCells?.get(col)

                    if (location) {
                      return (
                        <div key={col} className={cellSize}>
                          <LocationCell
                            location={location}
                            onClick={() => onLocationClick(location)}
                            compact={compact}
                          />
                        </div>
                      )
                    }

                    return (
                      <div
                        key={col}
                        className={cn(
                          cellSize,
                          'rounded border-2 border-dashed border-gray-200',
                          'flex items-center justify-center text-gray-300 text-[9px]'
                        )}
                      >
                        {aisle.leftRack}{level}{col.toString().padStart(2, '0')}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Allée centrale */}
              <div className={cn(
                'flex items-center justify-center',
                aisleWidth,
                'bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100',
                'border-y-2 border-dashed border-gray-300',
                'relative'
              )}>
                {/* Flèches de direction */}
                <div className="absolute left-4 text-gray-400 text-lg">
                  {'<<<'}
                </div>
                <div className="bg-white px-4 py-1 rounded-full border-2 border-gray-300 shadow-sm">
                  <span className="font-bold text-gray-700">{aisle.label}</span>
                  <span className="text-[10px] text-gray-400 ml-2">
                    (largeur: 80cm)
                  </span>
                </div>
                <div className="absolute right-4 text-gray-400 text-lg">
                  {'>>>'}
                </div>
              </div>

              {/* Rack droit (bas de l'écran) - si existe */}
              {aisle.rightRack && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs font-bold text-gray-600 w-16">
                      Rack {aisle.rightRack}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {levelLabel}
                    </div>
                    <div className="text-[10px] text-blue-500 ml-auto">
                      ↕ 1m28
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {/* Dimension gauche */}
                    <div className="w-8 flex items-center justify-center">
                      <span className="text-[9px] text-gray-400 writing-mode-vertical transform -rotate-90 whitespace-nowrap">
                        1m28
                      </span>
                    </div>
                    {/* Cellules */}
                    {Array.from({ length: maxCols }, (_, i) => {
                      const col = i + 1
                      const location = rightCells?.get(col)

                      if (location) {
                        return (
                          <div key={col} className={cellSize}>
                            <LocationCell
                              location={location}
                              onClick={() => onLocationClick(location)}
                              compact={compact}
                            />
                          </div>
                        )
                      }

                      return (
                        <div
                          key={col}
                          className={cn(
                            cellSize,
                            'rounded border-2 border-dashed border-gray-200',
                            'flex items-center justify-center text-gray-300 text-[9px]'
                          )}
                        >
                          {aisle.rightRack}{level}{col.toString().padStart(2, '0')}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer avec infos entrepôt */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>📐 Dimensions rack: 1m28 x profondeur variable</span>
              <span>🚶 Largeur allée: 80cm</span>
            </div>
            <div>
              {aisle.leftRack && (
                <span className="mr-4">
                  Rack {aisle.leftRack}: {locationsByRack.get(aisle.leftRack)?.length || 0} emplacements
                </span>
              )}
              {aisle.rightRack && (
                <span>
                  Rack {aisle.rightRack}: {locationsByRack.get(aisle.rightRack)?.length || 0} emplacements
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function WarehouseMapSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-28 rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
