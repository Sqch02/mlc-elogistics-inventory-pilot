'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "glass flex items-center gap-2 px-4 py-2.5 rounded-full",
          "text-sm font-medium text-foreground",
          "hover:bg-white/80 transition-all duration-200",
          "shadow-sm hover:shadow-md"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Calendar className="h-4 w-4 text-primary" />
        <span>{currentLabel}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                "absolute right-0 top-full mt-2 z-50",
                "glass rounded-xl shadow-lg",
                "py-2 min-w-[200px]",
                "max-h-[300px] overflow-y-auto"
              )}
            >
              {options.map((option, index) => (
                <motion.button
                  key={option.value}
                  onClick={() => {
                    onMonthChange(option.value)
                    setIsOpen(false)
                  }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm",
                    "hover:bg-primary/5 transition-colors",
                    currentMonth === option.value
                      ? "text-primary font-medium bg-primary/5"
                      : "text-foreground"
                  )}
                >
                  {option.label}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
