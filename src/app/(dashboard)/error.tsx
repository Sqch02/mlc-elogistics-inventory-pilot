'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Dashboard route group error boundary. Preserves the sidebar shell while
 * showing the error in the main content area (audit P1-frontend).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold">Cette page a rencontré une erreur</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || 'Erreur serveur inattendue.'}
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground/70 font-mono">ref: {error.digest}</p>
      )}
      <div className="mt-4 flex gap-2">
        <Button onClick={() => reset()}>Réessayer</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Accueil
        </Button>
      </div>
    </div>
  )
}
