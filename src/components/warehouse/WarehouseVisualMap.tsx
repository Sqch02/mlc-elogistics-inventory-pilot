'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LocationCell } from './LocationCell'
import { useLocationsByZone, type Location, type ZoneGrid } from '@/hooks/useLocations'
import { LayoutGrid, Grid3x3, ZoomIn, ZoomOut } from 'lucide-react'

interface WarehouseVisualMapProps {
  onLocationClick: (location: Location) => void
}

export function WarehouseVisualMap({ onLocationClick }: WarehouseVisualMapProps) {
  const { data: zones, isLoading } = useLocationsByZone()
  const [activeZone, setActiveZone] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)

  // Sélectionner la première zone par défaut
  const selectedZone = activeZone || zones?.[0]?.zone_code || null
  const currentZone = zones?.find(z => z.zone_code === selectedZone)

  if (isLoading) {
    return <WarehouseMapSkeleton />
  }

  if (!zones || zones.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun emplacement configuré pour la vue carte.</p>
        <p className="text-sm mt-2">
          Créez des emplacements avec des positions (zone, rang, colonne, niveau) pour les voir ici.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Zone Tabs + Controls */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-border shadow-sm">
        {/* Zone tabs */}
        <div className="flex flex-wrap gap-1 flex-1">
          {zones.map((zone) => (
            <Button
              key={zone.zone_code}
              variant={selectedZone === zone.zone_code ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveZone(zone.zone_code)}
              className="text-xs"
            >
              {zone.zone_label}
              <span className="ml-1.5 text-muted-foreground">
                ({zone.cells.length})
              </span>
            </Button>
          ))}
        </div>

        {/* Controls */}
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
          <span className="w-3 h-3 rounded bg-blue-100 border-2 border-blue-300" />
          <span>Occupé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-100 border-2 border-orange-300" />
          <span>Bloqué</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-50 border-2 border-gray-200" />
          <span>Vide</span>
        </div>
      </div>

      {/* Grid */}
      {currentZone && (
        <ZoneGridView
          zone={currentZone}
          onLocationClick={onLocationClick}
          compact={compact}
        />
      )}
    </div>
  )
}

interface ZoneGridViewProps {
  zone: ZoneGrid
  onLocationClick: (location: Location) => void
  compact: boolean
}

function ZoneGridView({ zone, onLocationClick, compact }: ZoneGridViewProps) {
  // Organiser les cellules par hauteur -> colonne
  const gridData = useMemo(() => {
    // Créer une map row_col -> location
    const cellMap = new Map<string, Location>()
    for (const cell of zone.cells) {
      const key = `${cell.height_level}-${cell.row_number}-${cell.col_number}`
      cellMap.set(key, cell)
    }

    // Obtenir les valeurs uniques triées
    const heights = zone.heights.length > 0 ? zone.heights : ['A']
    const cols = Array.from({ length: zone.cols || 1 }, (_, i) => i + 1)
    const rows = Array.from({ length: zone.rows || 1 }, (_, i) => i + 1)

    return { cellMap, heights, cols, rows }
  }, [zone])

  return (
    <Card className="overflow-x-auto shadow-sm">
      <div className="p-4 min-w-max">
        {/* Pour chaque niveau de hauteur */}
        {gridData.heights.map((height, heightIdx) => (
          <div key={height} className={cn(heightIdx > 0 && 'mt-4 pt-4 border-t')}>
            {/* Label du niveau */}
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Grid3x3 className="h-3.5 w-3.5" />
              Niveau {height} {height === 'A' && '(Sol)'}
            </div>

            {/* Grille */}
            <div className="grid gap-2" style={{
              gridTemplateColumns: `auto repeat(${zone.cols || 1}, minmax(${compact ? '70px' : '100px'}, 1fr))`
            }}>
              {/* Header row */}
              <div className="text-xs font-medium text-muted-foreground p-1" />
              {gridData.cols.map((col) => (
                <div
                  key={col}
                  className="text-xs font-medium text-center text-muted-foreground p-1"
                >
                  Pos. {col.toString().padStart(2, '0')}
                </div>
              ))}

              {/* Data rows */}
              {gridData.rows.map((row) => (
                <>
                  {/* Row label */}
                  <div
                    key={`row-${row}`}
                    className="text-xs font-medium text-muted-foreground p-1 flex items-center"
                  >
                    Rack {String.fromCharCode(64 + row)}
                  </div>

                  {/* Cells */}
                  {gridData.cols.map((col) => {
                    const key = `${height}-${row}-${col}`
                    const location = gridData.cellMap.get(key)

                    if (location) {
                      return (
                        <LocationCell
                          key={key}
                          location={location}
                          onClick={() => onLocationClick(location)}
                          compact={compact}
                        />
                      )
                    }

                    // Empty cell placeholder
                    return (
                      <div
                        key={key}
                        className={cn(
                          'rounded-lg border-2 border-dashed border-gray-200',
                          'flex items-center justify-center text-muted-foreground/30',
                          compact ? 'min-h-[60px] text-[9px]' : 'min-h-[80px] text-xs'
                        )}
                      >
                        -
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        ))}
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
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </Card>
    </div>
  )
}
