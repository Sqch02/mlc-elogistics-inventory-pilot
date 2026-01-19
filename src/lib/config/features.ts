/**
 * Feature Flags Configuration
 *
 * These flags control features that are outside the V1 Pilot scope.
 * Set via environment variables to enable/disable features.
 *
 * Default: All out-of-scope features are DISABLED
 */

export const features = {
  /**
   * FEC/Sage accounting exports
   * HORS PERIMETRE: "Integration comptable (FEC, Sage, etc.)" est explicitement hors devis
   */
  accountingExports: process.env.NEXT_PUBLIC_ENABLE_ACCOUNTING_EXPORTS === 'true',

  /**
   * Returns module (Sendcloud Returns sync)
   * HORS PERIMETRE: Non mentionne dans le devis V1 Pilote
   */
  returnsModule: process.env.NEXT_PUBLIC_ENABLE_RETURNS_MODULE === 'true',

  /**
   * Visual warehouse map
   * HORS PERIMETRE: Non mentionne dans le devis, pourrait creer des attentes
   */
  warehouseMap: process.env.NEXT_PUBLIC_ENABLE_WAREHOUSE_MAP === 'true',

  /**
   * Auto-create claims from webhook on problematic statuses
   * HORS PERIMETRE: Devis precise "indemnisation manuelle (montant saisi au cas par cas)"
   */
  autoCreateClaims: process.env.NEXT_PUBLIC_AUTO_CREATE_CLAIMS === 'true',

  /**
   * Admin multi-tenant panel
   * HORS PERIMETRE: "Multi-clients prevu en fin de V1 apres validation pilote"
   */
  adminPanel: process.env.NEXT_PUBLIC_ENABLE_ADMIN_PANEL === 'true',
}

// Server-side only flags (for API routes)
export function getServerFeatures() {
  return {
    accountingExports: process.env.ENABLE_ACCOUNTING_EXPORTS === 'true',
    // Auto-create claims is NOW ENABLED BY DEFAULT for full automation
    autoCreateClaims: process.env.AUTO_CREATE_CLAIMS !== 'false',
    // Returns sync is NOW ENABLED BY DEFAULT for full automation
    returnsSync: process.env.RETURNS_SYNC !== 'false',
  }
}
