/**
 * Sage Comptabilité Export
 * Format CSV compatible with Sage 100 / Sage 50
 */

export interface SageEntry {
  dateEcriture: string      // Date (DD/MM/YYYY)
  journal: string           // Code journal
  compteGeneral: string     // Compte général
  compteTiers: string       // Compte tiers (auxiliaire)
  libelle: string           // Libellé
  debit: number             // Montant débit
  credit: number            // Montant crédit
  pieceRef: string          // Référence pièce
  dateEcheance?: string     // Date échéance (optionnel)
}

// Standard accounting codes for Sage
const SAGE_COMPTE_VENTES = '706000'         // Prestations de services
const SAGE_COMPTE_TVA_COLLECTEE = '445710'  // TVA collectée 20%
const SAGE_COMPTE_CLIENT = '411'            // Compte collectif clients

interface InvoiceForSage {
  id: string
  invoiceNumber: string
  createdAt: string
  clientCode: string
  clientName: string
  lines: Array<{
    lineType: string
    description: string
    totalHT: number
    tva: number
  }>
  totalHT: number
  totalTVA: number
  totalTTC: number
}

/**
 * Format date for Sage (DD/MM/YYYY)
 */
export function formatSageDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Format amount for Sage (2 decimal places)
 */
export function formatSageAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Generate Sage entries for an invoice
 */
export function generateSageEntries(invoice: InvoiceForSage): SageEntry[] {
  const entries: SageEntry[] = []
  const date = formatSageDate(invoice.createdAt)
  const clientAccount = `${SAGE_COMPTE_CLIENT}${invoice.clientCode}`

  // 1. DEBIT: Client account (TTC)
  entries.push({
    dateEcriture: date,
    journal: 'VE',
    compteGeneral: clientAccount,
    compteTiers: invoice.clientCode,
    libelle: `FAC ${invoice.invoiceNumber} ${invoice.clientName}`.substring(0, 35),
    debit: invoice.totalTTC,
    credit: 0,
    pieceRef: invoice.invoiceNumber,
  })

  // 2. CREDIT: Sales revenue (HT) - grouped by line type
  const linesByType = new Map<string, { totalHT: number; description: string }>()

  for (const line of invoice.lines) {
    const type = line.lineType || 'other'
    const existing = linesByType.get(type)
    if (existing) {
      existing.totalHT += line.totalHT
    } else {
      linesByType.set(type, { totalHT: line.totalHT, description: line.description })
    }
  }

  for (const [type, data] of linesByType) {
    // Get specific account based on line type
    const compte = getCompteByLineType(type)

    entries.push({
      dateEcriture: date,
      journal: 'VE',
      compteGeneral: compte,
      compteTiers: '',
      libelle: data.description.substring(0, 35),
      debit: 0,
      credit: data.totalHT,
      pieceRef: invoice.invoiceNumber,
    })
  }

  // 3. CREDIT: VAT collected
  if (invoice.totalTVA > 0) {
    entries.push({
      dateEcriture: date,
      journal: 'VE',
      compteGeneral: SAGE_COMPTE_TVA_COLLECTEE,
      compteTiers: '',
      libelle: `TVA 20% FAC ${invoice.invoiceNumber}`,
      debit: 0,
      credit: invoice.totalTVA,
      pieceRef: invoice.invoiceNumber,
    })
  }

  return entries
}

/**
 * Get accounting code based on invoice line type
 */
function getCompteByLineType(lineType: string): string {
  switch (lineType) {
    case 'software':
      return '706100' // Prestations logiciel
    case 'storage':
      return '706200' // Prestations stockage
    case 'reception':
      return '706300' // Prestations réception
    case 'shipping':
      return '706400' // Prestations expédition
    case 'fuel_surcharge':
      return '706500' // Surcharge carburant
    case 'returns':
      return '706600' // Gestion retours
    default:
      return SAGE_COMPTE_VENTES
  }
}

/**
 * Generate Sage CSV file content
 */
export function generateSageCSV(entries: SageEntry[]): string {
  // Sage CSV header
  const header = [
    'Date',
    'Journal',
    'Compte',
    'Tiers',
    'Libellé',
    'Débit',
    'Crédit',
    'Pièce',
  ].join(';')

  const rows = entries.map(entry => [
    entry.dateEcriture,
    entry.journal,
    entry.compteGeneral,
    entry.compteTiers,
    `"${entry.libelle}"`, // Quote to handle special chars
    formatSageAmount(entry.debit),
    formatSageAmount(entry.credit),
    entry.pieceRef,
  ].join(';'))

  return [header, ...rows].join('\n')
}

/**
 * Generate Sage export filename
 */
export function generateSageFilename(period: string): string {
  return `export_sage_${period}.csv`
}

/**
 * Validate Sage entries balance (debits = credits)
 */
export function validateSageBalance(entries: SageEntry[]): {
  valid: boolean
  totalDebit: number
  totalCredit: number
  difference: number
} {
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0)
  const difference = Math.abs(totalDebit - totalCredit)

  return {
    valid: difference < 0.01, // Allow for rounding errors
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    difference: Math.round(difference * 100) / 100,
  }
}
