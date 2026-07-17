// Next.js 15+ charge automatiquement instrumentation-client.ts cote navigateur.
// Sans lui, sentry.client.config.ts n'etait jamais charge (erreurs client non
// remontees). No-op tant que NEXT_PUBLIC_SENTRY_DSN n'est pas defini.
import '../sentry.client.config'
