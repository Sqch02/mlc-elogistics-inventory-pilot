/**
 * Cron Job Script - Sendcloud Sync
 *
 * This script is executed by Render's cron service.
 * It calls the internal cron API endpoint to sync shipments from Sendcloud.
 *
 * Environment variables required:
 * - RENDER_EXTERNAL_URL: The external URL of the Render service
 * - CRON_SECRET: Secret for authenticating cron requests
 */

async function main() {
  console.log('Starting Sendcloud sync cron job...')
  const startTime = Date.now()

  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.NEXT_PUBLIC_APP_URL
  const cronSecret = process.env.CRON_SECRET

  if (!baseUrl) {
    console.error('RENDER_EXTERNAL_URL or NEXT_PUBLIC_APP_URL not set')
    process.exit(1)
  }

  if (!cronSecret) {
    console.error('CRON_SECRET not set')
    process.exit(1)
  }

  try {
    const url = `${baseUrl}/api/sync/sendcloud/cron`
    console.log(`Calling: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('Sync result:', JSON.stringify(result, null, 2))

    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(`\nCron job completed in ${duration}s`)

    // Check if any tenant failed
    const failures = result.results?.filter((r: { success: boolean }) => !r.success) || []
    if (failures.length > 0) {
      console.error(`${failures.length} tenant(s) failed to sync`)
      process.exit(1)
    }

    process.exit(0)
  } catch (error) {
    console.error('Cron job failed:', error)
    process.exit(1)
  }
}

main()
