import { describe, it, expect } from 'vitest'
import {
  formatFECAmount,
  formatFECDate,
  generateFECEntries,
  generateFECFile,
  generateFECFilename,
} from './export-fec'
import {
  formatSageDate,
  formatSageAmount,
  generateSageEntries,
  generateSageCSV,
  validateSageBalance,
} from './export-sage'

describe('FEC Export', () => {
  const sampleInvoice = {
    id: 'inv-001',
    invoiceNumber: 'FAC-2025-0001',
    month: '2025-01',
    createdAt: '2025-01-15T10:00:00Z',
    clientCode: 'FLORNA',
    clientName: 'FLORNA COSMETICS',
    lines: [
      { description: 'Abonnement logiciel', totalHT: 49.00, tva: 9.80, totalTTC: 58.80 },
      { description: 'Prépa & Expédition - Colissimo 500g', totalHT: 537.00, tva: 107.40, totalTTC: 644.40 },
    ],
    totalHT: 586.00,
    totalTVA: 117.20,
    totalTTC: 703.20,
  }

  describe('formatFECAmount', () => {
    it('should format amounts with French decimal separator', () => {
      expect(formatFECAmount(1234.56)).toBe('1234,56')
      expect(formatFECAmount(0)).toBe('0,00')
      expect(formatFECAmount(100)).toBe('100,00')
      expect(formatFECAmount(0.5)).toBe('0,50')
    })

    it('should handle negative amounts (use absolute value)', () => {
      expect(formatFECAmount(-100)).toBe('100,00')
    })
  })

  describe('formatFECDate', () => {
    it('should format date as YYYYMMDD', () => {
      expect(formatFECDate(new Date(2025, 0, 15))).toBe('20250115') // Jan 15, 2025
      expect(formatFECDate(new Date(2025, 11, 31))).toBe('20251231') // Dec 31, 2025
    })
  })

  describe('generateFECEntries', () => {
    it('should generate balanced entries (debit = credit)', () => {
      const entries = generateFECEntries(sampleInvoice)

      const totalDebit = entries.reduce((sum, e) => sum + parseFloat(e.Debit.replace(',', '.')), 0)
      const totalCredit = entries.reduce((sum, e) => sum + parseFloat(e.Credit.replace(',', '.')), 0)

      expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01)
    })

    it('should create client debit entry for TTC', () => {
      const entries = generateFECEntries(sampleInvoice)
      const clientEntry = entries.find(e => e.CompteNum === '411000')

      expect(clientEntry).toBeDefined()
      expect(clientEntry?.Debit).toBe('703,20')
      expect(clientEntry?.Credit).toBe('0,00')
    })

    it('should create credit entries for each line', () => {
      const entries = generateFECEntries(sampleInvoice)
      const salesEntries = entries.filter(e => e.CompteNum === '706000')

      expect(salesEntries).toHaveLength(2)
    })

    it('should create TVA credit entry', () => {
      const entries = generateFECEntries(sampleInvoice)
      const tvaEntry = entries.find(e => e.CompteNum === '445710')

      expect(tvaEntry).toBeDefined()
      expect(tvaEntry?.Credit).toBe('117,20')
    })

    it('should use VE journal code', () => {
      const entries = generateFECEntries(sampleInvoice)

      entries.forEach(entry => {
        expect(entry.JournalCode).toBe('VE')
        expect(entry.JournalLib).toBe('Journal des Ventes')
      })
    })
  })

  describe('generateFECFile', () => {
    it('should generate pipe-delimited content', () => {
      const entries = generateFECEntries(sampleInvoice)
      const content = generateFECFile(entries)

      expect(content).toContain('|')
      expect(content.split('\n')[0]).toContain('JournalCode')
    })

    it('should have correct number of columns', () => {
      const entries = generateFECEntries(sampleInvoice)
      const content = generateFECFile(entries)
      const lines = content.split('\n')

      lines.forEach(line => {
        // 18 columns = 17 separators
        expect(line.split('|').length).toBe(18)
      })
    })
  })

  describe('generateFECFilename', () => {
    it('should follow FEC naming convention', () => {
      const filename = generateFECFilename('123456789', new Date('2025-12-31'))

      expect(filename).toBe('123456789FEC20251231.txt')
    })
  })
})

describe('Sage Export', () => {
  const sampleInvoice = {
    id: 'inv-001',
    invoiceNumber: 'FAC-2025-0001',
    createdAt: '2025-01-15T10:00:00Z',
    clientCode: 'FLORNA',
    clientName: 'FLORNA COSMETICS',
    lines: [
      { lineType: 'software', description: 'Abonnement logiciel', totalHT: 49.00, tva: 9.80 },
      { lineType: 'shipping', description: 'Prépa & Expédition', totalHT: 537.00, tva: 107.40 },
      { lineType: 'fuel_surcharge', description: 'Surcharge carburant 4%', totalHT: 21.48, tva: 4.30 },
    ],
    totalHT: 607.48,
    totalTVA: 121.50,
    totalTTC: 728.98,
  }

  describe('formatSageDate', () => {
    it('should format date as DD/MM/YYYY', () => {
      expect(formatSageDate(new Date(2025, 0, 15))).toBe('15/01/2025') // Jan 15, 2025
      expect(formatSageDate(new Date(2025, 11, 31))).toBe('31/12/2025') // Dec 31, 2025
    })
  })

  describe('formatSageAmount', () => {
    it('should format with 2 decimal places', () => {
      expect(formatSageAmount(1234.5)).toBe('1234.50')
      expect(formatSageAmount(100)).toBe('100.00')
      expect(formatSageAmount(0)).toBe('0.00')
    })
  })

  describe('generateSageEntries', () => {
    it('should generate balanced entries', () => {
      const entries = generateSageEntries(sampleInvoice)
      const result = validateSageBalance(entries)

      expect(result.valid).toBe(true)
      expect(result.difference).toBe(0)
    })

    it('should create client debit entry', () => {
      const entries = generateSageEntries(sampleInvoice)
      const clientEntry = entries.find(e => e.compteGeneral.startsWith('411'))

      expect(clientEntry).toBeDefined()
      expect(clientEntry?.debit).toBe(728.98)
      expect(clientEntry?.credit).toBe(0)
    })

    it('should use specific accounts by line type', () => {
      const entries = generateSageEntries(sampleInvoice)

      const softwareEntry = entries.find(e => e.compteGeneral === '706100')
      const shippingEntry = entries.find(e => e.compteGeneral === '706400')
      const fuelEntry = entries.find(e => e.compteGeneral === '706500')

      expect(softwareEntry).toBeDefined()
      expect(shippingEntry).toBeDefined()
      expect(fuelEntry).toBeDefined()
    })

    it('should create TVA credit entry', () => {
      const entries = generateSageEntries(sampleInvoice)
      const tvaEntry = entries.find(e => e.compteGeneral === '445710')

      expect(tvaEntry).toBeDefined()
      expect(tvaEntry?.credit).toBe(121.50)
    })
  })

  describe('generateSageCSV', () => {
    it('should generate semicolon-delimited CSV', () => {
      const entries = generateSageEntries(sampleInvoice)
      const csv = generateSageCSV(entries)

      expect(csv).toContain(';')
      expect(csv.split('\n')[0]).toContain('Date')
      expect(csv.split('\n')[0]).toContain('Journal')
    })

    it('should quote libellé field', () => {
      const entries = generateSageEntries(sampleInvoice)
      const csv = generateSageCSV(entries)

      // Libellé should be quoted
      expect(csv).toContain('"')
    })
  })

  describe('validateSageBalance', () => {
    it('should detect unbalanced entries', () => {
      const unbalanced = [
        { dateEcriture: '15/01/2025', journal: 'VE', compteGeneral: '411', compteTiers: '', libelle: 'Test', debit: 100, credit: 0, pieceRef: 'TEST' },
        { dateEcriture: '15/01/2025', journal: 'VE', compteGeneral: '706', compteTiers: '', libelle: 'Test', debit: 0, credit: 50, pieceRef: 'TEST' },
      ]

      const result = validateSageBalance(unbalanced)

      expect(result.valid).toBe(false)
      expect(result.difference).toBe(50)
    })

    it('should allow small rounding differences', () => {
      const almostBalanced = [
        { dateEcriture: '15/01/2025', journal: 'VE', compteGeneral: '411', compteTiers: '', libelle: 'Test', debit: 100.001, credit: 0, pieceRef: 'TEST' },
        { dateEcriture: '15/01/2025', journal: 'VE', compteGeneral: '706', compteTiers: '', libelle: 'Test', debit: 0, credit: 100, pieceRef: 'TEST' },
      ]

      const result = validateSageBalance(almostBalanced)

      expect(result.valid).toBe(true) // 0.001 < 0.01 threshold
    })
  })
})
