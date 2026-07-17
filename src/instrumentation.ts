import * as Sentry from '@sentry/nextjs'

// Next.js charge automatiquement ce hook au demarrage de chaque runtime.
// Sans ce fichier, les sentry.*.config.ts existants n'etaient JAMAIS charges,
// donc aucune erreur serveur/API n'etait remontee (Sentry mort). Les Sentry.init
// sont no-op tant que NEXT_PUBLIC_SENTRY_DSN/SENTRY_DSN n'est pas defini ET
// NODE_ENV=production, donc activer ceci est sans effet hors prod.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Capture les erreurs des Server Components / route handlers (Next 15+).
export const onRequestError = Sentry.captureRequestError
