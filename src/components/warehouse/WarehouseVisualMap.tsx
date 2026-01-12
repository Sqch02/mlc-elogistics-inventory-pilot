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

// Définition des allées
const AISLES = [
  { id: 'ALLEE1', label: 'Allée 1', racks: ['A', 'B'] },
  { id: 'ALLEE2', label: 'Allée 2', racks: ['C', 'D'] },
  { id: 'ALLEE3', label: 'Allée 3', racks: ['E', 'F'] },
  { id: 'ZONEG', label: 'Zone G', racks: ['G'] },
]

export function WarehouseVisualMap({ onLocationClick }: WarehouseVisualMapProps) {
  const { data: zones, isLoading } = useLocationsByZone()
  const [activeAisle, setActiveAisle] = useState<string>('ALLEE1')
  const [compact, setCompact] = useState(false)

  // Organiser les locations par rack et niveau
  const locationsByRack = useMemo(() => {
    if (!zones || zones.length === 0) return new Map<string, Location[]>()

    const allLocations = zones.flatMap(z => z.cells)
    const byRack = new Map<string, Location[]>()

    for (const loc of allLocations) {
      // Extraire la lettre du rack du code (A001 -> A)
      const rackLetter = loc.code.charAt(0).toUpperCase()
      if (!byRack.has(rackLetter)) {
        byRack.set(rackLetter, [])
      }
      byRack.get(rackLetter)!.push(loc)
    }

    return byRack
  }, [zones])

  // Obtenir les stats par allée
  const aisleStats = useMemo(() => {
    const stats: Record<string, { total: number; occupied: number }> = {}

    for (const aisle of AISLES) {
      let total = 0
      let occupied = 0
      for (const rack of aisle.racks) {
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
      {/* Aisle Tabs + Controls */}
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
          <span className="w-3 h-3 rounded bg-blue-400" />
          <span>Occupé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-400" />
          <span>Bloqué</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-200" />
          <span>Vide</span>
        </div>
      </div>

      {/* Aisle View */}
      {currentAisle && (
        <AisleView
          aisle={currentAisle}
          locationsByRack={locationsByRack}
          onLocationClick={onLocationClick}
          compact={compact}
        />
      )}
    </div>
  )
}

interface AisleViewProps {
  aisle: { id: string; label: string; racks: string[] }
  locationsByRack: Map<string, Location[]>
  onLocationClick: (location: Location) => void
  compact: boolean
}

function AisleView({ aisle, locationsByRack, onLocationClick, compact }: AisleViewProps) {
  // Organiser les locations par niveau pour chaque rack
  const rackData = useMemo(() => {
    const data: Array<{
      rack: string
      levels: Map<string, Location[]>
      maxCol: number
    }> = []

    for (const rack of aisle.racks) {
      const locations = locationsByRack.get(rack) || []
      const levels = new Map<string, Location[]>()
      let maxCol = 0

      for (const loc of locations) {
        // Extraire niveau du code (A001 -> niveau 0, A101 -> niveau 1, A201 -> niveau 2)
        const levelDigit = loc.code.charAt(1)
        const level = levelDigit // '0', '1', '2'
        const col = parseInt(loc.code.slice(2), 10) // 01, 02, etc.

        if (!levels.has(level)) {
          levels.set(level, [])
        }
        levels.get(level)!.push(loc)
        maxCol = Math.max(maxCol, col)
      }

      data.push({ rack, levels, maxCol })
    }

    return data
  }, [aisle.racks, locationsByRack])

  // Trouver le nombre max de colonnes
  const maxCols = Math.max(...rackData.map(d => d.maxCol), 1)

  return (
    <Card className="overflow-x-auto shadow-sm">
      <div className="p-4">
        {/* Aisle Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
            <span className="text-lg font-semibold">{aisle.label}</span>
          </div>
        </div>

        {/* Racks */}
        <div className={cn(
          'space-y-6',
          aisle.racks.length === 2 && 'divide-y divide-dashed divide-gray-300'
        )}>
          {rackData.map(({ rack, levels, maxCol }) => (
            <RackView
              key={rack}
              rack={rack}
              levels={levels}
              maxCols={maxCol || maxCols}
              onLocationClick={onLocationClick}
              compact={compact}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}

interface RackViewProps {
  rack: string
  levels: Map<string, Location[]>
  maxCols: number
  onLocationClick: (location: Location) => void
  compact: boolean
}

function RackView({ rack, levels, maxCols, onLocationClick, compact }: RackViewProps) {
  // Niveaux triés (2, 1, 0) -> (haut vers bas)
  const sortedLevels = Array.from(levels.keys()).sort().reverse()

  // Créer une map code -> location pour lookup rapide
  const locationMap = useMemo(() => {
    const map = new Map<string, Location>()
    for (const locs of levels.values()) {
      for (const loc of locs) {
        map.set(loc.code, loc)
      }
    }
    return map
  }, [levels])

  return (
    <div className="pt-4 first:pt-0">
      {/* Rack Label */}
      <div className="text-sm font-semibold text-muted-foreground mb-3">
        Rack {rack}
      </div>

      {/* Grid par niveau */}
      {sortedLevels.map((level) => {
        const levelLabel = level === '0' ? 'Sol' : `Niveau ${level}`

        return (
          <div key={level} className="mb-4 last:mb-0">
            <div className="text-xs text-muted-foreground mb-2 font-medium">
              {levelLabel}
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${maxCols}, minmax(${compact ? '80px' : '110px'}, 1fr))`
              }}
            >
              {Array.from({ length: maxCols }, (_, i) => {
                const col = (i + 1).toString().padStart(2, '0')
                const code = `${rack}${level}${col}`
                const location = locationMap.get(code)

                if (location) {
                  return (
                    <LocationCell
                      key={code}
                      location={location}
                      onClick={() => onLocationClick(location)}
                      compact={compact}
                    />
                  )
                }

                // Placeholder pour cellule manquante
                return (
                  <div
                    key={code}
                    className={cn(
                      'rounded-lg border-2 border-dashed border-gray-200',
                      'flex items-center justify-center text-muted-foreground/30',
                      compact ? 'min-h-[60px] text-[9px]' : 'min-h-[80px] text-xs'
                    )}
                  >
                    {code}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
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
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </Card>
    </div>
  )
}
