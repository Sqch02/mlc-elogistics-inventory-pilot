// Source de vérité TypeScript du vocabulaire « physiquement expédié ».
// status_id NULL reste consommable pour les intégrations dont les messages
// Fulfilled/Completed représentent une vraie expédition.
export const NON_CONSUMABLE_STATUS_MESSAGES = [
  'On Hold',
  'Unfulfilled',
  'Processing',
  '',
  'Cancelled',
  'Cancelled - customer',
] as const

export const CANCELLED_STATUS_IDS = [2000, 2001] as const

export interface ShipmentConsumptionStatus {
  status_id: number | null
  status_message: string | null
  is_return: boolean | null
}

export function isConsumableStatus(row: ShipmentConsumptionStatus): boolean {
  if (row.is_return) return false
  if (
    row.status_id !== null &&
    (CANCELLED_STATUS_IDS as readonly number[]).includes(row.status_id)
  ) {
    return false
  }
  const message = row.status_message ?? ''
  return !(NON_CONSUMABLE_STATUS_MESSAGES as readonly string[]).includes(message)
}
