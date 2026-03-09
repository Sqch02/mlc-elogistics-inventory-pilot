import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InvoicePDFData {
  invoiceNumber: string
  month: string
  createdAt: string
  dateFrom?: string
  dateTo?: string
  shipmentCount?: number
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

export function generateInvoicePDF(data: InvoicePDFData): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  const rightColX = pageWidth / 2 + 5

  // Colors
  const navy: [number, number, number] = [30, 58, 95]   // #1E3A5F
  const dark: [number, number, number] = [33, 33, 33]
  const gray: [number, number, number] = [100, 100, 100]
  const lightGray: [number, number, number] = [180, 180, 180]
  const tableHeaderBg: [number, number, number] = [240, 240, 240]

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

  const totalPages = () => doc.getNumberOfPages()

  // --- PAGE HEADER (called on first page) ---
  let yPos = margin

  // Invoice number + date (top right)
  doc.setFontSize(20)
  doc.setTextColor(...navy)
  doc.setFont('helvetica', 'bold')
  doc.text(`Facture ${data.invoiceNumber}`, margin, yPos + 7)

  doc.setFontSize(9)
  doc.setTextColor(...gray)
  doc.setFont('helvetica', 'normal')
  const invoiceDate = new Date(data.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  doc.text(invoiceDate, pageWidth - margin, yPos + 7, { align: 'right' })

  yPos += 18

  // Separator
  doc.setDrawColor(...navy)
  doc.setLineWidth(0.8)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // --- EMETTEUR / DESTINATAIRE dual columns ---
  const colWidth = (contentWidth - 10) / 2

  // Emetteur (left)
  doc.setFontSize(8)
  doc.setTextColor(...navy)
  doc.setFont('helvetica', 'bold')
  doc.text('ÉMETTEUR', margin, yPos)

  doc.setFontSize(9)
  doc.setTextColor(...dark)
  doc.setFont('helvetica', 'bold')
  doc.text(data.company.name || 'MLC PROJECT', margin, yPos + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...gray)
  let emY = yPos + 12
  if (data.company.address) { doc.text(data.company.address, margin, emY); emY += 4 }
  if (data.company.postalCode || data.company.city) {
    doc.text(`${data.company.postalCode} ${data.company.city}`.trim(), margin, emY); emY += 4
  }
  if (data.company.country) { doc.text(data.company.country, margin, emY); emY += 4 }
  if (data.company.siret) { doc.text(`SIRET: ${data.company.siret}`, margin, emY); emY += 4 }
  if (data.company.vatNumber) { doc.text(`TVA: ${data.company.vatNumber}`, margin, emY); emY += 4 }
  if (data.company.phone) { doc.text(`Tél: ${data.company.phone}`, margin, emY); emY += 4 }
  if (data.company.email) { doc.text(data.company.email, margin, emY); emY += 4 }
  if (data.company.website) { doc.text(data.company.website, margin, emY); emY += 4 }

  // Destinataire (right)
  doc.setFontSize(8)
  doc.setTextColor(...navy)
  doc.setFont('helvetica', 'bold')
  doc.text('DESTINATAIRE', rightColX, yPos)

  if (data.client?.name) {
    doc.setFontSize(9)
    doc.setTextColor(...dark)
    doc.setFont('helvetica', 'bold')
    doc.text(data.client.name, rightColX, yPos + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    let destY = yPos + 12
    if (data.client.address) { doc.text(data.client.address, rightColX, destY); destY += 4 }
    if (data.client.postalCode || data.client.city) {
      doc.text(`${data.client.postalCode || ''} ${data.client.city || ''}`.trim(), rightColX, destY); destY += 4
    }
    if (data.client.country) { doc.text(data.client.country, rightColX, destY); destY += 4 }
    if (data.client.vatNumber) { doc.text(`TVA: ${data.client.vatNumber}`, rightColX, destY); destY += 4 }
  }

  yPos = Math.max(emY, yPos + 38) + 5

  // --- SUBTITLE: Prestation logistique ---
  doc.setFontSize(9)
  doc.setTextColor(...dark)
  doc.setFont('helvetica', 'italic')
  const subtitle = `Prestation logistique du ${formatFrDate(dateFrom)} au ${formatFrDate(dateTo)} pour la marque ${data.client?.name || '—'} pour un total de ${data.shipmentCount ?? data.lines.filter(l => l.lineType === 'shipping').reduce((s, l) => s + l.shipmentCount, 0)} commandes expédiées.`

  const subtitleLines = doc.splitTextToSize(subtitle, contentWidth)
  doc.text(subtitleLines, margin, yPos)
  yPos += subtitleLines.length * 5 + 8

  // --- DETAIL TABLE ---
  doc.setFontSize(10)
  doc.setTextColor(...navy)
  doc.setFont('helvetica', 'bold')
  doc.text('Détail', margin, yPos)
  yPos += 5

  const tableData = data.lines.map((line) => {
    const typeLabel = LINE_TYPE_LABELS[line.lineType || 'shipping'] || line.lineType || 'Autre'
    const description = line.description || '—'
    const qty = line.quantity || line.shipmentCount || 1
    const unitPrice = line.unitPrice
    const total = line.total

    return [
      typeLabel,
      description,
      `${unitPrice.toFixed(2)} €`,
      String(qty),
      `${total.toFixed(2)} €`,
    ]
  })

  autoTable(doc, {
    startY: yPos,
    head: [['Type', 'Description', 'PU HT', 'Qté', 'Total HT']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: tableHeaderBg,
      textColor: navy,
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: lightGray,
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: dark,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      // Footer on every page
      drawFooter(doc, data, pageWidth, pageHeight, margin, gray, lightGray)
    },
  })

  // Get Y after table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8

  // Check if we need a new page for totals + conditions
  if (yPos > pageHeight - 100) {
    doc.addPage()
    yPos = margin + 10
  }

  // --- MISSING PRICING WARNING ---
  if (data.missingPricingCount && data.missingPricingCount > 0) {
    doc.setFontSize(7)
    doc.setTextColor(200, 50, 50)
    doc.text(
      `* ${data.missingPricingCount} expédition(s) sans tarification non incluse(s) dans cette facture`,
      margin,
      yPos
    )
    yPos += 8
  }

  // --- TOTALS (right-aligned) ---
  const totalsX = pageWidth - margin - 75
  const totalsWidth = 75

  // Subtotal HT
  doc.setFontSize(9)
  doc.setTextColor(...dark)
  doc.setFont('helvetica', 'normal')
  doc.text('Total HT :', totalsX, yPos)
  doc.text(`${data.totalHT.toFixed(2)} €`, totalsX + totalsWidth, yPos, { align: 'right' })
  yPos += 6

  // TVA
  if (data.tvaRate > 0 && data.tva > 0) {
    doc.text(`TVA ${data.tvaRate}% :`, totalsX, yPos)
    doc.text(`${data.tva.toFixed(2)} €`, totalsX + totalsWidth, yPos, { align: 'right' })
    yPos += 6

    // Total TTC
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...navy)
    doc.text('Total TTC :', totalsX, yPos + 2)
    doc.text(`${data.totalTTC.toFixed(2)} €`, totalsX + totalsWidth, yPos + 2, { align: 'right' })
  } else {
    // No VAT
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text('TVA non applicable, art. 293 B du CGI', totalsX, yPos)
    yPos += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...navy)
    doc.text('Total :', totalsX, yPos + 2)
    doc.text(`${data.totalHT.toFixed(2)} €`, totalsX + totalsWidth, yPos + 2, { align: 'right' })
  }

  yPos += 18

  // Check space for conditions
  if (yPos > pageHeight - 65) {
    doc.addPage()
    yPos = margin + 10
  }

  // --- CONDITIONS + RIB (dual columns) ---
  const condColWidth = (contentWidth - 15) / 2

  // Conditions (left)
  doc.setFontSize(8)
  doc.setTextColor(...navy)
  doc.setFont('helvetica', 'bold')
  doc.text('CONDITIONS', margin, yPos)
  yPos += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...dark)

  let condY = yPos
  const conditions = [
    'Conditions de règlement : 10 jours',
    'Mode de règlement : Virement bancaire',
    'Intérêts de retard : 10 points le taux légal en vigueur',
  ]

  if (data.paymentTerms) {
    // Parse custom payment terms
    const customTerms = data.paymentTerms.split('\n').filter(Boolean)
    customTerms.forEach(term => {
      doc.text(term, margin, condY)
      condY += 4
    })
  } else {
    conditions.forEach(term => {
      doc.text(term, margin, condY)
      condY += 4
    })
  }

  if (data.company.email) {
    condY += 2
    doc.setTextColor(...gray)
    doc.text(`Notes : ${data.company.email}`, margin, condY)
    condY += 4
  }

  // RIB (right)
  if (data.bankDetails) {
    const ribX = margin + condColWidth + 15
    doc.setFontSize(8)
    doc.setTextColor(...navy)
    doc.setFont('helvetica', 'bold')
    doc.text('RIB', ribX, yPos - 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...dark)

    let ribY = yPos
    const bankLines = data.bankDetails.split('\n').filter(Boolean)
    bankLines.forEach(line => {
      doc.text(line, ribX, ribY)
      ribY += 4
    })
  }

  // Draw footer on last page
  drawFooter(doc, data, pageWidth, pageHeight, margin, gray, lightGray)

  // Add page numbers
  const pages = totalPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...gray)
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
  gray: [number, number, number],
  lightGray: [number, number, number]
) {
  const footerY = pageHeight - 15

  // Separator line
  doc.setDrawColor(...lightGray)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)

  // Legal text
  doc.setFontSize(6)
  doc.setTextColor(...gray)
  doc.setFont('helvetica', 'normal')

  const parts = [
    data.company.name,
    data.company.siret ? `SIRET: ${data.company.siret}` : null,
    data.company.vatNumber ? `TVA: ${data.company.vatNumber}` : null,
    data.company.address ? `${data.company.address}, ${data.company.postalCode} ${data.company.city}` : null,
  ].filter(Boolean)

  doc.text(parts.join(' — '), pageWidth / 2, footerY, { align: 'center' })
}

export function downloadInvoicePDF(data: InvoicePDFData, filename: string): void {
  const doc = generateInvoicePDF(data)
  doc.save(filename)
}

export function formatInvoiceNumber(prefix: string, year: number, number: number): string {
  return `${prefix}-${year}-${String(number).padStart(4, '0')}`
}
