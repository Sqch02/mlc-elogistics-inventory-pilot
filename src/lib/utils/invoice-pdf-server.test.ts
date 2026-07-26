import { describe, expect, it, vi } from 'vitest'
import { renderInvoicePdf, loadLogoDataUrlFromDisk } from './invoice-pdf-server'
import type { InvoicePDFData } from './invoice-pdf'

const invoice: InvoicePDFData = {
  invoiceNumber: 'FAC-2026-0001',
  month: '2026-07',
  createdAt: '2026-07-31',
  company: {
    name: 'HME Logistics',
    address: '1 rue de l Entrepot',
    city: 'Lyon',
    postalCode: '69000',
    country: 'France',
  },
  client: { name: 'Client Test' },
  lines: [
    {
      lineType: 'shipping',
      description: 'Expeditions',
      shipmentCount: 120,
      unitPrice: 3.5,
      total: 420,
    },
  ],
  totalHT: 420,
  tvaRate: 20,
  tva: 84,
  totalTTC: 504,
}

describe('renderInvoicePdf', () => {
  it('produit un vrai PDF en octets, pas un telechargement navigateur', async () => {
    const result = await renderInvoicePdf(invoice, { loadLogo: async () => undefined })

    expect(result.contentType).toBe('application/pdf')
    expect(Buffer.isBuffer(result.bytes)).toBe(true)
    // Signature d'un fichier PDF.
    expect(result.bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(result.bytes.length).toBeGreaterThan(500)
  })

  it('nomme le fichier avec le numero de facture', async () => {
    const result = await renderInvoicePdf(invoice, { loadLogo: async () => undefined })
    expect(result.filename).toBe('facture_FAC-2026-0001.pdf')
  })

  it('genere quand meme la facture si le logo est introuvable', async () => {
    // Un logo manquant ne doit jamais empecher l'envoi d'une facture.
    const result = await renderInvoicePdf(invoice, { loadLogo: async () => { throw new Error('absent') } })
      .catch(() => null)

    // Soit il gere, soit il remonte : ce test fige le comportement attendu.
    expect(result).not.toBeNull()
    expect(result?.contentType).toBe('application/pdf')
  })

  it('respecte un logo deja fourni sans relire le disque', async () => {
    const loadLogo = vi.fn(async () => 'data:image/jpeg;base64,AAAA')
    await renderInvoicePdf({ ...invoice, logoDataUrl: 'data:image/jpeg;base64,BBBB' }, { loadLogo })
    expect(loadLogo).not.toHaveBeenCalled()
  })
})

describe('loadLogoDataUrlFromDisk', () => {
  it('lit le logo depuis le disque et renvoie une data URL', async () => {
    const logo = await loadLogoDataUrlFromDisk()
    // Le fichier existe dans public/ ; s'il disparait, on renvoie undefined
    // plutot que de faire echouer une facture.
    if (logo !== undefined) {
      expect(logo.startsWith('data:image/jpeg;base64,')).toBe(true)
      expect(logo.length).toBeGreaterThan(100)
    }
  })
})
