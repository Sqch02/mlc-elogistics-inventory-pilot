// Rendu serveur du PDF de facture, pour le joindre a un email.
//
// invoice-pdf.ts reste intact : c'est un chemin qui fonctionne, utilise par le
// bouton de telechargement, et le modifier serait un changement de
// comportement sur du code qui n'a rien demande. Ce module se contente de
// reutiliser sa generation et de remplacer les deux morceaux qui n'existent
// pas cote serveur :
//
//   - loadLogoDataUrl fait fetch('/logo-hme.jpg') puis FileReader. L'URL
//     relative n'a aucun sens hors navigateur, et FileReader n'existe pas.
//     Ici on lit le fichier depuis le disque.
//   - downloadInvoicePDF appelle doc.save(), qui declenche un telechargement.
//     Ici on renvoie les octets.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateInvoicePDF, type InvoicePDFData } from './invoice-pdf'

const LOGO_PATH = join(process.cwd(), 'public', 'logo-hme.jpg')

/**
 * Charge le logo depuis le disque plutot que par une requete HTTP.
 *
 * Un logo manquant ne doit jamais empecher l'envoi d'une facture : on renvoie
 * undefined et le PDF est genere sans.
 */
export async function loadLogoDataUrlFromDisk(): Promise<string | undefined> {
  try {
    const bytes = await readFile(LOGO_PATH)
    return `data:image/jpeg;base64,${bytes.toString('base64')}`
  } catch {
    return undefined
  }
}

export interface RenderedInvoicePdf {
  filename: string
  contentType: 'application/pdf'
  bytes: Buffer
}

export async function renderInvoicePdf(
  data: InvoicePDFData,
  options: { loadLogo?: () => Promise<string | undefined> } = {},
): Promise<RenderedInvoicePdf> {
  // Un logo indisponible ne doit JAMAIS empecher l'envoi d'une facture, quelle
  // que soit la raison de l'echec et quel que soit le chargeur utilise.
  let logoDataUrl = data.logoDataUrl
  if (!logoDataUrl) {
    try {
      logoDataUrl = await (options.loadLogo ?? loadLogoDataUrlFromDisk)()
    } catch {
      logoDataUrl = undefined
    }
  }
  const withLogo: InvoicePDFData = { ...data, logoDataUrl }

  const doc = await generateInvoicePDF(withLogo)
  const output = doc.output('arraybuffer') as ArrayBuffer

  return {
    filename: `facture_${withLogo.invoiceNumber}.pdf`,
    contentType: 'application/pdf',
    bytes: Buffer.from(output),
  }
}
