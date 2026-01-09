"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export type Option = {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}

interface FilterProps {
  title: string
  options: Option[]
  selectedValues: Set<string>
  onSelect: (value: string) => void
}

export function DataTableFacetedFilter({
  title,
  options,
  selectedValues,
  onSelect,
}: FilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 border-dashed rounded-xl px-3">
          <span className="text-xs font-medium mr-2">{title}</span>
          {selectedValues?.size > 0 && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
              {selectedValues.size}
            </Badge>
          )}
          <div className="hidden space-x-1 lg:flex">
            {selectedValues.size > 2 ? (
              <Badge variant="secondary" className="rounded-sm px-1 font-normal text-[10px]">
                {selectedValues.size} selectionnés
              </Badge>
            ) : (
              options
                .filter((option) => selectedValues.has(option.value))
                .map((option) => (
                  <Badge
                    variant="secondary"
                    key={option.value}
                    className="rounded-sm px-1 font-normal text-[10px]"
                  >
                    {option.label}
                  </Badge>
                ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onSelect(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

