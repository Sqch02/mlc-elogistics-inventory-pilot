import * as Sentry from '@sentry/nextjs'

Sentry.init({
  // Use NEXT_PUBLIC_SENTRY_DSN for consistency (server can read NEXT_PUBLIC vars)
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // Performance Monitoring - 10% sampling in production to reduce costs
  tracesSampleRate: 0.1,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Debug mode for development
  debug: false,

  // Filter out non-critical errors
  beforeSend(event) {
    // Don't send errors for cancelled requests
    if (event.exception?.values?.[0]?.value?.includes('AbortError')) {
      return null
    }
    return event
  },
})
