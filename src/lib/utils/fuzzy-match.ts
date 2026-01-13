/**
 * Calculate Levenshtein distance between two strings
 * Lower = more similar (0 = identical)
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  // Normalize strings for comparison
  const s1 = a.toLowerCase().trim()
  const s2 = b.toLowerCase().trim()

  if (s1 === s2) return 0
  if (s1.length === 0) return s2.length
  if (s2.length === 0) return s1.length

  // Initialize matrix
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[s1.length][s2.length]
}

/**
 * Calculate similarity ratio (0-1, higher = more similar)
 */
export function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(a, b)
  return 1 - distance / maxLen
}

/**
 * Normalize a code for comparison
 * Removes common separators and converts to lowercase
 */
export function normalizeCode(code: string): string {
  return code
    .toLowerCase()
    .trim()
    .replace(/[-_\s.]/g, '') // Remove dashes, underscores, spaces, dots
}

/**
 * Check if two codes are "similar enough" to warrant a warning
 * Returns true if they're different but suspiciously similar
 */
export function areSimilarCodes(code1: string, code2: string, threshold: number = 0.8): boolean {
  // Exact match = not "similar", they're the same
  if (code1.toLowerCase().trim() === code2.toLowerCase().trim()) {
    return false
  }

  // If normalized versions are identical, they're similar
  if (normalizeCode(code1) === normalizeCode(code2)) {
    return true
  }

  // Check similarity ratio
  return similarityRatio(code1, code2) >= threshold
}

export interface FuzzyMatchResult<T> {
  exactMatch: T | null
  similarMatches: Array<{ item: T; similarity: number; normalizedMatch: boolean }>
}

/**
 * Find exact and similar matches for a code in a list
 */
export function findMatches<T>(
  searchCode: string,
  items: T[],
  getCode: (item: T) => string,
  similarityThreshold: number = 0.7
): FuzzyMatchResult<T> {
  const normalizedSearch = normalizeCode(searchCode)
  const searchLower = searchCode.toLowerCase().trim()

  let exactMatch: T | null = null
  const similarMatches: FuzzyMatchResult<T>['similarMatches'] = []

  for (const item of items) {
    const itemCode = getCode(item)
    const itemLower = itemCode.toLowerCase().trim()
    const normalizedItem = normalizeCode(itemCode)

    // Exact match
    if (itemLower === searchLower) {
      exactMatch = item
      continue
    }

    // Normalized match (e.g., "SKU-001" vs "SKU001")
    if (normalizedSearch === normalizedItem) {
      similarMatches.push({
        item,
        similarity: 0.99, // Very high but not exact
        normalizedMatch: true,
      })
      continue
    }

    // Fuzzy similarity
    const similarity = similarityRatio(searchCode, itemCode)
    if (similarity >= similarityThreshold) {
      similarMatches.push({
        item,
        similarity,
        normalizedMatch: false,
      })
    }
  }

  // Sort similar matches by similarity (highest first)
  similarMatches.sort((a, b) => b.similarity - a.similarity)

  return { exactMatch, similarMatches }
}

export interface ImportPreviewRow<T = Record<string, unknown>> {
  rowNumber: number
  data: T
  action: 'update' | 'create' | 'warning' | 'error'
  matchedRecord?: { id: string; code: string }
  similarRecords?: Array<{ id: string; code: string; similarity: number }>
  errors?: string[]
}

export interface ImportPreviewResult<T = Record<string, unknown>> {
  toUpdate: ImportPreviewRow<T>[]
  toCreate: ImportPreviewRow<T>[]
  warnings: ImportPreviewRow<T>[]  // Similar matches found
  errors: ImportPreviewRow<T>[]    // Validation errors
  summary: {
    total: number
    updates: number
    creates: number
    warnings: number
    errors: number
  }
}

/**
 * Analyze import data and categorize rows
 */
export function analyzeImportData<T extends Record<string, unknown>>(
  rows: T[],
  existingRecords: Array<{ id: string; code: string }>,
  getKeyFromRow: (row: T) => string,
  validateRow?: (row: T) => string[] | null
): ImportPreviewResult<T> {
  const result: ImportPreviewResult<T> = {
    toUpdate: [],
    toCreate: [],
    warnings: [],
    errors: [],
    summary: { total: rows.length, updates: 0, creates: 0, warnings: 0, errors: 0 },
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // +2 for 1-indexed and header

    // Validate row if validator provided
    if (validateRow) {
      const validationErrors = validateRow(row)
      if (validationErrors && validationErrors.length > 0) {
        result.errors.push({
          rowNumber,
          data: row,
          action: 'error',
          errors: validationErrors,
        })
        result.summary.errors++
        return
      }
    }

    const key = getKeyFromRow(row)
    if (!key) {
      result.errors.push({
        rowNumber,
        data: row,
        action: 'error',
        errors: ['Clé manquante'],
      })
      result.summary.errors++
      return
    }

    const { exactMatch, similarMatches } = findMatches(
      key,
      existingRecords,
      (r) => r.code
    )

    if (exactMatch) {
      // Exact match - will update
      result.toUpdate.push({
        rowNumber,
        data: row,
        action: 'update',
        matchedRecord: exactMatch,
      })
      result.summary.updates++
    } else if (similarMatches.length > 0) {
      // Similar matches found - warning
      result.warnings.push({
        rowNumber,
        data: row,
        action: 'warning',
        similarRecords: similarMatches.map((m) => ({
          id: m.item.id,
          code: m.item.code,
          similarity: Math.round(m.similarity * 100),
        })),
      })
      result.summary.warnings++
    } else {
      // No match - will create
      result.toCreate.push({
        rowNumber,
        data: row,
        action: 'create',
      })
      result.summary.creates++
    }
  })

  return result
}
