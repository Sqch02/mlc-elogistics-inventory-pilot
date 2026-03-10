'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingMonthSelectorProps {
  currentMonth: string
  onMonthChange: (month: string) => void
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`
    options.push({ value, label })
  }

  return options
}

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  return `${MONTHS_FR[monthNum - 1]} ${year}`
}

export function FloatingMonthSelector({ currentMonth, onMonthChange }: FloatingMonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const options = getMonthOptions()
  const currentLabel = formatMonthLabel(currentMonth)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "glass flex items-center gap-2 px-4 py-2.5 rounded-full",
          "text-sm font-medium text-foreground",
          "hover:bg-white/80 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
          "shadow-sm hover:shadow-md"
        )}
      >
        <Calendar className="h-4 w-4 text-primary" />
        <span>{currentLabel}</span>
        <div
          className="transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            className={cn(
              "absolute right-0 top-full mt-2 z-50",
              "glass rounded-xl shadow-lg",
              "py-2 min-w-[200px]",
              "max-h-[300px] overflow-y-auto",
              "animate-fade-in"
            )}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                onClick={() => {
                  onMonthChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm animate-fade-in-left",
                  "hover:bg-primary/5 transition-colors",
                  currentMonth === option.value
                    ? "text-primary font-medium bg-primary/5"
                    : "text-foreground"
                )}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
