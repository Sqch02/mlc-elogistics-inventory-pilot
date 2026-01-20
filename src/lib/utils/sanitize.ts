/**
 * Sanitize user input for use in Supabase/PostgREST filter queries.
 *
 * This prevents SQL injection attacks by escaping special characters
 * that have meaning in PostgREST filter syntax:
 * - Commas (,) - separate filter conditions
 * - Periods (.) - part of filter syntax (column.operator.value)
 * - Parentheses () - grouping in filters
 * - Backslashes (\) - escape character
 *
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for use in .or() and .filter() queries
 */
export function sanitizeSearchInput(input: string): string {
  if (!input) return ''

  // Remove or escape characters that could be used for injection
  // in PostgREST filter syntax
  return input
    // Remove backslashes first (escape character)
    .replace(/\\/g, '')
    // Remove commas (condition separator in .or())
    .replace(/,/g, '')
    // Remove periods that could break filter syntax
    // But keep periods in email addresses and normal text by only removing
    // patterns that look like filter syntax (e.g., ".eq.", ".ilike.")
    .replace(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|sl|sr|nxl|nxr|adj|ov|fts|plfts|phfts|wfts|not|or|and)\./gi, ' ')
    // Remove parentheses (grouping)
    .replace(/[()]/g, '')
    // Trim whitespace
    .trim()
}

/**
 * Sanitize a value for use in exact match filters (e.g., .eq())
 * More strict than search input - only allows alphanumeric, spaces, hyphens, and underscores
 *
 * @param input - The user input to sanitize
 * @returns Sanitized string safe for exact match queries
 */
export function sanitizeExactMatch(input: string): string {
  if (!input) return ''

  // Only allow alphanumeric, spaces, hyphens, underscores, and # (for order refs like #123456)
  return input
    .replace(/[^a-zA-Z0-9\s\-_#@.]/g, '')
    .trim()
}

/**
 * Escape percent signs for LIKE/ILIKE queries
 * Use this when you want to search for literal % characters
 *
 * @param input - The input to escape
 * @returns Input with % escaped as \%
 */
export function escapePercentForLike(input: string): string {
  if (!input) return ''
  return input.replace(/%/g, '\\%')
}
