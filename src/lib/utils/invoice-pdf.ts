import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InvoicePDFData {
  invoiceNumber: string
  month: string
  createdAt: string
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
  }
  client?: {
    name: string
    address?: string
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

export function generateInvoicePDF(data: InvoicePDFData): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPos = margin

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 95] // #1E3A5F (HME Navy)
  const darkGray: [number, number, number] = [51, 51, 51]
  const lightGray: [number, number, number] = [128, 128, 128]

  // Header - Company Info
  doc.setFontSize(20)
  doc.setTextColor(...primaryColor)
  doc.setFont('helvetica', 'bold')
  doc.text(data.company.name || 'HME LOGISTICS', margin, yPos)

  yPos += 8
  doc.setFontSize(9)
  doc.setTextColor(...lightGray)
  doc.setFont('helvetica', 'normal')

  if (data.company.address) {
    doc.text(data.company.address, margin, yPos)
    yPos += 4
  }
  if (data.company.postalCode || data.company.city) {
    doc.text(`${data.company.postalCode} ${data.company.city}`.trim(), margin, yPos)
    yPos += 4
  }
  if (data.company.country) {
    doc.text(data.company.country, margin, yPos)
    yPos += 4
  }
  if (data.company.phone) {
    doc.text(`Tel: ${data.company.phone}`, margin, yPos)
    yPos += 4
  }
  if (data.company.email) {
    doc.text(`Email: ${data.company.email}`, margin, yPos)
    yPos += 4
  }
  if (data.company.siret) {
    doc.text(`SIRET: ${data.company.siret}`, margin, yPos)
    yPos += 4
  }
  if (data.company.vatNumber) {
    doc.text(`TVA: ${data.company.vatNumber}`, margin, yPos)
    yPos += 4
  }

  // Invoice Title - Right side
  doc.setFontSize(24)
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'bold')
  doc.text('FACTURE', pageWidth - margin, 25, { align: 'right' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(data.invoiceNumber, pageWidth - margin, 33, { align: 'right' })

  doc.setFontSize(9)
  doc.setTextColor(...lightGray)
  const formattedDate = new Date(data.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  doc.text(`Date: ${formattedDate}`, pageWidth - margin, 40, { align: 'right' })

  // Period
  const monthDate = new Date(data.month + '-01')
  const periodStr = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  doc.text(`Periode: ${periodStr}`, pageWidth - margin, 46, { align: 'right' })

  // Separator line
  yPos = Math.max(yPos + 10, 60)
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)

  yPos += 15

  // Table - build description based on line type
  const tableData = data.lines.map((line) => {
    let description = line.description || ''

    // If no description provided, build one from carrier/weight
    if (!description && line.carrier) {
      const weightLabel = line.weightMax && line.weightMax >= 1000
        ? `${(line.weightMax || 0) / 1000}kg`
        : `${line.weightMax || 0}g`
      description = `Prépa & Expédition - ${line.carrier} ${weightLabel}`
    }

    const qty = line.quantity || line.shipmentCount || 1

    return [
      description,
      qty.toString(),
      `${line.unitPrice.toFixed(2)} EUR`,
      `${line.total.toFixed(2)} EUR`,
    ]
  })

  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Qty', 'Prix unit. HT', 'Total HT']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: darkGray,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  // Get the final Y position after the table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 15

  // Warning for missing pricing
  if (data.missingPricingCount && data.missingPricingCount > 0) {
    doc.setFontSize(8)
    doc.setTextColor(220, 38, 38) // red
    doc.text(
      `Attention: ${data.missingPricingCount} expedition(s) sans tarification non incluse(s) dans cette facture`,
      margin,
      yPos
    )
    yPos += 10
  }

  // Totals box
  const totalsX = pageWidth - margin - 80
  const boxWidth = 80

  doc.setFillColor(248, 249, 250)
  doc.setDrawColor(200, 200, 200)
  doc.roundedRect(totalsX - 5, yPos - 5, boxWidth + 10, 45, 2, 2, 'FD')

  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'normal')

  doc.text('Total HT:', totalsX, yPos + 5)
  doc.text(`${data.totalHT.toFixed(2)} EUR`, totalsX + boxWidth, yPos + 5, { align: 'right' })

  doc.text(`TVA (${data.tvaRate}%):`, totalsX, yPos + 15)
  doc.text(`${data.tva.toFixed(2)} EUR`, totalsX + boxWidth, yPos + 15, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Total TTC:', totalsX, yPos + 30)
  doc.text(`${data.totalTTC.toFixed(2)} EUR`, totalsX + boxWidth, yPos + 30, { align: 'right' })

  yPos += 55

  // Payment terms
  if (data.paymentTerms) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkGray)
    doc.text('Conditions de paiement:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(data.paymentTerms, margin + 50, yPos)
    yPos += 10
  }

  // Bank details
  if (data.bankDetails) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Coordonnees bancaires:', margin, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    const bankLines = data.bankDetails.split('\n')
    bankLines.forEach((line) => {
      doc.text(line, margin, yPos)
      yPos += 4
    })
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15
  doc.setFontSize(8)
  doc.setTextColor(...lightGray)
  doc.text(
    `${data.company.name} - ${data.company.siret ? `SIRET: ${data.company.siret}` : ''} ${data.company.vatNumber ? `- TVA: ${data.company.vatNumber}` : ''}`.trim(),
    pageWidth / 2,
    footerY,
    { align: 'center' }
  )

  return doc
}

export function downloadInvoicePDF(data: InvoicePDFData, filename: string): void {
  const doc = generateInvoicePDF(data)
  doc.save(filename)
}

export function formatInvoiceNumber(prefix: string, year: number, number: number): string {
  return `${prefix}-${year}-${String(number).padStart(4, '0')}`
}
