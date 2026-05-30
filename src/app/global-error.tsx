'use client'

import { useEffect } from 'react'

/**
 * Last-resort error boundary that catches errors in the root layout itself.
 * Replaces Next.js' default "Application error" white screen with a minimal
 * styled fallback (audit P1-frontend finding).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1>Erreur applicative</h1>
        <p>L&apos;application a rencontré une erreur. Recharger la page.</p>
        {error.digest && <p style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>ref: {error.digest}</p>}
        <button onClick={() => reset()} style={{ marginTop: 16, padding: '8px 16px' }}>Réessayer</button>
      </body>
    </html>
  )
}
