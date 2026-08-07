// Piece jointe PDF des factures.
//
// L'email annoncait la facture et renvoyait vers l'espace client. L'exploitation
// a demande que le PDF parte directement : un client qui recoit sa facture n'a
// pas a se connecter pour la lire.
//
// LE PDF DOIT ETRE IDENTIQUE A CELUI TELECHARGE DEPUIS L'APPLICATION. La
// composition reprend donc exactement celle de la page Facturation — memes
// champs, memes calculs, meme repli sur le prix unitaire. Deux documents
// differents pour une meme facture, c'est le genre d'ecart qui se decouvre
// devant un client.

import type { InvoicePDFData } from '@/lib/utils/invoice-pdf'

interface LigneFacture {
  line_type?: string | null
  description?: string | null
  carrier?: string | null
  weight_min_grams?: number | null
  weight_max_grams?: number | null
  quantity?: number | null
  shipment_count: number
  unit_price_eur?: string | number | null
  total_eur: string | number
}

interface FactureBrute {
  invoice_number?: string | null
  month: string
  created_at: string
  subtotal_ht?: string | number | null
  vat_amount?: string | number | null
  total_ttc?: string | number | null
  missing_pricing_count?: number | null
  invoice_lines?: LigneFacture[] | null
}

/** Reglages de societe, tels que stockes dans tenant_settings. */
interface ReglagesSociete {
  company_name?: string | null
  company_address?: string | null
  company_city?: string | null
  company_postal_code?: string | null
  company_country?: string | null
  company_vat_number?: string | null
  company_siret?: string | null
  company_email?: string | null
  company_phone?: string | null
  client_name?: string | null
  client_address?: string | null
  client_postal_code?: string | null
  client_city?: string | null
  client_country?: string | null
  client_vat_number?: string | null
  client_siren?: string | null
  client_siret?: string | null
  invoice_payment_terms?: string | null
  invoice_bank_details?: string | null
  invoice_vat_rate?: number | null
}

function nombre(valeur: unknown): number {
  const n = typeof valeur === 'number' ? valeur : Number.parseFloat(String(valeur ?? ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Compose les donnees du PDF. Renvoie null quand la facture ne porte aucune
 * ligne : mieux vaut un email sans piece jointe qu'un PDF vide, qui ferait
 * douter le client de tout le reste.
 */
export function buildInvoicePdfData(
  facture: FactureBrute,
  reglages: ReglagesSociete | null,
  nomClient: string,
): InvoicePDFData | null {
  const lignes = facture.invoice_lines ?? []
  if (lignes.length === 0) return null

  const [annee, mois] = facture.month.split('-').map(Number)
  const dernierJour = new Date(annee, mois, 0).getDate()

  const nbExpeditions = lignes
    .filter((l) => l.line_type === 'shipping' || l.line_type === 'returns')
    .reduce((somme, l) => somme + (l.shipment_count ?? 0), 0)

  const totalHT = nombre(facture.subtotal_ht)
  const tva = nombre(facture.vat_amount)
  const totalTTC = nombre(facture.total_ttc)
  // Le taux est deduit plutot que suppose : une facture ancienne peut avoir ete
  // emise sous un autre taux que celui configure aujourd'hui.
  const tvaRate = totalHT > 0 ? Math.round((tva / totalHT) * 100) : (reglages?.invoice_vat_rate ?? 20)

  return {
    invoiceNumber: facture.invoice_number ?? facture.month,
    month: facture.month,
    createdAt: facture.created_at,
    dateFrom: `${facture.month}-01`,
    dateTo: `${facture.month}-${String(dernierJour).padStart(2, '0')}`,
    shipmentCount: nbExpeditions,
    company: {
      name: reglages?.company_name ?? 'MLC PROJECT',
      address: reglages?.company_address ?? '',
      city: reglages?.company_city ?? '',
      postalCode: reglages?.company_postal_code ?? '',
      country: reglages?.company_country ?? 'France',
      vatNumber: reglages?.company_vat_number ?? undefined,
      siret: reglages?.company_siret ?? undefined,
      email: reglages?.company_email ?? undefined,
      phone: reglages?.company_phone ?? undefined,
    },
    client: {
      // A defaut de raison sociale renseignee, le nom du compte vaut mieux
      // qu'un bloc destinataire vide sur un document commercial.
      name: reglages?.client_name ?? nomClient,
      address: reglages?.client_address ?? undefined,
      postalCode: reglages?.client_postal_code ?? undefined,
      city: reglages?.client_city ?? undefined,
      country: reglages?.client_country ?? undefined,
      vatNumber: reglages?.client_vat_number ?? undefined,
      siren: reglages?.client_siren ?? undefined,
      siret: reglages?.client_siret ?? undefined,
    },
    lines: lignes.map((ligne) => ({
      lineType: ligne.line_type ?? undefined,
      description: ligne.description ?? undefined,
      carrier: ligne.carrier ?? null,
      weightMin: ligne.weight_min_grams ?? null,
      weightMax: ligne.weight_max_grams ?? null,
      quantity: ligne.quantity ?? undefined,
      shipmentCount: ligne.shipment_count,
      // Meme repli que l'application : un prix unitaire absent se deduit du
      // total, sans quoi la colonne afficherait zero.
      unitPrice: nombre(ligne.unit_price_eur)
        || (ligne.shipment_count > 0 ? nombre(ligne.total_eur) / ligne.shipment_count : nombre(ligne.total_eur)),
      total: nombre(ligne.total_eur),
    })),
    totalHT,
    tvaRate,
    tva,
    totalTTC,
    paymentTerms: reglages?.invoice_payment_terms ?? undefined,
    bankDetails: reglages?.invoice_bank_details ?? undefined,
    missingPricingCount: facture.missing_pricing_count ?? undefined,
  }
}
