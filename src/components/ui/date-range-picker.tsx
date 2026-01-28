'use client'

import * as React from 'react'
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateRangePickerProps {
  from: Date | undefined
  to: Date | undefined
  onSelect: (range: { from: Date | undefined; to: Date | undefined }) => void
  className?: string
}

const presets = [
  {
    label: "Aujourd'hui",
    getValue: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: '7 derniers jours',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: '14 derniers jours',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 13)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: '30 derniers jours',
    getValue: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Ce mois calendaire',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Dernier mois calendaire',
    getValue: () => {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
]

export function DateRangePicker({
  from,
  to,
  onSelect,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(
    from && to ? { from, to } : undefined
  )

  const handlePresetClick = (preset: (typeof presets)[0]) => {
    const range = preset.getValue()
    onSelect(range)
    setIsOpen(false)
  }

  const handleApply = () => {
    if (tempRange?.from && tempRange?.to) {
      onSelect({ from: tempRange.from, to: tempRange.to })
    }
    setIsOpen(false)
  }

  const formatDateRange = () => {
    if (!from || !to) return 'Selectionner une periode'

    // Check if it matches a preset
    for (const preset of presets) {
      const presetRange = preset.getValue()
      if (
        format(from, 'yyyy-MM-dd') === format(presetRange.from, 'yyyy-MM-dd') &&
        format(to, 'yyyy-MM-dd') === format(presetRange.to, 'yyyy-MM-dd')
      ) {
        return preset.label
      }
    }

    return `${format(from, 'd MMM', { locale: fr })} - ${format(to, 'd MMM yyyy', { locale: fr })}`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal gap-2',
            !from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {formatDateRange()}
          <ChevronDown className="h-4 w-4 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-3 space-y-1 min-w-[180px]">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Fourchette de dates
            </p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
            <div className="pt-2 border-t mt-2">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start font-normal',
                  'text-primary'
                )}
                onClick={() => setTempRange(undefined)}
              >
                Plage de dates personnalisee
              </Button>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={from}
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={1}
              locale={fr}
            />
            <div className="flex justify-end pt-3 border-t">
              <Button size="sm" onClick={handleApply}>
                Appliquer
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
