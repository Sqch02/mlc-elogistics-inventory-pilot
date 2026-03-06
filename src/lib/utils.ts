import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format carrier name for display
 * Handles: chronopost → Chronopost, colisprive → Colis Privé, mondial_relay → Mondial Relay, etc.
 */
const CARRIER_DISPLAY_NAMES: Record<string, string> = {
  chronopost: 'Chronopost',
  colisprive: 'Colis Privé',
  colissimo: 'Colissimo',
  mondial_relay: 'Mondial Relay',
  delivengo: 'Delivengo',
  pending: 'En attente',
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatCarrierName(carrier: string | null | undefined): string {
  if (!carrier) return 'Inconnu'
  const known = CARRIER_DISPLAY_NAMES[carrier.toLowerCase()]
  if (known) return known
  // Fallback: capitalize first letter of each word, replace underscores
  return carrier
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
