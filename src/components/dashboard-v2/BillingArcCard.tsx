'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Receipt, AlertTriangle, Download, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { BillingSummary } from '@/types/dashboard'

interface BillingArcCardProps {
  billing: BillingSummary
  currentMonth: string
  onGenerateInvoice?: () => void
  onDownloadInvoice?: () => void
  delay?: number
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

function formatMonthName(month: string): string {
  const [, monthNum] = month.split('-').map(Number)
  return MONTHS_FR[monthNum - 1]
}

function getMonthProgress(): number {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return now.getDate() / daysInMonth
}

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-muted text-muted-foreground' },
  generated: { label: 'Générée', color: 'bg-success/10 text-success' },
  exported: { label: 'Exportée', color: 'bg-primary/10 text-primary' }
}

export function BillingArcCard({
  billing,
  currentMonth,
  onGenerateInvoice,
  onDownloadInvoice,
  delay = 0
}: BillingArcCardProps) {
  const [arcProgress, setArcProgress] = useState(0)
  const monthProgress = getMonthProgress()
  const monthName = formatMonthName(currentMonth)
  const status = statusConfig[billing.status]

  // Animate arc on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setArcProgress(monthProgress)
    }, delay * 1000 + 300)
    return () => clearTimeout(timer)
  }, [monthProgress, delay])

  // SVG arc calculation
  const arcRadius = 70
  const arcCircumference = Math.PI * arcRadius // Semi-circle
  const arcOffset = arcCircumference * (1 - arcProgress)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm"
    >
      {/* Header with status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gold/10">
            <Receipt className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Facturation</h3>
            <p className="text-sm text-muted-foreground">{monthName}</p>
          </div>
        </div>
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", status.color)}>
          {status.label}
        </span>
      </div>

      {/* Progress arc */}
      <div className="relative flex justify-center py-2">
        <svg width="160" height="90" viewBox="0 0 160 90">
          {/* Background arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="#E8E4DC"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="#1B4D3E"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={arcCircumference}
            strokeDashoffset={arcOffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.5 }}
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center"
        >
          <span className="text-2xl font-bold text-foreground">
            {Math.round(monthProgress * 100)}%
          </span>
          <span className="block text-xs text-muted-foreground">du mois</span>
        </motion.div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.3 }}
          className="p-3 rounded-lg bg-primary/5 border border-primary/10"
        >
          <p className="text-xs text-muted-foreground mb-1">Transport</p>
          <p className="text-lg font-semibold text-primary">
            {billing.totalCost.toFixed(2)} €
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.4 }}
          className="p-3 rounded-lg bg-warning/5 border border-warning/10"
        >
          <p className="text-xs text-muted-foreground mb-1">Indemnités</p>
          <p className="text-lg font-semibold text-warning">
            {billing.totalIndemnity.toFixed(2)} €
          </p>
        </motion.div>
      </div>

      {/* Warning banner if missing pricing */}
      {billing.missingPricingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.5 }}
          className={cn(
            "mt-4 p-3 rounded-lg",
            "bg-warning/5 border border-warning/20",
            "flex items-start gap-2"
          )}
        >
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">
              {billing.missingPricingCount} expédition{billing.missingPricingCount > 1 ? 's' : ''} sans tarif
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complétez les tarifs avant de générer la facture
            </p>
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.6 }}
        className="mt-4 pt-4 border-t border-border/40 flex gap-2"
      >
        {billing.status === 'pending' ? (
          <Button
            onClick={onGenerateInvoice}
            className="flex-1"
            disabled={billing.missingPricingCount > 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            Générer facture
          </Button>
        ) : (
          <>
            <Button onClick={onGenerateInvoice} variant="outline" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Régénérer
            </Button>
            <Button onClick={onDownloadInvoice} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
