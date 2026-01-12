'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LocationCell } from './LocationCell'
import { useLocationsByZone, type Location } from '@/hooks/useLocations'
import { LayoutGrid } from 'lucide-react'

interface WarehouseVisualMapProps {
  onLocationClick: (location: Location) => void
}

// Configuration des allées avec leurs racks
const AISLES = [
  { id: 'ALLEE1', label: 'Allée 1', topRack: 'A', bottomRack: 'B' },
  { id: 'ALLEE2', label: 'Allée 2', topRack: 'C', bottomRack: 'D' },
  { id: 'ALLEE3', label: 'Allée 3', topRack: 'E', bottomRack: 'F' },
  { id: 'ZONEG', label: 'Zone G', topRack: 'G', bottomRack: null },
]

// Niveaux d'étage (0 = sol, 1 = milieu, 2 = haut)
const LEVELS = ['2', '1', '0']

export function WarehouseVisualMap({ onLocationClick }: WarehouseVisualMapProps) {
  const { data: zones, isLoading } = useLocationsByZone()
  const [activeAisle, setActiveAisle] = useState<string>('ALLEE1')

  // Organiser les locations par rack -> niveau -> colonne
  const locationsByRack = useMemo(() => {
    if (!zones || zones.length === 0) return new Map<string, Map<string, Map<number, Location>>>()

    const allLocations = zones.flatMap(z => z.cells)
    const byRack = new Map<string, Map<string, Map<number, Location>>>()

    for (const loc of allLocations) {
      // Parser le code: A001 = Rack A, Niveau 0, Colonne 01
      const rackLetter = loc.code.charAt(0).toUpperCase()
      const level = loc.code.charAt(1) // '0', '1', '2'
      const col = parseInt(loc.code.slice(2), 10) // 01, 02, etc.

      if (!byRack.has(rackLetter)) {
        byRack.set(rackLetter, new Map())
      }
      const rack = byRack.get(rackLetter)!

      if (!rack.has(level)) {
        rack.set(level, new Map())
      }
      rack.get(level)!.set(col, loc)
    }

    return byRack
  }, [zones])

  // Calculer le nombre max de colonnes par rack
  const maxColsByRack = useMemo(() => {
    const result = new Map<string, number>()
    for (const [rackLetter, levels] of locationsByRack) {
      let maxCol = 0
      for (const cols of levels.values()) {
        for (const col of cols.keys()) {
          maxCol = Math.max(maxCol, col)
        }
      }
      result.set(rackLetter, maxCol)
    }
    return result
  }, [locationsByRack])

  // Stats par allée
  const aisleStats = useMemo(() => {
    const stats: Record<string, { total: number; occupied: number }> = {}

    for (const aisle of AISLES) {
      let total = 0
      let occupied = 0
      const racks = [aisle.topRack, aisle.bottomRack].filter(Boolean) as string[]

      for (const rack of racks) {
        const levels = locationsByRack.get(rack)
        if (levels) {
          for (const cols of levels.values()) {
            for (const loc of cols.values()) {
              total++
              if (loc.status === 'occupied' || loc.content) occupied++
            }
          }
        }
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-400 border border-blue-500" />
          <span>Occupé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-400 border border-orange-500" />
          <span>Bloqué</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          <span>Vide</span>
        </div>
      </div>

      {/* Aisle View */}
      {currentAisle && (
        <AisleView
          aisle={currentAisle}
          locationsByRack={locationsByRack}
          maxColsByRack={maxColsByRack}
          onLocationClick={onLocationClick}
        />
      )}
    </div>
  )
}

interface AisleViewProps {
  aisle: { id: string; label: string; topRack: string; bottomRack: string | null }
  locationsByRack: Map<string, Map<string, Map<number, Location>>>
  maxColsByRack: Map<string, number>
  onLocationClick: (location: Location) => void
}

function AisleView({ aisle, locationsByRack, maxColsByRack, onLocationClick }: AisleViewProps) {
  const topRackData = locationsByRack.get(aisle.topRack)
  const bottomRackData = aisle.bottomRack ? locationsByRack.get(aisle.bottomRack) : null
  const topMaxCols = maxColsByRack.get(aisle.topRack) || 0
  const bottomMaxCols = aisle.bottomRack ? (maxColsByRack.get(aisle.bottomRack) || 0) : 0
  const maxCols = Math.max(topMaxCols, bottomMaxCols, 1)

  return (
    <Card className="overflow-x-auto shadow-sm">
      <div className="p-4 min-w-max">
        {/* Top Rack */}
        <RackView
          rackLetter={aisle.topRack}
          rackData={topRackData}
          maxCols={maxCols}
          onLocationClick={onLocationClick}
          isReversed={true} // Colonnes de droite à gauche pour le rack du haut
        />

        {/* Allée centrale */}
        <div className="flex items-center justify-center py-4 my-4 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 border-y-2 border-dashed border-gray-400 relative">
          <div className="absolute left-8 text-gray-500 text-2xl font-bold tracking-widest">
            {'◄◄◄'}
          </div>
          <div className="bg-white px-6 py-2 rounded-full border-2 border-gray-400 shadow">
            <span className="font-bold text-gray-700 text-lg">{aisle.label}</span>
          </div>
          <div className="absolute right-8 text-gray-500 text-2xl font-bold tracking-widest">
            {'◄◄◄'}
          </div>
        </div>

        {/* Bottom Rack (if exists) */}
        {aisle.bottomRack && (
          <RackView
            rackLetter={aisle.bottomRack}
            rackData={bottomRackData ?? undefined}
            maxCols={Math.max(bottomMaxCols, maxCols)}
            onLocationClick={onLocationClick}
            isReversed={false}
          />
        )}
      </div>
    </Card>
  )
}

interface RackViewProps {
  rackLetter: string
  rackData: Map<string, Map<number, Location>> | undefined
  maxCols: number
  onLocationClick: (location: Location) => void
  isReversed: boolean
}

function RackView({ rackLetter, rackData, maxCols, onLocationClick, isReversed }: RackViewProps) {
  return (
    <div className="space-y-0">
      {LEVELS.map((level, levelIdx) => {
        const levelData = rackData?.get(level)
        const levelLabel = level === '0' ? 'Sol' : `Niv. ${level}`

        // Générer les colonnes
        const cols = Array.from({ length: maxCols }, (_, i) => i + 1)
        if (isReversed) cols.reverse()

        return (
          <div key={level}>
            {/* Barre orange entre les niveaux */}
            {levelIdx > 0 && (
              <div className="h-2 bg-orange-400 rounded-sm my-1" />
            )}

            {/* Ligne de niveau */}
            <div className="flex items-stretch gap-0.5">
              {/* Indicateur de hauteur (barre bleue) */}
              <div className="w-8 bg-blue-500 rounded-l flex items-center justify-center">
                <span className="text-white text-[9px] font-bold writing-mode-vertical transform -rotate-180" style={{ writingMode: 'vertical-rl' }}>
                  1m28
                </span>
              </div>

              {/* Cellules */}
              {cols.map((col) => {
                const location = levelData?.get(col)
                const code = `${rackLetter}${level}${col.toString().padStart(2, '0')}`

                if (location) {
                  return (
                    <div key={col} className="w-24 h-20">
                      <LocationCell
                        location={location}
                        onClick={() => onLocationClick(location)}
                      />
                    </div>
                  )
                }

                // Cellule vide/placeholder
                return (
                  <div
                    key={col}
                    className="w-24 h-20 bg-white border border-gray-200 rounded flex flex-col items-center justify-center text-gray-300"
                  >
                    <span className="text-[10px] font-mono">{code}</span>
                  </div>
                )
              })}

              {/* Indicateur de profondeur côté droit */}
              <div className="w-8 bg-gray-300 rounded-r flex items-center justify-center">
                <span className="text-gray-600 text-[9px] font-bold writing-mode-vertical transform -rotate-180" style={{ writingMode: 'vertical-rl' }}>
                  {level === '2' ? '65cm' : level === '1' ? '1m28' : '1m80'}
                </span>
              </div>
            </div>

            {/* Codes sous chaque cellule */}
            <div className="flex gap-0.5 ml-8">
              {cols.map((col) => {
                const code = `${rackLetter}${level}${col.toString().padStart(2, '0')}`
                return (
                  <div key={col} className="w-24 text-center">
                    <span className="text-[10px] font-mono text-gray-500">{code}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Label du rack */}
      <div className="text-center mt-2">
        <span className="text-sm font-bold text-gray-600">Rack {rackLetter}</span>
        <span className="text-xs text-gray-400 ml-2">
          ({rackData ? Array.from(rackData.values()).reduce((sum, level) => sum + level.size, 0) : 0} emplacements)
        </span>
      </div>
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
        <div className="space-y-4">
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-24 rounded" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-24 rounded" />
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
