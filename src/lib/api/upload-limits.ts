/**
 * Plafond de taille sur les fichiers importes.
 *
 * Les huit routes d'import lisaient le fichier entier en memoire avec
 * `file.text()`, sans aucun controle. Un import trop gros — un export mal
 * filtre suffit — remplit la memoire de l'instance et fait tomber
 * l'application POUR TOUS LES CLIENTS, pas seulement pour celui qui importe.
 *
 * Ces routes exigent un role, ce n'est donc pas une porte ouverte a l'exterieur.
 * Mais une panne generale declenchee par une maladresse reste une panne
 * generale, et l'hebergement n'a pas de marge memoire a offrir.
 *
 * Le plafond est volontairement large : le plus gros import legitime observe
 * tient largement en dessous. Il n'est pas la pour discipliner un usage
 * normal, mais pour empecher qu'une erreur devienne une interruption de
 * service.
 */

/** 5 Mo : environ 50 000 lignes de catalogue, bien au-dela des imports reels. */
export const TAILLE_MAX_IMPORT_OCTETS = 5 * 1024 * 1024

/** Garde-fou complementaire : un fichier compact peut porter enormement de lignes. */
export const LIGNES_MAX_IMPORT = 20_000

export interface RefusImport {
  message: string
  status: number
}

/**
 * Verifie le fichier AVANT de le lire. Le controle porte sur `file.size`, donc
 * il ne coute rien : lire d'abord pour mesurer ensuite reviendrait a subir
 * exactement ce qu'on veut eviter.
 */
export function refuserFichierTropGros(file: File): RefusImport | null {
  if (file.size > TAILLE_MAX_IMPORT_OCTETS) {
    const mo = (file.size / (1024 * 1024)).toFixed(1)
    const maxMo = Math.round(TAILLE_MAX_IMPORT_OCTETS / (1024 * 1024))
    return {
      message: `Fichier trop volumineux (${mo} Mo). La limite est de ${maxMo} Mo : découpez l'import en plusieurs fichiers.`,
      status: 413,
    }
  }
  return null
}

/** Verifie le nombre de lignes une fois le contenu lu, avant tout traitement. */
export function refuserTropDeLignes(nombreDeLignes: number): RefusImport | null {
  if (nombreDeLignes > LIGNES_MAX_IMPORT) {
    return {
      message: `Trop de lignes (${nombreDeLignes}). La limite est de ${LIGNES_MAX_IMPORT} : découpez l'import en plusieurs fichiers.`,
      status: 413,
    }
  }
  return null
}
