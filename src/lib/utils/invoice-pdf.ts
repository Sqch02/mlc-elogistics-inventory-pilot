import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InvoicePDFData {
  invoiceNumber: string
  month: string
  createdAt: string
  dateFrom?: string
  dateTo?: string
  shipmentCount?: number
  logoDataUrl?: string
  company: {
    name: string
    address: string
    city: string
    postalCode: string
    country: string
    vatNumber?: string
    siret?: string
    email?: string
    phone?: string
    website?: string
  }
  client?: {
    name: string
    address?: string
    city?: string
    postalCode?: string
    country?: string
    vatNumber?: string
  }
  lines: Array<{
    lineType?: string
    description?: string
    carrier?: string | null
    weightMin?: number | null
    weightMax?: number | null
    quantity?: number
    shipmentCount: number
    unitPrice: number
    total: number
  }>
  totalHT: number
  tvaRate: number
  tva: number
  totalTTC: number
  paymentTerms?: string
  bankDetails?: string
  missingPricingCount?: number
}

// Line type labels for the Type column
const LINE_TYPE_LABELS: Record<string, string> = {
  software: 'Abonnement',
  storage: 'Stockage',
  reception: 'Réception',
  shipping: 'Prépa & Exp',
  fuel_surcharge: 'Surcharge',
  returns: 'Retours',
}

// HME brand colors
const NAVY: [number, number, number] = [30, 58, 95]      // #1E3A5F
const GOLD: [number, number, number] = [201, 162, 39]     // #C9A227
const DARK: [number, number, number] = [33, 33, 33]
const GRAY: [number, number, number] = [100, 100, 100]
const LIGHT_GRAY: [number, number, number] = [200, 200, 200]
const CREAM_BG: [number, number, number] = [245, 243, 237] // #F5F3ED

/**
 * Load the HME logo as a data URL for embedding in PDF
 */
export async function loadLogoDataUrl(): Promise<string | undefined> {
  try {
    const response = await fetch('/logo-hme.jpg')
    if (!response.ok) return undefined
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export function generateInvoicePDF(data: InvoicePDFData): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  const rightColX = pageWidth / 2 + 8

  // Derived dates
  const dateFrom = data.dateFrom || `${data.month}-01`
  const dateTo = data.dateTo || (() => {
    const [y, m] = data.month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    return `${data.month}-${String(lastDay).padStart(2, '0')}`
  })()

  const formatFrDate = (d: string) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  let yPos = margin

  // === HEADER: Logo (left) + Facture number (right) ===
  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, 'JPEG', margin, yPos - 2, 35, 22)
    } catch {
      // Fallback: text logo
      doc.setFontSize(16)
      doc.setTextColor(...NAVY)
      doc.setFont('helvetica', 'bold')
      doc.text('HME', margin, yPos + 8)
      doc.setFontSize(10)
      doc.text('LOGISTICS', margin, yPos + 14)
    }
  } else {
    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.text('HME', margin, yPos + 8)
    doc.setFontSize(10)
    doc.text('LOGISTICS', margin, yPos + 14)
  }

  // Facture number + date (right aligned)
  doc.setFontSize(18)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.text(`Facture ${data.invoiceNumber}`, pageWidth - margin, yPos + 7, { align: 'right' })

  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  const invoiceDate = new Date(data.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  doc.text(invoiceDate, pageWidth - margin, yPos + 14, { align: 'right' })

  yPos += 25

  // Gold accent line (like the HME logo underline)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.2)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // === EMETTEUR / DESTINATAIRE dual columns ===

  // Emetteur (left)
  doc.setFontSize(7)
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.text('ÉMETTEUR', margin, yPos)

  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.text(data.company.name || 'MLC PROJECT', margin, yPos + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  let emY = yPos + 12
  if (data.company.address) { doc.text(data.company.address, margin, emY); emY += 3.5 }
  if (data.company.postalCode || data.company.city) {
    doc.text(`${data.company.postalCode} ${data.company.city}`.trim(), margin, emY); emY += 3.5
  }
  if (data.company.country) { doc.text(data.company.country, margin, emY); emY += 3.5 }
  emY += 1
  doc.setTextColor(...GRAY)
  if (data.company.siret) { doc.text(`SIRET: ${data.company.siret}`, margin, emY); emY += 3.5 }
  if (data.company.vatNumber) { doc.text(`TVA: ${data.company.vatNumber}`, margin, emY); emY += 3.5 }
  if (data.company.phone) { doc.text(`Tél: ${data.company.phone}`, margin, emY); emY += 3.5 }
  if (data.company.email) { doc.text(data.company.email, margin, emY); emY += 3.5 }
  if (data.company.website) { doc.text(data.company.website, margin, emY); emY += 3.5 }

  // Destinataire (right)
  doc.setFontSize(7)
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.text('DESTINATAIRE', rightColX, yPos)

  if (data.client?.name) {
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.text(data.client.name, rightColX, yPos + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...DARK)
    let destY = yPos + 12
    if (data.client.address) { doc.text(data.client.address, rightColX, destY); destY += 3.5 }
    if (data.client.postalCode || data.client.city) {
      doc.text(`${data.client.postalCode || ''} ${data.client.city || ''}`.trim(), rightColX, destY); destY += 3.5
    }
    if (data.client.country) { doc.text(data.client.country, rightColX, destY); destY += 3.5 }
    if (data.client.vatNumber) {
      destY += 1
      doc.setTextColor(...GRAY)
      doc.text(`TVA: ${data.client.vatNumber}`, rightColX, destY)
    }
  }

  yPos = Math.max(emY, yPos + 35) + 6

  // === SUBTITLE ===
  doc.setFontSize(8.5)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'italic')
  const shipCount = data.shipmentCount ?? data.lines.filter(l => l.lineType === 'shipping').reduce((s, l) => s + l.shipmentCount, 0)
  const subtitle = `Prestation logistique du ${formatFrDate(dateFrom)} au ${formatFrDate(dateTo)} pour la marque ${data.client?.name || '—'} pour un total de ${shipCount} commandes expédiées.`

  const subtitleLines = doc.splitTextToSize(subtitle, contentWidth)
  doc.text(subtitleLines, margin, yPos)
  yPos += subtitleLines.length * 4.5 + 8

  // === DETAIL TABLE ===
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.text('Détail', margin, yPos)
  yPos += 4

  const tableData = data.lines.map((line) => {
    const typeLabel = LINE_TYPE_LABELS[line.lineType || 'shipping'] || line.lineType || 'Autre'
    const description = line.description || '—'
    const qty = line.quantity || line.shipmentCount || 1
    return [
      typeLabel,
      description,
      `${line.unitPrice.toFixed(2)} €`,
      String(qty),
      `${line.total.toFixed(2)} €`,
    ]
  })

  autoTable(doc, {
    startY: yPos,
    head: [['Type', 'Description', 'PU HT', 'Qté', 'Total HT']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: DARK,
      lineColor: LIGHT_GRAY,
      lineWidth: 0.2,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: CREAM_BG,
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold', textColor: NAVY },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      drawFooter(doc, data, pageWidth, pageHeight, margin)
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8

  // New page if not enough space
  if (yPos > pageHeight - 95) {
    doc.addPage()
    yPos = margin + 10
  }

  // === MISSING PRICING WARNING ===
  if (data.missingPricingCount && data.missingPricingCount > 0) {
    doc.setFontSize(7)
    doc.setTextColor(200, 50, 50)
    doc.text(
      `* ${data.missingPricingCount} expédition(s) sans tarification non incluse(s)`,
      margin,
      yPos
    )
    yPos += 7
  }

  // === TOTALS (right-aligned) ===
  const totalsX = pageWidth - margin - 78
  const totalsW = 78

  // Background box for totals
  doc.setFillColor(...CREAM_BG)
  doc.setDrawColor(...LIGHT_GRAY)
  const totalsBoxH = data.tvaRate > 0 && data.tva > 0 ? 28 : 22
  doc.roundedRect(totalsX - 4, yPos - 4, totalsW + 8, totalsBoxH, 1.5, 1.5, 'FD')

  doc.setFontSize(8.5)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'normal')
  doc.text('Total HT :', totalsX, yPos + 2)
  doc.text(`${data.totalHT.toFixed(2)} €`, totalsX + totalsW, yPos + 2, { align: 'right' })

  if (data.tvaRate > 0 && data.tva > 0) {
    doc.text(`TVA ${data.tvaRate}% :`, totalsX, yPos + 9)
    doc.text(`${data.tva.toFixed(2)} €`, totalsX + totalsW, yPos + 9, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text('Total TTC :', totalsX, yPos + 19)
    doc.text(`${data.totalTTC.toFixed(2)} €`, totalsX + totalsW, yPos + 19, { align: 'right' })
    yPos += 35
  } else {
    doc.setFontSize(6.5)
    doc.setTextColor(...GRAY)
    doc.text('TVA non applicable, art. 293 B du CGI', totalsX, yPos + 9)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    doc.text('Total :', totalsX, yPos + 16)
    doc.text(`${data.totalHT.toFixed(2)} €`, totalsX + totalsW, yPos + 16, { align: 'right' })
    yPos += 28
  }

  // New page if not enough space for conditions
  if (yPos > pageHeight - 55) {
    doc.addPage()
    yPos = margin + 10
  }

  // === CONDITIONS + RIB (dual columns) ===
  const condColW = (contentWidth - 15) / 2

  // Conditions (left)
  doc.setFontSize(7.5)
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.text('CONDITIONS', margin, yPos)
  yPos += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)

  let condY = yPos
  const defaultConditions = [
    'Conditions de règlement : 10 jours',
    'Mode de règlement : Virement bancaire',
    'Intérêts de retard : 10 points le taux légal en vigueur',
  ]

  const conditionsList = data.paymentTerms
    ? data.paymentTerms.split('\n').filter(Boolean)
    : defaultConditions

  conditionsList.forEach(term => {
    doc.text(term, margin, condY)
    condY += 3.5
  })

  if (data.company.email) {
    condY += 2
    doc.setTextColor(...GRAY)
    doc.setFontSize(6.5)
    doc.text(`Notes : ${data.company.email}`, margin, condY)
  }

  // RIB (right)
  if (data.bankDetails) {
    const ribX = margin + condColW + 15
    doc.setFontSize(7.5)
    doc.setTextColor(...GOLD)
    doc.setFont('helvetica', 'bold')
    doc.text('RIB', ribX, yPos - 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...DARK)

    let ribY = yPos
    const bankLines = data.bankDetails.split('\n').filter(Boolean)
    bankLines.forEach(line => {
      doc.text(line, ribX, ribY)
      ribY += 3.5
    })
  }

  // Footer on last page
  drawFooter(doc, data, pageWidth, pageHeight, margin)

  // Page numbers
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(6.5)
    doc.setTextColor(...GRAY)
    doc.text(`Page ${i} sur ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  return doc
}

function drawFooter(
  doc: jsPDF,
  data: InvoicePDFData,
  pageWidth: number,
  pageHeight: number,
  margin: number,
) {
  const footerY = pageHeight - 15

  // Gold accent line
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)

  // Legal text
  doc.setFontSize(5.5)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')

  const parts = [
    data.company.name,
    data.company.siret ? `SIRET: ${data.company.siret}` : null,
    data.company.vatNumber ? `TVA: ${data.company.vatNumber}` : null,
    data.company.address ? `${data.company.address}, ${data.company.postalCode} ${data.company.city}` : null,
  ].filter(Boolean)

  doc.text(parts.join(' — '), pageWidth / 2, footerY, { align: 'center' })
}

export async function downloadInvoicePDF(data: InvoicePDFData, filename: string): Promise<void> {
  // Load logo if not already provided
  if (!data.logoDataUrl) {
    data.logoDataUrl = await loadLogoDataUrl()
  }
  const doc = generateInvoicePDF(data)
  doc.save(filename)
}

export function formatInvoiceNumber(prefix: string, year: number, number: number): string {
  return `${prefix}-${year}-${String(number).padStart(4, '0')}`
}
