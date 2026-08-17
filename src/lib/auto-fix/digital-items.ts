// Articles dematerialises : poids et donnees douanieres manquants.
//
// CAS DECRIT PAR L'EXPLOITATION (17/08), qui le corrige a la main a chaque
// fois et de la meme facon :
//
//   « Pour les produits digitaux [...] je mets toujours 0,001 kg, par contre
//     je suis oblige de changer manuellement le poids de la commande et de
//     rajouter ces fameux 0,001 kg sinon la commande reste en erreur. Je dois
//     aussi ajouter manuellement le pays d'origine, et aussi le code SH donc
//     je mets le meme. »
//
// TROIS champs, et non un seul. Le detail qui compte est le deuxieme : le
// poids de la COMMANDE doit etre ajuste en plus de celui de l'article, sinon
// le refus persiste. Sans cette precision, une correction portant seulement
// sur l'article aurait paru fonctionner tout en ne resolvant rien.
//
// NON ARME. Un poids modifie change le tarif et parfois le transporteur
// retenu ; un code SH est une declaration douaniere. On calcule donc la
// proposition, on la rend visible, et on attend une validation — la meme
// progression que pour les adresses, le CHF et les points relais.

import type { Json } from '@/types/database'

/** Valeur employee par l'exploitation, en kilogrammes. */
export const POIDS_ARTICLE_DEMATERIALISE_KG = 0.001

export interface ArticleACorriger {
  index: number
  /** Poids a inscrire, en kg. */
  weight_kg: number
  /** Renseigne seulement si l'article n'en portait pas. */
  hs_code?: string
  /** Renseigne seulement si l'article n'en portait pas. */
  country_of_origin?: string
}

export interface PlanArticlesDematerialises {
  ok: boolean
  reason?: string
  /** Articles a modifier, avec la valeur exacte pour chacun. */
  items: ArticleACorriger[]
  /** Poids total de la commande apres correction, en grammes. */
  order_weight_grams?: number
  /** Poids total avant correction, pour que l'ecart soit lisible. */
  order_weight_grams_before?: number
  defaults_used?: { hs_code?: string; country_of_origin?: string }
}

/**
 * Un article, dans l'UNE OU L'AUTRE des deux formes que renvoie Sendcloud.
 *
 * Les colis (API v2) et les commandes (API v3) ne nomment pas les memes champs
 * pour la meme information :
 *
 *   colis     `weight: "0.270"`            `origin_country: "FR"`
 *   commande  `measurement.weight.value`   `country_of_origin: "FR"`
 *
 * Ne lire qu'une seule forme fait croire que TOUT manque. Constate sur donnees
 * reelles : la proposition ramenait une commande de 271 g a 2 g, avec un tarif
 * faux a la cle. Les tests unitaires ne l'avaient pas vu, ils n'employaient que
 * la forme v3.
 */
interface ArticleBrut {
  // Forme v3 (commandes).
  measurement?: { weight?: { value?: number | string; unit?: string } | null } | null
  country_of_origin?: string | null
  // Forme v2 (colis).
  weight?: number | string | null
  origin_country?: string | null
  // Commun aux deux.
  hs_code?: string | null
  quantity?: number | null
}

function poidsEnKg(article: ArticleBrut): number {
  const structure = article.measurement?.weight
  if (structure && structure.value !== undefined && structure.value !== null) {
    const valeur = Number(structure.value)
    if (!Number.isFinite(valeur) || valeur <= 0) return 0
    // L'API melange les unites : confondre grammes et kilogrammes produirait
    // un poids mille fois trop grand.
    return String(structure.unit ?? 'kg').toLowerCase() === 'g' ? valeur / 1000 : valeur
  }

  // Forme plate des colis : toujours des kilogrammes, souvent une chaine.
  const plat = Number(article.weight ?? 0)
  return Number.isFinite(plat) && plat > 0 ? plat : 0
}

function origine(article: ArticleBrut): string | null | undefined {
  return article.country_of_origin ?? article.origin_country
}

function vide(valeur: string | null | undefined): boolean {
  return !valeur || String(valeur).trim() === ''
}

/**
 * Compose la correction pour les articles sans poids ni donnees douanieres.
 *
 * Ne renvoie une proposition que si TOUT ce qui manque peut etre comble : un
 * article sans poids ET sans code SH configure resterait refuse, et proposer
 * une correction partielle ferait croire au probleme resolu.
 */
export function buildDigitalItemsPlan(
  articles: ArticleBrut[],
  defauts: { hs_code?: string | null; country_of_origin?: string | null },
  poidsCommandeGrammesActuel?: number | null,
): PlanArticlesDematerialises {
  if (!Array.isArray(articles) || articles.length === 0) {
    return { ok: false, reason: 'no_items', items: [] }
  }

  const aCorriger: ArticleACorriger[] = []
  const manquants = new Set<string>()

  for (const [index, article] of articles.entries()) {
    const poids = poidsEnKg(article)
    const sansPoids = poids <= 0
    const sansCodeSh = vide(article.hs_code)
    const sansOrigine = vide(origine(article))
    if (!sansPoids && !sansCodeSh && !sansOrigine) continue

    const correction: ArticleACorriger = {
      index,
      weight_kg: sansPoids ? POIDS_ARTICLE_DEMATERIALISE_KG : poids,
    }

    if (sansCodeSh) {
      if (vide(defauts.hs_code)) { manquants.add('hs_code'); continue }
      correction.hs_code = String(defauts.hs_code).trim()
    }
    if (sansOrigine) {
      if (vide(defauts.country_of_origin)) { manquants.add('country_of_origin'); continue }
      correction.country_of_origin = String(defauts.country_of_origin).trim().toUpperCase()
    }

    aCorriger.push(correction)
  }

  if (manquants.size > 0) {
    // Sans valeur par defaut configuree, on ne fabrique rien : inventer un
    // code douanier serait une declaration fausse.
    return {
      ok: false,
      reason: `tenant_defaults_missing:${[...manquants].sort().join(',')}`,
      items: [],
    }
  }
  if (aCorriger.length === 0) {
    return { ok: false, reason: 'nothing_to_fix', items: [] }
  }

  // Le poids de la commande doit suivre celui des articles, sinon le refus
  // persiste — c'est le point que l'exploitation a explicitement signale.
  const poidsTotalKg = articles.reduce((somme, article, index) => {
    const correction = aCorriger.find((item) => item.index === index)
    const unitaire = correction ? correction.weight_kg : poidsEnKg(article)
    const quantite = Number(article.quantity ?? 1)
    return somme + unitaire * (Number.isFinite(quantite) && quantite > 0 ? quantite : 1)
  }, 0)

  return {
    ok: true,
    items: aCorriger,
    order_weight_grams: Math.max(1, Math.round(poidsTotalKg * 1000)),
    order_weight_grams_before: poidsCommandeGrammesActuel ?? undefined,
    defaults_used: {
      ...(aCorriger.some((i) => i.hs_code) ? { hs_code: String(defauts.hs_code) } : {}),
      ...(aCorriger.some((i) => i.country_of_origin)
        ? { country_of_origin: String(defauts.country_of_origin).toUpperCase() }
        : {}),
    },
  }
}

/** Forme serialisable pour le plan enregistre. */
export function digitalItemsPlanToJson(plan: PlanArticlesDematerialises): Json {
  return JSON.parse(JSON.stringify(plan)) as Json
}
