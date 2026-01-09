'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[]
  filename: string
  headers?: string[]
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children?: React.ReactNode
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  headers,
  variant = 'outline',
  size = 'sm',
  children
}: ExportButtonProps<T>) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = () => {
    setIsExporting(true)
    try {
      const csv = generateCSV(data, { headers, delimiter: ';' })
      downloadCSV(csv, filename)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting || data.length === 0}
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {children || 'Export'}
    </Button>
  )
}

interface ExportButtonAsyncProps {
  fetchData: () => Promise<Record<string, unknown>[]>
  filename: string
  headers?: string[]
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children?: React.ReactNode
}

export function ExportButtonAsync({
  fetchData,
  filename,
  headers,
  variant = 'outline',
  size = 'sm',
  children
}: ExportButtonAsyncProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const data = await fetchData()
      const csv = generateCSV(data, { headers, delimiter: ';' })
      downloadCSV(csv, filename)
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {children || 'Export'}
    </Button>
  )
}
