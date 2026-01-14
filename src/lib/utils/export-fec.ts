/**
 * FEC (Fichier des Écritures Comptables) Export
 * Format required for French tax audits
 *
 * Reference: Article A47 A-1 du Livre des procédures fiscales
 */

export interface FECEntry {
  JournalCode: string        // Code journal
  JournalLib: string         // Libellé journal
  EcritureNum: string        // Numéro d'écriture
  EcritureDate: string       // Date écriture (YYYYMMDD)
  CompteNum: string          // Numéro de compte
  CompteLib: string          // Libellé de compte
  CompAuxNum: string         // Numéro compte auxiliaire
  CompAuxLib: string         // Libellé compte auxiliaire
  PieceRef: string           // Référence pièce
  PieceDate: string          // Date pièce (YYYYMMDD)
  EcritureLib: string        // Libellé écriture
  Debit: string              // Montant débit (format: 1234,56)
  Credit: string             // Montant crédit (format: 1234,56)
  EcritureLet: string        // Lettrage
  DateLet: string            // Date lettrage
  ValidDate: string          // Date validation
  Montantdevise: string      // Montant en devise
  Idevise: string            // Identifiant devise
}

// Standard accounting codes for logistics
const COMPTE_VENTES = '706000'           // Prestations de services
const COMPTE_TVA_COLLECTEE = '445710'    // TVA collectée
const COMPTE_CLIENT = '411000'           // Clients

interface InvoiceForFEC {
  id: string
  invoiceNumber: string
  month: string
  createdAt: string
  clientCode: string
  clientName: string
  lines: Array<{
    description: string
    totalHT: number
    tva: number
    totalTTC: number
  }>
  totalHT: number
  totalTVA: number
  totalTTC: number
}

/**
 * Format a number for FEC (French decimal format with comma)
 */
export function formatFECAmount(amount: number): string {
  if (amount === 0) return '0,00'
  return Math.abs(amount).toFixed(2).replace('.', ',')
}

/**
 * Format a date for FEC (YYYYMMDD)
 */
export function formatFECDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Generate FEC entries for an invoice
 */
export function generateFECEntries(invoice: InvoiceForFEC): FECEntry[] {
  const entries: FECEntry[] = []
  const pieceDate = formatFECDate(invoice.createdAt)
  const pieceRef = invoice.invoiceNumber

  // Counter for unique entry numbers within the invoice
  let entryNum = 1

  // 1. DEBIT: Client account (TTC)
  entries.push({
    JournalCode: 'VE',
    JournalLib: 'Journal des Ventes',
    EcritureNum: `${pieceRef}-${entryNum++}`,
    EcritureDate: pieceDate,
    CompteNum: COMPTE_CLIENT,
    CompteLib: 'Clients',
    CompAuxNum: invoice.clientCode,
    CompAuxLib: invoice.clientName,
    PieceRef: pieceRef,
    PieceDate: pieceDate,
    EcritureLib: `Facture ${pieceRef} - ${invoice.clientName}`,
    Debit: formatFECAmount(invoice.totalTTC),
    Credit: '0,00',
    EcritureLet: '',
    DateLet: '',
    ValidDate: pieceDate,
    Montantdevise: '',
    Idevise: 'EUR',
  })

  // 2. CREDIT: Sales revenue (HT) for each line
  for (const line of invoice.lines) {
    entries.push({
      JournalCode: 'VE',
      JournalLib: 'Journal des Ventes',
      EcritureNum: `${pieceRef}-${entryNum++}`,
      EcritureDate: pieceDate,
      CompteNum: COMPTE_VENTES,
      CompteLib: 'Prestations de services',
      CompAuxNum: '',
      CompAuxLib: '',
      PieceRef: pieceRef,
      PieceDate: pieceDate,
      EcritureLib: line.description.substring(0, 100), // Max 100 chars
      Debit: '0,00',
      Credit: formatFECAmount(line.totalHT),
      EcritureLet: '',
      DateLet: '',
      ValidDate: pieceDate,
      Montantdevise: '',
      Idevise: 'EUR',
    })
  }

  // 3. CREDIT: VAT collected (TVA)
  if (invoice.totalTVA > 0) {
    entries.push({
      JournalCode: 'VE',
      JournalLib: 'Journal des Ventes',
      EcritureNum: `${pieceRef}-${entryNum++}`,
      EcritureDate: pieceDate,
      CompteNum: COMPTE_TVA_COLLECTEE,
      CompteLib: 'TVA collectée',
      CompAuxNum: '',
      CompAuxLib: '',
      PieceRef: pieceRef,
      PieceDate: pieceDate,
      EcritureLib: `TVA 20% sur facture ${pieceRef}`,
      Debit: '0,00',
      Credit: formatFECAmount(invoice.totalTVA),
      EcritureLet: '',
      DateLet: '',
      ValidDate: pieceDate,
      Montantdevise: '',
      Idevise: 'EUR',
    })
  }

  return entries
}

/**
 * Generate FEC file content (pipe-delimited)
 */
export function generateFECFile(entries: FECEntry[]): string {
  // FEC header (required columns)
  const header = [
    'JournalCode',
    'JournalLib',
    'EcritureNum',
    'EcritureDate',
    'CompteNum',
    'CompteLib',
    'CompAuxNum',
    'CompAuxLib',
    'PieceRef',
    'PieceDate',
    'EcritureLib',
    'Debit',
    'Credit',
    'EcritureLet',
    'DateLet',
    'ValidDate',
    'Montantdevise',
    'Idevise',
  ].join('|')

  const rows = entries.map(entry => [
    entry.JournalCode,
    entry.JournalLib,
    entry.EcritureNum,
    entry.EcritureDate,
    entry.CompteNum,
    entry.CompteLib,
    entry.CompAuxNum,
    entry.CompAuxLib,
    entry.PieceRef,
    entry.PieceDate,
    entry.EcritureLib,
    entry.Debit,
    entry.Credit,
    entry.EcritureLet,
    entry.DateLet,
    entry.ValidDate,
    entry.Montantdevise,
    entry.Idevise,
  ].join('|'))

  return [header, ...rows].join('\n')
}

/**
 * Generate FEC filename according to norms
 * Format: {SIREN}FEC{YYYYMMDD}.txt
 */
export function generateFECFilename(siren: string, closingDate: Date): string {
  return `${siren}FEC${formatFECDate(closingDate)}.txt`
}
