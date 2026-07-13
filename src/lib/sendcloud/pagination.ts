// INCIDENT 13/07: raising this to 10 (PR #26) made the 5-min cron re-fetch and
// re-write up to ~1000 objects PER resource PER tenant every cycle. The Sendcloud
// integration-shipments feed is NON-incremental (it always restarts from page 1),
// so every existing pending order was re-UPSERTed + re-mapped + its unmapped rows
// deleted/re-inserted, and 3 heavy mat views refreshed, every 5 minutes. That
// exhausted the Supabase disk I/O budget and saturated the DB. 2 pages (~200
// objects) is the value that ran stable for hours; keep the default here and tune
// UP only via the SENDCLOUD_CRON_MAX_PAGES env var after confirming I/O headroom.
export const DEFAULT_CRON_MAX_PAGES = 2
export const MAX_CRON_MAX_PAGES = 50

export class SendcloudPaginationLimitError extends Error {
  readonly resource: string
  readonly maxPages: number

  constructor(resource: string, maxPages: number) {
    super(
      `Sendcloud ${resource} pagination still has data after ${maxPages} pages`,
    )
    this.name = 'SendcloudPaginationLimitError'
    this.resource = resource
    this.maxPages = maxPages
  }
}

export function getCronMaxPages(
  rawValue: string | undefined = process.env.SENDCLOUD_CRON_MAX_PAGES,
): number {
  if (!rawValue?.trim()) return DEFAULT_CRON_MAX_PAGES

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CRON_MAX_PAGES

  return Math.min(Math.floor(parsed), MAX_CRON_MAX_PAGES)
}
