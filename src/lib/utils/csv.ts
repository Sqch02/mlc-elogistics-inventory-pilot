import Papa from 'papaparse'

export interface CSVParseResult<T> {
  data: T[]
  errors: string[]
  meta: Papa.ParseMeta
}

export function parseCSV<T>(
  content: string,
  options?: {
    header?: boolean
    skipEmptyLines?: boolean
    transformHeader?: (header: string) => string
  }
): CSVParseResult<T> {
  const errors: string[] = []

  const result = Papa.parse<T>(content, {
    header: options?.header ?? true,
    skipEmptyLines: options?.skipEmptyLines ?? true,
    transformHeader: options?.transformHeader || ((h) => h.trim().toLowerCase()),
  })

  if (result.errors.length > 0) {
    result.errors.forEach((err) => {
      errors.push(`Ligne ${err.row}: ${err.message}`)
    })
  }

  return {
    data: result.data,
    errors,
    meta: result.meta,
  }
}

export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  options?: {
    headers?: string[]
    delimiter?: string
  }
): string {
  if (data.length === 0) {
    return options?.headers?.join(options?.delimiter || ',') || ''
  }

  const headers = options?.headers || Object.keys(data[0])
  const delimiter = options?.delimiter || ','

  const headerRow = headers.join(delimiter)
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header]
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        // Escape quotes and wrap in quotes if contains special chars
        if (
          stringValue.includes(delimiter) ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      .join(delimiter)
  )

  return [headerRow, ...rows].join('\n')
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
