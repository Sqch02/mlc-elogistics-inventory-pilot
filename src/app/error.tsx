'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Root error boundary for server-component errors. Without it, an uncaught
 * exception in a Server Component crashes the page to a blank screen with no
 * recovery affordance (audit P1-frontend finding).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RootErrorBoundary]', error)
  }, [error])

  return (
    <html lang="fr">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nous avons enregistré l&apos;erreur. Tu peux retenter, ou recharger la page.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-muted-foreground/70 font-mono">
              ref: {error.digest}
            </p>
          )}
          <div className="mt-6 flex gap-2">
            <Button onClick={() => reset()}>Réessayer</Button>
            <Button variant="outline" onClick={() => (window.location.href = '/')}>
              Retour à l&apos;accueil
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
