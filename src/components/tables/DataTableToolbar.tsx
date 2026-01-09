"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { DataTableFacetedFilter, Option } from "./DataTableFacetedFilter"

interface DataTableToolbarProps {
  searchKey: string
  searchValue: string
  onSearchChange: (value: string) => void
  filters?: {
    key: string
    title: string
    options: Option[]
    selectedValues: Set<string>
    onSelect: (value: string) => void
  }[]
  onReset: () => void
}

export function DataTableToolbar({
  searchKey,
  searchValue,
  onSearchChange,
  filters = [],
  onReset,
}: DataTableToolbarProps) {
  const isFiltered = searchValue.length > 0 || filters.some((f) => f.selectedValues.size > 0)

  return (
    <div className="flex items-center justify-between p-1">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 w-full pl-9 bg-white"
          />
        </div>
        
        {filters.map((filter) => (
          <DataTableFacetedFilter
            key={filter.key}
            title={filter.title}
            options={filter.options}
            selectedValues={filter.selectedValues}
            onSelect={filter.onSelect}
          />
        ))}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={onReset}
            className="h-10 px-2 lg:px-3 text-muted-foreground"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

