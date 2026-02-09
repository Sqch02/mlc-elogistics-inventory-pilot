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

export function formatCarrierName(carrier: string | null | undefined): string {
  if (!carrier) return 'Inconnu'
  const known = CARRIER_DISPLAY_NAMES[carrier.toLowerCase()]
  if (known) return known
  // Fallback: capitalize first letter of each word, replace underscores
  return carrier
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
