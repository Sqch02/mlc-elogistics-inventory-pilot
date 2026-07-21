import type { AutoFixAction, AutoFixJobState, AutoFixPattern } from './types'

export const AUTO_FIX_PATTERN_LABELS: Record<AutoFixPattern, string> = {
  currency_chf: 'Devise CHF',
  address_too_long: 'Adresse trop longue',
  hs_code_missing: 'Code douanier manquant',
  weight_too_low: 'Poids trop bas',
  service_point_missing: 'Point relais manquant',
  sender_eori_missing: 'EORI expéditeur manquant',
  unknown: 'Cause inconnue',
}

export const AUTO_FIX_ACTION_LABELS: Record<AutoFixAction, string> = {
  none: 'Aucune action',
  put_update: 'Mise à jour du colis',
  create_linked: 'Création liée à la commande',
  manual_required: 'Intervention manuelle',
  account_configuration: 'Configuration du compte',
}

export const AUTO_FIX_STATE_LABELS: Record<AutoFixJobState, string> = {
  queued: 'En file',
  claimed: 'Réclamé',
  planned: 'Planifié',
  applied: 'Appliqué',
  retry_wait: 'En attente de reprise',
  simulated: 'Simulé',
  pending_manual: 'À traiter manuellement',
  verified: 'Vérifié',
  manual_resolved: 'Résolu manuellement',
  permanent_failed: 'Échec définitif',
}
