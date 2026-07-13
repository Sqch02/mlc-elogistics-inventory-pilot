export const DEFAULT_CRON_MAX_PAGES = 10
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
