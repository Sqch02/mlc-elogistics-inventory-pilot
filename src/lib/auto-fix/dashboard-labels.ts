import type { AutoFixAction, AutoFixJobState, AutoFixPattern } from './types'

export const AUTO_FIX_PATTERN_LABELS: Record<AutoFixPattern, string> = {
  currency_unsupported: 'Devise non prise en charge',
  currency_chf: 'Devise CHF',
  address_too_long: 'Adresse trop longue',
  hs_code_missing: 'Code douanier manquant',
  weight_too_low: 'Poids trop bas',
  service_point_missing: 'Point relais manquant',
  address_missing: 'Adresse absente',
  sender_eori_missing: 'EORI expéditeur manquant',
  unknown: 'Cause inconnue',
}

export const AUTO_FIX_ACTION_LABELS: Record<AutoFixAction, string> = {
  none: 'Aucune action',
  put_update: 'Mise à jour du colis',
  create_linked: 'Création liée à la commande',
  manual_required: 'Intervention manuelle',
  account_configuration: 'Configuration du compte',
  patch_order_v3: 'Adresse corrigée',
  patch_service_point_v3: 'Point relais remplacé',
}

export const AUTO_FIX_STATE_LABELS: Record<AutoFixJobState, string> = {
  queued: 'En file',
  claimed: 'Réclamé',
  planned: 'Planifié',
  applying: 'Écriture en cours',
  applied: 'Appliqué',
  retry_wait: 'En attente de reprise',
  retry_verify: 'Vérification à reprendre',
  simulated: 'Simulé',
  pending_manual: 'À traiter manuellement',
  verified: 'Vérifié',
  manual_resolved: 'Résolu manuellement',
  permanent_failed: 'Échec définitif',
  applied_unverified: 'Appliqué, non vérifié',
  // Volontairement explicite : "Obsolète" seul laisserait croire a un abandon.
  obsolete: 'Sans objet, colis déjà parti',
}
