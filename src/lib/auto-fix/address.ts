// Raccourcissement concret des champs d'adresse trop longs.
//
// Le detecteur repere la cause ("Ensure that city has at most 26 characters")
// et le planner nommait jusqu'ici une strategie sans jamais calculer la valeur
// corrigee. Pour ecrire reellement chez Sendcloud il faut la valeur, pas
// l'intention.
//
// Principe de sûrete, et c'est le coeur de ce module : abreger n'est pas
// tronquer. "Saint-Remy" -> "St-Remy" conserve l'information, un facteur et un
// transporteur lisent la meme adresse. Couper "Chambretaud Les Grands Champs"
// a 20 caracteres, en revanche, PERD de l'information et peut changer la
// destination. Le premier cas peut s'appliquer tout seul ; le second exige une
// revue humaine. La distinction est portee par le drapeau `lossy`.

const ADDRESS_FIELDS = [
  'address',
  'address_1',
  'address_2',
  'house_number',
  'city',
  'postal_code',
  // Le nom du destinataire a lui aussi une limite, et elle varie selon le
  // transporteur : 32 caracteres constate chez Colis Prive, 35 ailleurs. Sans
  // ce champ dans la liste, la limite arrivait bien depuis le refus mais le
  // plan l'ignorait — la tache restait en "cause inconnue".
  'name',
  'company_name',
] as const

export type AddressField = (typeof ADDRESS_FIELDS)[number]

// Abreviations postales usuelles, sans perte de sens. L'ordre compte : on
// traite les formes les plus longues d'abord pour eviter qu'une abreviation
// partielle n'empeche la suivante.
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bSainte\b/gi, 'Ste'],
  [/\bSaint\b/gi, 'St'],
  [/\bBoulevard\b/gi, 'Bd'],
  [/\bAvenue\b/gi, 'Av'],
  [/\bMar[ée]chal\b/gi, 'Mal'],
  [/\bG[ée]n[ée]ral\b/gi, 'Gal'],
  [/\bDocteur\b/gi, 'Dr'],
  [/\bPr[ée]sident\b/gi, 'Pdt'],
  [/\bChemins\b/gi, 'Ch'],
  [/\bMonsieur\b/gi, 'M'],
  [/\bCommandant\b/gi, 'Cdt'],
  [/\bColonel\b/gi, 'Col'],
  [/\bProfesseur\b/gi, 'Pr'],
  [/\bRoute\b/gi, 'Rte'],
  [/\bAll[ée]e\b/gi, 'All'],
  [/\bResidence\b/gi, 'Res'],
  [/\bRésidence\b/gi, 'Rés'],
  [/\bAppartement\b/gi, 'Apt'],
  [/\bBatiment\b/gi, 'Bat'],
  [/\bBâtiment\b/gi, 'Bât'],
  [/\bImmeuble\b/gi, 'Imm'],
  [/\bLotissement\b/gi, 'Lot'],
  [/\bLots\b/gi, 'Lot'],
  // Sans frontiere de mot a gauche : les saisies collent souvent le numero au
  // type de voie ("70chemins des vignes"), et \b ne coupe pas entre un
  // chiffre et une lettre.
  [/(\d)chemins?\b/gi, '$1 Ch'],
  [/(\d)rue\b/gi, '$1 rue'],
  [/(\d)avenue\b/gi, '$1 Av'],
  [/\bChemin\b/gi, 'Ch'],
  [/\bImpasse\b/gi, 'Imp'],
  [/\bPlace\b/gi, 'Pl'],
  [/\bSquare\b/gi, 'Sq'],
  [/\bFaubourg\b/gi, 'Fbg'],
  [/\bZone Industrielle\b/gi, 'ZI'],
]

export interface ShortenResult {
  value: string
  /** true si de l'information a ete perdue (coupe), false si simple abreviation. */
  lossy: boolean
  /** Transformations appliquees, dans l'ordre. */
  applied: string[]
}

/**
 * Retire les mots de liaison laisses en fin de coupe.
 *
 * Une coupe a la frontiere de mot produit facilement "10 Rue des Frères Eugène
 * et" ou "Av F Mitterrand Parc des". Releve sur les deux propositions du 19/08.
 *
 * L'information est deja perdue a ce stade — ce n'est pas ce qu'on repare. Mais
 * une proposition qui se termine par "et" a l'air cassee, et une suggestion qui
 * a l'air cassee decredibilise toutes les autres. L'exploitation doit pouvoir
 * la lire d'un coup d'oeil et dire oui ou non.
 */
function trimTrailingConnector(value: string): string {
  const connecteurs = /\s+(et|ou|de|des|du|d|la|le|les|l|aux?|en|sur|sous|par|pour|avec|a)$/i
  let sortie = value.trim()
  // Plusieurs peuvent s'enchainer : "Rue des Frères de la" -> "Rue des Frères".
  for (let i = 0; i < 3; i += 1) {
    const suivant = sortie.replace(connecteurs, '').trim()
    if (suivant === sortie || suivant.length < 3) break
    sortie = suivant
  }
  return sortie
}

/** Compare deux mots sans se soucier de la casse, des accents ni de la ponctuation. */
function memeMot(a: string, b: string): boolean {
  const propre = (mot: string) =>
    mot.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ga = propre(a)
  return ga !== '' && ga === propre(b)
}

/**
 * Retire une repetition litterale en fin de champ.
 *
 * Observe en production le 24/08, dans DEUX champs differents :
 *   "60 rue des cigognes 60 Rue des Cigognes"   -> la voie entiere, deux fois
 *   "Marolles sous lignieres sous lignieres"    -> la fin de la ville, deux fois
 *
 * C'est la seule reparation dont l'absence de perte se demontre au lieu de se
 * plaider : si la fin d'un texte repete mot pour mot ce qui la precede, la
 * repetition ne porte aucune information. Rien n'est arbitre, rien n'est
 * choisi — on enleve un doublon.
 *
 * Elle vient donc AVANT toute autre reparation : il arrive qu'elle suffise, et
 * elle evite alors un arbitrage humain sur une adresse qui n'avait aucun
 * probleme reel.
 *
 * On exige au moins DEUX mots repetes. Un mot unique redouble peut etre
 * legitime — un lieu-dit, un nom compose — et le gain ne vaut pas le risque de
 * mutiler une adresse valable.
 */
export function retirerRepetitionFinale(value: string): { value: string; applied: string[] } {
  const mots = tokenize(value)
  const n = mots.length

  for (let k = Math.floor(n / 2); k >= 2; k -= 1) {
    const fin = mots.slice(n - k)
    const avant = mots.slice(n - 2 * k, n - k)
    if (fin.every((mot, i) => memeMot(mot, avant[i]))) {
      const restant = mots.slice(0, n - k).join(' ')
      if (restant.trim() === '') break
      return { value: restant, applied: ['drop_repeated_tail'] }
    }
  }

  return { value, applied: [] }
}

export function shortenAddressField(value: string, limit: number): ShortenResult {
  const applied: string[] = []

  // Une limite absurde ne doit pas nous faire inventer une valeur.
  if (!Number.isFinite(limit) || limit < 1) return { value, lossy: false, applied }
  if (value.length <= limit) return { value, lossy: false, applied }

  let current = value

  // 1. Espaces redondants : gain gratuit, aucune perte.
  const collapsed = current.replace(/\s+/g, ' ').trim()
  if (collapsed !== current) {
    current = collapsed
    applied.push('collapse_whitespace')
    if (current.length <= limit) return { value: current, lossy: false, applied }
  }

  // 2. Abreviations postales : conserve le sens. On les applique UNE A UNE et
  //    on s'arrete des que la limite est tenue. Abreger au-dela du necessaire
  //    serait sans perte mais eloignerait inutilement l'adresse de ce que le
  //    destinataire a saisi — et c'est lui qui la relira sur le colis.
  let abbreviatedAny = false
  for (const [pattern, replacement] of ABBREVIATIONS) {
    const next = current.replace(pattern, replacement).replace(/\s+/g, ' ').trim()
    if (next === current) continue
    current = next
    abbreviatedAny = true
    if (current.length <= limit) {
      applied.push('abbreviate')
      return { value: current, lossy: false, applied }
    }
  }
  if (abbreviatedAny) applied.push('abbreviate')

  // 3. Coupe a la frontiere de mot : a partir d'ici, on PERD de l'information.
  const cut = current.slice(0, limit)
  const lastBoundary = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('-'))
  if (lastBoundary > 0) {
    applied.push('word_boundary')
    return { value: trimTrailingConnector(cut.slice(0, lastBoundary)), lossy: true, applied }
  }

  // 4. Dernier recours : un seul mot plus long que la limite.
  applied.push('truncate')
  return { value: cut, lossy: true, applied }
}

// ---------------------------------------------------------------------------
// Strategies contextuelles, sans perte
//
// Confrontation aux vraies commandes refusees par Sendcloud : sur 15 adresses
// trop longues, l'abreviation seule n'en reglait que 6. Les autres echouaient
// sur des motifs recurrents qui ne demandent pourtant AUCUNE perte
// d'information, parce que l'information existe deja ailleurs dans la commande :
//
//   "76 grand rue hoscas Herbignac 44410"    ville + code postal recopies
//   "106 B Rue de la Richelandiere 42100 St Etienne"          idem
//   "515 route la fontaine des oiseaux 515"  numero de voie recopie a la fin
//   "27 Rue du Soleil Levant (Landemont)"    lieu-dit, address_2 vide
//   "6 rue de la borderie - l'Aubertiere"    idem
//
// Retirer un code postal deja porte par `postal_code`, ou deplacer un lieu-dit
// vers un `address_2` vide, ne change pas la destination : les deux champs sont
// imprimes sur l'etiquette. C'est pourquoi ces strategies restent `lossy: false`
// alors que la coupe, elle, ne peut pas l'etre.
// ---------------------------------------------------------------------------

/** Compare des toponymes malgre accents, casse, tirets et Saint/St. */
function normalizeLocality(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9]/g, '')
}

function tokenize(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
}

/**
 * Retire d'un champ les mentions administratives que la commande porte deja
 * ailleurs : pays, region, departement.
 *
 * Observe en production : "Marseille, Bouches-du-Rhone, France" dans le champ
 * VILLE, ou "60 Rue de Bien Assis, Clermont-Ferrand, France" dans le champ
 * voie. La boutique recopie l'adresse complete formatee ; tout ce qui suit la
 * premiere virgule est administratif, et le pays comme le code postal ont
 * leurs propres champs.
 *
 * Strictement sans perte : on ne coupe qu'a une VIRGULE, jamais au milieu d'un
 * segment, et seulement si ce qui reste est plausible.
 */
export function stripAdministrativeTail(value: string, minLength = 3): { value: string; applied: string[] } {
  const segments = value.split(',').map((part) => part.trim()).filter(Boolean)
  if (segments.length < 2) return { value, applied: [] }

  const tete = segments[0]
  // Un premier segment trop court n'est pas une adresse : mieux vaut ne rien
  // faire que de produire une ligne vide de sens.
  if (tete.length < minLength) return { value, applied: [] }

  return { value: tete, applied: ['drop_administrative_tail'] }
}

/**
 * Nettoie la VILLE de ce que la commande porte deja ailleurs.
 *
 * CAS REELS releves par l'exploitation le 09/08, tous refuses par Mondial
 * Relay dont la limite de ville est 26 caracteres :
 *
 *   "Villeneuve-Les-Sablons (60175)"   30 -> 22   code postal deja en champ
 *   "Marseille 12eme arrondissement"   30 ->  9   13012 porte l'arrondissement
 *
 * Sans ce nettoyage, ces deux villes partaient en troncature aveugle
 * ("Marseille 12eme arrondis") et donc en arbitrage humain. Or il n'y a rien a
 * arbitrer : l'information retiree est deja dans le champ code postal.
 *
 * Strictement sans perte, et c'est verifie plutot que suppose — on n'enleve
 * l'arrondissement que si le code postal porte EXACTEMENT le meme numero.
 */
export function nettoyerVille(
  value: string,
  postalCode?: string,
): { value: string; applied: string[] } {
  const applied: string[] = []
  let ville = value.trim()
  const cp = (postalCode ?? '').trim()

  // 1. Code postal recopie entre parentheses. On exige la correspondance
  //    exacte : "(Sud)" ou "(Haute-Ville)" ne sont pas des doublons.
  if (cp) {
    const sansParenthese = ville.replace(new RegExp(`\\s*\\(\\s*${cp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)\\s*$`), '')
    if (sansParenthese !== ville && sansParenthese.trim().length >= 2) {
      ville = sansParenthese.trim()
      applied.push('drop_postal_code_in_city')
    }
  }

  // 1bis. Mention administrative entre parentheses : region, departement.
  //
  // CAS REEL (20/08) : "LIVET-ET-GAVET (RHÔNE-ALPES)" etait tronque en
  // "LIVET-ET-GAVET (RHÔNE", parenthese ouverte et jamais refermee. La region
  // n'apporte rien a l'acheminement — le code postal la porte deja — et la
  // couper au milieu produit une proposition qui a l'air cassee.
  //
  // Meme principe que la coupe a la virgule : on ne retire qu'un groupe
  // ENTIER, jamais un morceau.
  const sansMention = ville.replace(/\s*\([^()]*\)\s*$/, '').trim()
  if (sansMention !== ville && sansMention.length >= 3) {
    ville = sansMention
    applied.push('drop_parenthesised_mention_in_city')
  }

  // 2. Arrondissement deja porte par le code postal. Les deux derniers
  //    chiffres du code le designent : 13012 -> 12e, 75011 -> 11e.
  //
  //    On ne retire RIEN si les numeros different : ce serait alors une vraie
  //    perte d'information, pas un doublon.
  const arrondissement = ville.match(/^(.*?)[\s,]+(\d{1,2})\s*(?:e|er|eme|ème|ère)?\s*(?:arr\.?|arrondissement)$/i)
  if (arrondissement && cp.length === 5) {
    const numeroVille = Number(arrondissement[2])
    const numeroCode = Number(cp.slice(-2))
    const tete = arrondissement[1].trim()
    if (numeroVille === numeroCode && tete.length >= 2) {
      ville = tete
      applied.push('drop_arrondissement_in_city')
    }
  }

  return { value: ville, applied }
}

/**
 * Retire du libelle de voie ce que la commande porte deja dans ses champs
 * structures : code postal, ville en fin de chaine, et numero de voie recopie.
 * Strictement sans perte — on ne supprime qu'un doublon exact.
 */
export function stripRedundantLocality(
  value: string,
  context: { city?: string; postalCode?: string },
): { value: string; applied: string[] } {
  const applied: string[] = []
  let tokens = tokenize(value)

  // 1. Code postal recopie. Exige au moins 4 caracteres pour ne jamais
  //    confondre avec un numero de voie.
  const postal = (context.postalCode ?? '').trim()
  if (postal.length >= 4) {
    const target = normalizeLocality(postal)
    const kept = tokens.filter((token) => normalizeLocality(token) !== target)
    if (kept.length !== tokens.length && kept.length >= 2) {
      tokens = kept
      applied.push('drop_redundant_postal_code')
    }
  }

  // 2. Ville recopiee en FIN de libelle uniquement. Au milieu, le nom peut
  //    faire partie de la voie ("rue de Saint Cybard" a Mouleydier) : on ne
  //    touche pas.
  const city = (context.city ?? '').trim()
  if (city.length >= 3) {
    const target = normalizeLocality(city)
    for (let take = Math.min(5, tokens.length - 2); take >= 1; take--) {
      const tail = tokens.slice(tokens.length - take)
      if (normalizeLocality(tail.join(' ')) === target) {
        tokens = tokens.slice(0, tokens.length - take)
        applied.push('drop_redundant_city')
        break
      }
    }
  }

  // 3. Numero de voie recopie en fin ("515 route ... 515").
  if (tokens.length >= 3 && /^\d+$/.test(tokens[0]) && tokens[tokens.length - 1] === tokens[0]) {
    tokens = tokens.slice(0, -1)
    applied.push('drop_duplicated_house_number')
  }

  const rebuilt = tokens.join(' ').replace(/[\s,;-]+$/, '').trim()
  return { value: rebuilt || value, applied }
}

// Mots qui introduisent un complement d'adresse et non la voie elle-meme.
const COMPLEMENT_KEYWORDS =
  '(?:imm|immeuble|bat|bati?ment|b[aâ]t(?:iment)?|res|r[ée]sidence|appt?|appartement|esc|escalier|etg|[ée]tage|lieu-?dit|ld|entr[ée]e)'

/**
 * Isole un complement d'adresse reellement separable : parenthese finale,
 * segment apres tiret, ou mention de batiment en tete suivie de la voie.
 * Renvoie null quand rien n'est franchement separable — auquel cas mieux vaut
 * une revue humaine qu'une decoupe arbitraire au milieu d'un nom de voie.
 */
export function extractComplement(value: string): { address: string; complement: string } | null {
  const trimmed = value.trim()

  const parenthesis = trimmed.match(/^(.*\S)\s*\(([^()]{2,})\)\s*$/)
  if (parenthesis) return { address: parenthesis[1].trim(), complement: parenthesis[2].trim() }

  // L'espace est exige AVANT le tiret, facultatif apres : "Langevin -La
  // Maliniere" designe bien un lieu-dit, tandis que "Jean-Jacques" n'a pas
  // d'espace avant et reste donc intact. Releve le 24/08 sur la commande
  // #553215, ou la troncature laissait un "-La" orphelin.
  const dash = trimmed.match(/^(.*\S)\s+[-–]\s*(\S.{1,})$/)
  if (dash && tokenize(dash[1]).length >= 2) return { address: dash[1].trim(), complement: dash[2].trim() }

  // "IMM limbourg 69 rue Albert lamotte" -> complement en tete, voie ensuite.
  const leading = new RegExp(`^(${COMPLEMENT_KEYWORDS}\\b[^0-9]{0,25}?)\\s+(\\d.*)$`, 'i')
  const head = trimmed.match(leading)
  if (head && tokenize(head[2]).length >= 2) return { address: head[2].trim(), complement: head[1].trim() }

  // "245 bd de la Litorne .n°3 les Terres Marines" : un numero introduit par un
  // point ou un diese marque le debut d'un complement.
  const marqueur = trimmed.match(/^(.*\S)\s*[.,]\s*(n[°o]\s*\d.*)$/i)
  if (marqueur && tokenize(marqueur[1]).length >= 2) {
    return { address: marqueur[1].trim(), complement: marqueur[2].trim() }
  }

  // "Le grand monarque 23 rue jean giono" : un libelle sans chiffre suivi d'un
  // numero de voie. Le nom d'residence precede, la voie suit. On exige au
  // moins deux mots de chaque cote pour ne pas couper une voie ordinaire.
  const avantNumero = trimmed.match(/^([^\d]{6,}?)\s+(\d+\s+\S.*)$/)
  if (avantNumero) {
    const tete = avantNumero[1].trim()
    const voie = avantNumero[2].trim()
    // "rue", "avenue" etc. en tete signifient que le nombre appartient a la
    // voie elle-meme ("rue du 8 mai") : on ne coupe pas.
    if (!/\b(rue|avenue|av|bd|boulevard|chemin|ch|route|rte|all[ée]e|impasse|place)\b/i.test(tete)
        && tokenize(tete).length >= 2 && tokenize(voie).length >= 3) {
      return { address: voie, complement: tete }
    }
  }

  return null
}

/**
 * Separe un numero de voie qui contient en realite du texte d'adresse.
 *
 * CAS REEL, le plus frequent releve par l'exploitation sur une soiree :
 *
 *     nom de la rue    "Villa"
 *     numero de voie   "3 au college Pierre Gassendi"   -> refuse, max 20
 *
 * Le client a reparti son adresse entre les deux champs. Raccourcir le numero
 * perdrait "au college Pierre Gassendi", qui est une information de
 * localisation reelle. La bonne correction est de RENDRE A CHAQUE CHAMP CE QUI
 * LUI REVIENT : le numero garde "3", le reste devient un complement d'adresse.
 *
 * Renvoie null quand la separation n'est pas evidente — mieux vaut une revue
 * humaine qu'un decoupage arbitraire dans une adresse postale.
 */
export function splitHouseNumber(value: string): { houseNumber: string; complement: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // Le numero de voie francais : un nombre, eventuellement suivi d'un indice
  // (bis, ter, quater) ou d'une lettre isolee.
  const match = trimmed.match(/^(\d+\s*(?:bis|ter|quater|[A-Za-z])?)\s+(\S.*)$/i)
  if (!match) return null

  const numero = match[1].replace(/\s+/g, ' ').trim()
  const reste = match[2].trim()

  // Un reste d'un seul caractere n'est pas un complement d'adresse : c'est
  // probablement une coquille, et la deviner serait presomptueux.
  if (reste.length < 2) return null

  return { houseNumber: numero, complement: reste }
}

/**
 * Recupere un numero de voie manquant depuis le complement d'adresse.
 *
 * CAS REEL. Le client remplit les champs a l'envers :
 *
 *     nom de la rue         "Rez De Chaussé"
 *     numero de voie        vide          -> refuse, champ obligatoire
 *     complement d'adresse  "22 Rue Des Carrieres"
 *
 * Le numero existe, il est simplement dans la mauvaise case. L'exploitation
 * contourne en saisissant "0", ce qui debloque mais fabrique une donnee
 * fausse. Extraire le vrai numero vaut mieux : il est la, il suffit de le
 * lire.
 *
 * On ne TOUCHE PAS au complement : "22 Rue Des Carrieres" reste imprime sur
 * l'etiquette, et c'est ce qui permet au facteur de trouver. On ne fait
 * qu'ajouter l'information manquante dans son champ.
 */
export function recoverHouseNumber(
  houseNumber: string | undefined,
  address2: string | undefined,
): { houseNumber: string; source: 'address_2' } | null {
  if (houseNumber && houseNumber.trim() !== '') return null

  const complement = (address2 ?? '').trim()
  if (!complement) return null

  // Un numero de voie en tete, suivi d'un vrai libelle : sans le libelle on
  // ne saurait pas si le nombre est un numero ou autre chose (un etage, un
  // code, une quantite).
  const match = complement.match(/^(\d{1,5}\s*(?:bis|ter|quater|[A-Za-z])?)\s+\S/i)
  if (!match) return null

  return { houseNumber: match[1].replace(/\s+/g, ' ').trim(), source: 'address_2' }
}

/**
 * Recupere un numero de voie ecrit DANS le libelle de rue, a la belge.
 *
 * CAS REEL (#546576, 09/08, Belgique) : rue "rue dieffiere n°13", numero de
 * voie VIDE -> "Ce champ est obligatoire". Le numero est la, precede de son
 * marqueur.
 *
 * ON EXIGE LE MARQUEUR "n°". Un nombre en fin de libelle ne suffit pas : "rue
 * du 8 mai 1945" ou "avenue du 11 novembre" se terminent par un nombre qui
 * n'est pas un numero de voie. Le marqueur leve l'ambiguite, et sans lui on
 * prefere ne rien faire — se tromper de numero envoie le colis a une autre
 * porte.
 *
 * Ne se declenche QUE sur un refus constate. La mesure du 07/08 est formelle :
 * 100 commandes sur 100 ont un numero de voie vide sans que cela pose
 * probleme. Ce vide n'est donc pas une anomalie en soi.
 */
/**
 * Separe un numero colle a son type de voie.
 *
 * CAS REEL (#551528, 19/08) : numero de voie "376Avenue" pour une limite de 8,
 * et rue "Du Lieutenant Giffault". La vraie adresse est "376 Avenue Du
 * Lieutenant Giffault" : le type de voie appartient au DEBUT du libelle de rue,
 * pas au complement.
 *
 * ON EXIGE UN TYPE DE VOIE RECONNU. Sans cela, "12B" serait coupe en "12" + "B"
 * alors que le B fait partie du numero — et le colis irait a la mauvaise porte.
 * C'est la meme prudence que pour le numero precede de "n°".
 */
const TYPES_DE_VOIE = [
  'avenue', 'rue', 'boulevard', 'chemin', 'route', 'allee', 'allée', 'impasse',
  'place', 'square', 'quai', 'cours', 'passage', 'sentier', 'villa', 'faubourg',
]

export function separerTypeDeVoieColle(
  houseNumber: string | undefined,
  street: string | undefined,
): { houseNumber: string; address: string } | null {
  const numero = (houseNumber ?? '').trim()
  const libelle = (street ?? '').trim()
  if (!numero || !libelle) return null

  const decoupe = numero.match(/^(\d{1,5})\s*([A-Za-zÀ-ÿ]+)\s*$/)
  if (!decoupe) return null

  const type = decoupe[2]
  const normalise = type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!TYPES_DE_VOIE.some((connu) => connu.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalise)) {
    return null
  }

  return { houseNumber: decoupe[1], address: `${type} ${libelle}`.replace(/\s+/g, ' ').trim() }
}

export function recoverHouseNumberFromStreet(
  houseNumber: string | undefined,
  street: string | undefined,
): { houseNumber: string; street: string } | null {
  if (houseNumber && houseNumber.trim() !== '') return null

  const libelle = (street ?? '').trim()
  if (!libelle) return null

  const match = libelle.match(/^(.*?)[\s,]*\bn(?:o|°|º)\s*\.?\s*(\d{1,5}\s*(?:bis|ter|quater|[A-Za-z])?)\s*$/i)
  if (!match) return null

  const reste = match[1].trim().replace(/[\s,]+$/, '')
  // Sans libelle de rue restant, on n'aurait plus d'adresse du tout.
  if (reste.length < 3) return null

  return { houseNumber: match[2].replace(/\s+/g, ' ').trim(), street: reste }
}

/**
 * Retire du nom l'entreprise que la commande porte DEJA dans son champ.
 *
 * CAS REELS, lus le 10/08 sur les commandes que le moteur n'arrivait pas a
 * traiter :
 *
 *   nom "Port de Gustavia Bateau Elios Angel Deborah"  (43)
 *   entreprise "Port de Gustavia Bateau"               -> nom "Elios Angel Deborah"
 *
 *   nom "Confiance obseques Chevalier Karine"          (35)
 *   entreprise "Confiance obseques"                    -> nom "Chevalier Karine"
 *
 * C'est le motif DOMINANT, et non celui de la capture #546632 : le champ
 * entreprise est deja rempli, et son contenu est recopie en tete du nom.
 *
 * Strictement sans perte : on ne supprime qu'un doublon exact de ce qui est
 * deja imprime par ailleurs. Meme principe que pour le libelle de voie, ou
 * l'on retire le code postal et la ville deja portes par leurs champs.
 */
export function retirerEntrepriseDupliquee(
  nom: string | undefined,
  entreprise: string | undefined,
): { name: string } | null {
  const complet = (nom ?? '').trim()
  const societe = (entreprise ?? '').trim()
  if (!complet || !societe) return null

  const cle = (valeur: string) => valeur
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()

  const nomCle = cle(complet)
  const societeCle = cle(societe)
  if (!nomCle.startsWith(societeCle)) return null

  // On coupe sur la chaine d'origine, a la longueur du doublon normalise.
  // Les deux cles partagent le meme nombre de caracteres visibles ici, les
  // accents etant conserves par NFD sous forme de marques combinantes.
  let reste = complet.normalize('NFD').slice(societe.normalize('NFD').length)
  reste = reste.normalize('NFC').replace(/^[\s,;:-]+/, '').trim()

  // Sans reste exploitable, le nom EST l'entreprise : le vider laisserait le
  // colis sans destinataire nomme.
  if (reste.length < 3) return null

  return { name: reste }
}

/**
 * Retire d'un code postal le prefixe pays que la commande porte deja.
 *
 * CAS REEL (#550601, 17/08) : code postal "L7333" au Luxembourg, refuse avec
 * "Enter a valid zip code." Les codes luxembourgeois font quatre chiffres ; le
 * "L" est la convention d'ecriture du pays (L-7333), pas une partie du code.
 *
 * Sans perte : le pays est deja dans son propre champ. On n'agit QUE si le
 * prefixe correspond au pays declare — retirer un "B" devant un code allemand
 * changerait la destination.
 */
const PREFIXES_PAYS: Record<string, { lettre: string; chiffres: number }> = {
  LU: { lettre: 'L', chiffres: 4 },
  BE: { lettre: 'B', chiffres: 4 },
  DE: { lettre: 'D', chiffres: 5 },
  FR: { lettre: 'F', chiffres: 5 },
  CH: { lettre: 'CH', chiffres: 4 },
  AT: { lettre: 'A', chiffres: 4 },
}

export function nettoyerCodePostal(
  codePostal: string | undefined,
  paysCode: string | undefined,
): { postal_code: string } | null {
  const brut = (codePostal ?? '').trim()
  const pays = (paysCode ?? '').trim().toUpperCase()
  if (!brut || !pays) return null

  const attendu = PREFIXES_PAYS[pays]
  if (!attendu) return null

  // Le prefixe peut etre colle ("L7333") ou separe ("L-7333", "L 7333").
  const motif = new RegExp(`^${attendu.lettre}[\\s-]?(\\d{${attendu.chiffres}})$`, 'i')
  const trouve = brut.match(motif)
  if (!trouve) return null

  return { postal_code: trouve[1] }
}

/**
 * Deplace une mention "chez" du nom vers le complement d'adresse.
 *
 * CAS REEL (#550968, 18/08) : "Florence Houbin chez Marie Noëlle HOUBIN",
 * 40 caracteres pour une limite de 32. Le moteur tronquait en plein milieu et
 * produisait "Florence Houbin chez Marie", ce qui ne designe plus personne.
 *
 * La norme postale francaise prevoit exactement ce cas : le destinataire va sur
 * la ligne 1, et le point de remise ("chez M. X", "service de...") sur la
 * ligne 2, celle du complement. On ne fait donc que remettre l'information a sa
 * place — elle reste imprimee, rien n'est perdu.
 *
 * On exige une personne AVANT le "chez" : un commerce nomme "Chez Marcel" n'a
 * rien a deplacer.
 */
export function extraireMentionChez(
  nom: string | undefined,
  complementExistant: string | undefined,
  limiteNom: number,
  limiteComplement = 30,
): { name: string; address_2: string } | null {
  const complet = (nom ?? '').trim()
  if (!complet || complet.length <= limiteNom) return null

  const trouve = complet.match(/^(.{3,}?)\s+(chez\s+.{2,})$/i)
  if (!trouve) return null

  const personne = trouve[1].trim().replace(/[,;-]+$/, '').trim()
  const mention = trouve[2].trim()
  if (personne.length < 3 || personne.length > limiteNom) return null

  // Complement libre : la mention y va telle quelle. Sinon on ajoute a la
  // suite, tant que le tout tient dans la limite du champ.
  const actuel = (complementExistant ?? '').trim()
  const destination = actuel === '' ? mention : `${actuel} ${mention}`
  if (destination.length > limiteComplement) return null

  return { name: personne, address_2: destination }
}

/**
 * Marqueurs d'organisation, choisis pour ne jamais etre un patronyme.
 *
 * "Martin", "Leclerc" ou "Bernard" sont des noms de famille courants ET des
 * enseignes : ils n'ont donc rien a faire ici. Ceux retenus ci-dessous ne se
 * portent pas comme nom de personne en France.
 */
const MARQUEURS_ORGANISATION = [
  'croix-rouge', 'croix rouge', 'secours populaire', 'secours catholique',
  'association', 'assoc.', 'fondation', 'federation', 'amicale',
  'sarl', 'sasu', 'sas', 'eurl', 'sci', 'scop', 'scic', 'gaec', 'earl',
  'mairie', 'ccas', 'prefecture', 'communaute de communes',
  'hopital', 'clinique', 'ehpad', 'maison de retraite', 'residence',
  'foyer', 'centre hospitalier', 'cabinet', 'pharmacie', 'laboratoire',
  'ecole', 'college', 'lycee', 'universite', 'institut', 'ime', 'esat', 'mas',
  'etablissement', 'entreprise individuelle', 'societe',
  'restaurant', 'boulangerie', 'camping', 'hotel',
]

/**
 * Bascule une organisation collee au nom vers le champ entreprise.
 *
 * CAS REEL (#546632, capture du 09/08) : "Christine HEGY Croix-Rouge
 * Française" fait 36 caracteres, la limite est 32, et le champ entreprise
 * juste a cote est VIDE. Refus : "Ensure that name has at most 32 characters".
 *
 * L'exploitation corrige exactement ainsi — confirme par Quentin le 10/08 :
 * « tu peux basculer la dessus car c'est ce que je fais actuellement ».
 * Rien n'est perdu : l'information change de champ, elle reste imprimee.
 *
 * ON N'AGIT QUE SUR MARQUEUR RECONNU. Sans marqueur, impossible de savoir ou
 * finit la personne et ou commence la structure, et se tromper couperait le
 * nom du destinataire — celui qui sert a retirer le colis au point relais. On
 * rend alors la main plutot que de deviner.
 */
export function extraireOrganisation(
  nom: string | undefined,
  entrepriseExistante: string | undefined,
  limiteNom: number,
  limiteEntreprise = 50,
): { name: string; company_name: string } | null {
  const complet = (nom ?? '').trim()
  if (!complet || complet.length <= limiteNom) return null

  // Jamais ecraser une entreprise deja renseignee.
  if ((entrepriseExistante ?? '').trim() !== '') return null

  // 1. Separateur explicite " - ", entoure d'espaces.
  //
  // CAS REEL (#550791, 17/08) : "AGNÈS BALLEREAU - CAPSTAN AVOCATS", 33
  // caracteres pour une limite de 32. La liste de marqueurs ne connaissait pas
  // "AVOCATS", et une liste de metiers ne sera jamais close.
  //
  // Le separateur, lui, est un signal generique et sans ambiguite : un nom
  // compose francais s'ecrit SANS espaces autour du trait d'union
  // ("Dupont-Durand"). Des espaces des deux cotes marquent donc une separation
  // voulue par celui qui a saisi, pas un patronyme.
  const separateur = complet.match(/^(.{2,}?)\s+[-–—]\s+(.{2,})$/)
  if (separateur) {
    const personne = separateur[1].trim()
    const organisation = separateur[2].trim()
    if (personne.length <= limiteNom && organisation.length <= limiteEntreprise) {
      return { name: personne, company_name: organisation }
    }
  }

  const normalise = complet
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()

  let debut = -1
  for (const marqueur of MARQUEURS_ORGANISATION) {
    const position = normalise.indexOf(marqueur)
    // Position 0 : le nom EST l'organisation, il n'y a pas de personne a
    // separer. On ne touche pas.
    if (position > 0 && (debut === -1 || position < debut)) debut = position
  }
  if (debut <= 0) return null

  const personne = complet.slice(0, debut).trim().replace(/[,;-]+$/, '').trim()
  const organisation = complet.slice(debut).trim()

  // Deux parties reellement exploitables, sinon on n'a rien separe d'utile.
  if (personne.length < 3 || organisation.length < 3) return null
  // Si la personne seule depasse encore, la bascule ne resout pas le refus.
  if (personne.length > limiteNom) return null
  // Et l'organisation doit tenir dans son propre champ.
  if (organisation.length > limiteEntreprise) return null

  return { name: personne, company_name: organisation }
}

export interface AddressContextResult extends ShortenResult {
  /** Renseigne quand un complement a ete deplace vers un `address_2` vide. */
  address2?: string
}

/**
 * Enchaine les strategies de la moins destructrice a la plus destructrice :
 * doublons deja portes par d'autres champs, puis deplacement d'un complement
 * vers un `address_2` vide, puis abreviation, et seulement en dernier la coupe.
 * On ne deplace JAMAIS vers un `address_2` deja rempli : ecraser une precision
 * saisie par le destinataire serait une perte, pas un raccourcissement.
 */
/** Abreviations courantes en plus des types de voie deja listes. */
const TYPES_DE_VOIE_ABREGES = ['av', 'bd', 'rte', 'imp', 'pl', 'che', 'ch']

/** Le libelle designe-t-il une voie : un numero en tete ET un type de voie ? */
function ressembleAUneVoie(value: string): boolean {
  const texte = normalizeLocality(value)
  if (!/^\s*\d/.test(value.trim())) return false
  const mots = tokenize(value).map((mot) => normalizeLocality(mot))
  return mots.some((mot) =>
    TYPES_DE_VOIE.includes(mot) || TYPES_DE_VOIE_ABREGES.includes(mot),
  ) && texte.length > 0
}

/** Le libelle porte-t-il un type de voie, meme sans numero en tete ? */
function porteUnTypeDeVoie(value: string): boolean {
  const mots = tokenize(value).map((mot) => normalizeLocality(mot))
  return mots.some((mot) =>
    TYPES_DE_VOIE.includes(mot) || TYPES_DE_VOIE_ABREGES.includes(mot),
  )
}

/**
 * Redresse deux lignes d'adresse interverties.
 *
 * La forme la plus frequente relevee en production : le batiment ou
 * l'appartement occupe le champ VOIE, et la vraie voie dort dans le
 * complement.
 *
 *     voie       : "Appartement 2eme Etage Porte 21"
 *     complement : "24 Rue Jean Mermoz"
 *
 * 346 cas sur 90 jours, dont 13 depassent la limite et bloquent.
 *
 * Sans redressement, le moteur raccourcit la VOIE — donc il abime le
 * batiment ET laisse la vraie voie en seconde ligne. Apres redressement, la
 * voie est intacte en premiere ligne et la troncature, s'il en faut une,
 * tombe sur le batiment.
 *
 * Le redressement lui-meme ne perd RIEN : les deux valeurs echangent de
 * place. Ce qui se decide, c'est OU tombera la perte ensuite — et Quentin a
 * tranche le 25/08 : plutot sur le batiment que sur la voie.
 *
 * LA CONDITION EST VOLONTAIREMENT STRICTE. On exige que la seconde ligne soit
 * SANS AMBIGUITE une voie (numero en tete ET type de voie) et que la premiere
 * n'en soit pas une. Deux lignes qui ressemblent toutes deux a une voie ne
 * sont jamais echangees : on ne saurait pas laquelle est la bonne.
 */
export function redresserLignesInversees(
  address: string | undefined,
  address2: string | undefined,
): { address: string; address_2: string } | null {
  const voie = (address ?? '').trim()
  const complement = (address2 ?? '').trim()
  if (!voie || !complement) return null

  // La seconde ligne doit etre une voie evidente...
  if (!ressembleAUneVoie(complement)) return null
  // ...et la premiere ne doit pas pouvoir l'etre.
  if (ressembleAUneVoie(voie) || porteUnTypeDeVoie(voie)) return null

  return { address: complement, address_2: voie }
}

export function shortenAddressWithContext(
  value: string,
  limit: number,
  context: { city?: string; postalCode?: string; address2?: string },
): AddressContextResult {
  if (!Number.isFinite(limit) || limit < 1) return { value, lossy: false, applied: [] }
  if (value.length <= limit) return { value, lossy: false, applied: [] }

  const applied: string[] = []
  let current = value

  // La repetition litterale en premier : c'est la seule reparation dont
  // l'absence de perte se demontre, et il arrive qu'elle suffise a elle seule.
  const sansDoublon = retirerRepetitionFinale(current)
  if (sansDoublon.value !== current) {
    current = sansDoublon.value
    applied.push(...sansDoublon.applied)
    if (current.length <= limit) return { value: current, lossy: false, applied }
  }

  // La queue administrative ensuite : elle enleve souvent assez pour que rien
  // d'autre ne soit necessaire.
  const sansQueue = stripAdministrativeTail(current)
  if (sansQueue.value !== current) {
    current = sansQueue.value
    applied.push(...sansQueue.applied)
    if (current.length <= limit) return { value: current, lossy: false, applied }
  }

  const stripped = stripRedundantLocality(current, context)
  if (stripped.value !== current) {
    current = stripped.value
    applied.push(...stripped.applied)
    if (current.length <= limit) return { value: current, lossy: false, applied }
  }

  const address2Free = !context.address2 || context.address2.trim() === ''
  if (address2Free) {
    const split = extractComplement(current)
    // Le complement doit lui-meme tenir dans la limite, sinon on ne fait que
    // deplacer le refus d'un champ a l'autre.
    if (split && split.address.length <= limit && split.complement.length <= limit) {
      applied.push('move_complement_to_address_2')
      return { value: split.address, lossy: false, applied, address2: split.complement }
    }
  }

  const fallback = shortenAddressField(current, limit)
  return { value: fallback.value, lossy: fallback.lossy, applied: [...applied, ...fallback.applied] }
}

export interface AddressLimit {
  field: string
  max: number
}

export interface AddressAuditEntry {
  field: AddressField
  before_length: number
  after_length: number
  limit: number
  applied: string[]
  lossy: boolean
}

export interface AddressShorteningPlan {
  /** true seulement si TOUT le patch est applicable sans perte d'information. */
  ready: boolean
  patch: Partial<Record<AddressField, string>>
  lossyFields: AddressField[]
  audit: AddressAuditEntry[]
  reason: 'ok' | 'nothing_to_shorten' | 'no_repair_available' | 'lossy_shortening_requires_review'
}

function isAddressField(field: string): field is AddressField {
  return (ADDRESS_FIELDS as readonly string[]).includes(field)
}

// Sendcloud emploie plusieurs noms pour un meme champ selon le message, le
// transporteur et le niveau d'imbrication. Observe en production sur une seule
// journee : `address_1` pour la voie que la commande appelle `address`, et
// `address_2`, `address_add2` puis `uncategorized.address_add2` pour la
// deuxieme ligne.
//
// Sans ces equivalences, la limite signalee ne trouve AUCUNE valeur a
// raccourcir : le plan sort vide et rien ne signale l'anomalie. C'est
// exactement ce qui s'est produit sur une commande reelle, ou un depassement
// de sept caracteres n'a produit aucun changement.
const FIELD_ALIASES: Record<string, AddressField> = {
  address_1: 'address',
  address1: 'address',
  street: 'address',
  address_add1: 'address',
  address_2: 'address_2',
  address2: 'address_2',
  address_add2: 'address_2',
  house_nr: 'house_number',
  housenumber: 'house_number',
  zip: 'postal_code',
  zipcode: 'postal_code',
  postcode: 'postal_code',
}

export function canonicalAddressField(field: string): AddressField | null {
  // Les messages imbriques prefixent le champ par sa categorie
  // ("uncategorized.address_add2") : seul le dernier segment nous interesse.
  const normalized = field.trim().toLowerCase().split('.').pop() ?? ''
  const alias = FIELD_ALIASES[normalized]
  if (alias) return alias
  return isAddressField(normalized) ? normalized : null
}

function canonicalField(field: string): AddressField | null {
  return canonicalAddressField(field)
}

/**
 * Ce que Sendcloud mesure REELLEMENT pour un champ donne.
 *
 * L'API v3 ne renvoie pas toujours l'adresse decoupee comme l'interface
 * l'affiche. Sur la commande #553869, l'ecran montrait deux champs :
 *
 *     Nom de la rue     : "de la blanchonne"
 *     Numero de la voie : "401chemin"          <- refuse, 9 caracteres
 *
 * ...alors que l'API renvoyait tout dans un seul champ :
 *
 *     address_line_1 : "401chemin de la blanchonne"
 *     house_number   : null
 *
 * Sendcloud decoupe la ligne combinee au PREMIER ESPACE pour en tirer le
 * numero. Le moteur, lui, regardait un champ vide, concluait qu'il n'y avait
 * rien a raccourcir, et refermait la tache comme resolue — alors que l'erreur
 * restait affichee a l'ecran.
 *
 * On mesure donc la ou Sendcloud mesure.
 */
function valeurMesuree(field: AddressField, raw: Record<string, unknown>): string {
  const brut = typeof raw[field] === 'string' ? (raw[field] as string) : ''
  if (field === 'house_number' && brut.trim() === '') {
    const rue = typeof raw.address === 'string' ? raw.address : ''
    return tokenize(rue)[0] ?? ''
  }
  return brut
}

export function planAddressShortening(
  rawEntrant: Record<string, unknown>,
  limits: AddressLimit[],
): AddressShorteningPlan {
  // Copie de travail : certaines reparations corrigent un champ AVANT que les
  // suivantes ne le lisent, et l'objet de l'appelant ne doit pas bouger.
  const raw: Record<string, unknown> = { ...rawEntrant }
  // Un meme champ peut etre signale plusieurs fois : on retient la contrainte
  // la plus stricte, sinon on produirait une valeur encore refusee.
  const strictest = new Map<AddressField, number>()
  for (const limit of limits) {
    const field = canonicalField(limit.field)
    if (!field) continue
    if (!Number.isFinite(limit.max) || limit.max < 1) continue
    const previous = strictest.get(field)
    strictest.set(field, previous === undefined ? limit.max : Math.min(previous, limit.max))
  }

  const patch: Partial<Record<AddressField, string>> = {}
  const lossyFields: AddressField[] = []
  const audit: AddressAuditEntry[] = []

  const asText = (key: string): string | undefined =>
    typeof raw[key] === 'string' ? (raw[key] as string) : undefined

  // Opportunite : si le numero manque et qu'il dort dans le complement, on le
  // remet a sa place. On ne cree PAS d'alerte pour ce seul motif — trois mille
  // commandes ont un numero vide sans que cela pose probleme — mais quand on
  // traite deja la commande, autant supprimer un refus a venir.
  // Prefixe pays sur le code postal : correction opportuniste, sans perte, et
  // independante de toute limite de longueur — le refus porte sur la validite
  // du code, pas sur sa taille.
  const codePropre = nettoyerCodePostal(asText('postal_code'), asText('country_code'))
  if (codePropre) {
    patch.postal_code = codePropre.postal_code
    audit.push({
      field: 'postal_code',
      before_length: (asText('postal_code') ?? '').length,
      after_length: codePropre.postal_code.length,
      limit: 0,
      applied: ['drop_country_prefix_in_postal_code'],
      lossy: false,
    })
  }

  // Deux lignes interverties : le batiment dans le champ voie, la vraie voie
  // dans le complement. On redresse AVANT tout raccourcissement, sinon la
  // coupe porte sur la voie reelle restee en seconde ligne — le moteur abimait
  // le batiment ET laissait l'adresse mal formee.
  //
  // L'echange lui-meme ne perd rien. Ce qui se decide, c'est ou tombera la
  // perte ensuite, et Quentin a tranche le 25/08 : plutot sur le batiment que
  // sur la voie, parce que c'est la voie qui fait arriver le colis.
  const voieAvantRedressement = asText('address') ?? ''
  const redresse = redresserLignesInversees(asText('address'), asText('address_2'))
  if (redresse) {
    patch.address = redresse.address
    patch.address_2 = redresse.address_2
    raw.address = redresse.address
    raw.address_2 = redresse.address_2
    audit.push({
      field: 'address',
      // Mesure prise AVANT l'echange : la relire ensuite renverrait la
      // nouvelle valeur et l'audit dirait n'importe quoi.
      before_length: voieAvantRedressement.length,
      after_length: redresse.address.length,
      limit: 0,
      applied: ['swap_address_lines'],
      lossy: false,
    })
  }

  const recupere = recoverHouseNumber(asText('house_number'), asText('address_2'))
  if (recupere) {
    patch.house_number = recupere.houseNumber
    audit.push({
      field: 'house_number',
      before_length: 0,
      after_length: recupere.houseNumber.length,
      limit: 0,
      applied: ['recover_house_number_from_address_2'],
      lossy: false,
    })
  }

  // Meme idee, mais le numero dort dans le libelle de rue : "rue dieffiere
  // n°13". On ne le fait QUE si le refus porte sur le numero de voie — le
  // champ est vide sur la quasi-totalite des commandes sans que cela gene.
  const numeroExige = limits.some((limit) => canonicalField(limit.field) === 'house_number')
  if (!patch.house_number && numeroExige) {
    const extrait = recoverHouseNumberFromStreet(asText('house_number'), asText('address'))
    if (extrait) {
      patch.house_number = extrait.houseNumber
      patch.address = extrait.street
      audit.push({
        field: 'house_number',
        before_length: 0,
        after_length: extrait.houseNumber.length,
        limit: 0,
        applied: ['recover_house_number_from_street'],
        lossy: false,
      })
    }
  }

  // Le nom se traite avant tout raccourcissement : basculer l'organisation
  // dans son champ resout le depassement SANS RIEN PERDRE, la ou tronquer le
  // nom du destinataire lui ferait perdre celui qui sert a retirer le colis.
  const limiteNom = strictest.get('name')
  if (limiteNom !== undefined) {
    // 0. Mention "chez" : elle appartient a la ligne complement, pas a la
    //    ligne destinataire. C'est la norme postale, et c'est sans perte.
    const chez = extraireMentionChez(
      asText('name'), asText('address_2'), limiteNom, strictest.get('address_2') ?? 30,
    )
    if (chez) {
      patch.name = chez.name
      patch.address_2 = chez.address_2
      audit.push({
        field: 'name',
        before_length: (asText('name') ?? '').length,
        after_length: chez.name.length,
        limit: limiteNom,
        applied: ['move_care_of_to_address_2'],
        lossy: false,
      })
      strictest.delete('name')
    }

    // 1. Doublon exact de l'entreprise en tete du nom : motif le plus frequent,
    //    et le seul totalement sans perte puisque l'information reste imprimee
    //    par son propre champ.
    const degroupe = retirerEntrepriseDupliquee(asText('name'), asText('company_name'))
    if (degroupe && degroupe.name.length <= limiteNom) {
      patch.name = degroupe.name
      audit.push({
        field: 'name',
        before_length: (asText('name') ?? '').length,
        after_length: degroupe.name.length,
        limit: limiteNom,
        applied: ['drop_duplicated_company_in_name'],
        lossy: false,
      })
      strictest.delete('name')
    }

    // 2. Sinon, organisation collee au nom avec un champ entreprise VIDE.
    const separe = strictest.has('name')
      ? extraireOrganisation(asText('name'), asText('company_name'), limiteNom)
      : null
    if (separe) {
      patch.name = separe.name
      patch.company_name = separe.company_name
      audit.push({
        field: 'name',
        before_length: (asText('name') ?? '').length,
        after_length: separe.name.length,
        limit: limiteNom,
        applied: ['move_organisation_to_company'],
        lossy: false,
      })
      strictest.delete('name')
    }
  }

  // Le numero de voie se traite AVANT le reste : quand il contient du texte
  // d'adresse, le rendre a sa place peut suffire a resoudre le depassement de
  // la voie elle-meme, et il n'y a alors plus rien a raccourcir.
  const limiteNumero = strictest.get('house_number')
  // Quand le champ est vide, le numero refuse se trouve en tete du libelle de
  // rue : c'est la que Sendcloud le lit.
  const numeroBrut = valeurMesuree('house_number', raw)
  const numeroDansLaRue = (asText('house_number') ?? '').trim() === '' && numeroBrut !== ''
  if (limiteNumero !== undefined && numeroBrut && numeroBrut.length > limiteNumero) {
    // Type de voie colle au numero : il appartient au DEBUT du libelle de rue,
    // pas au complement. Traite en premier, c'est le seul cas sans perte.
    // Si le numero dort en tete de la rue, on passe a la fonction de
    // decoupage le RESTE du libelle : sinon le jeton serait recopie deux fois.
    const resteDeLaRue = numeroDansLaRue
      ? tokenize(asText('address') ?? '').slice(1).join(' ')
      : (asText('address') ?? '')
    const colle = separerTypeDeVoieColle(numeroBrut, resteDeLaRue)
    if (colle && colle.houseNumber.length <= limiteNumero) {
      patch.house_number = colle.houseNumber
      patch.address = colle.address
      audit.push({
        field: 'house_number',
        before_length: numeroBrut.length,
        after_length: colle.houseNumber.length,
        limit: limiteNumero,
        applied: ['split_glued_street_type'],
        lossy: false,
      })
      strictest.delete('house_number')
    }

    const separe = colle ? null : splitHouseNumber(numeroBrut)
    const complementActuel = (asText('address_2') ?? '').trim()
    const complementLibre = complementActuel === ''

    // Complement deja occupe : on peut quand meme y AJOUTER, tant que le tout
    // tient dans la limite du champ. Rien n'est perdu, les deux informations
    // restent imprimees.
    //
    // Cas reel (#547802, 10/08) : numero de voie "13 All Albeniz" refuse a 8
    // caracteres, complement occupe par "BT G1". Le moteur renoncait, alors
    // que "BT G1 All Albeniz" tient largement.
    const limiteComplement = strictest.get('address_2') ?? 30
    const complementFusionne = separe && !complementLibre
      ? `${complementActuel} ${separe.complement}`.trim()
      : null
    const fusionPossible = complementFusionne !== null
      && complementFusionne.length <= limiteComplement

    if (separe && separe.houseNumber.length <= limiteNumero && (complementLibre || fusionPossible)) {
      patch.house_number = separe.houseNumber
      patch.address_2 = complementLibre ? separe.complement : complementFusionne!
      audit.push({
        field: 'house_number',
        before_length: numeroBrut.length,
        after_length: separe.houseNumber.length,
        limit: limiteNumero,
        applied: [complementLibre
          ? 'split_house_number_to_address_2'
          : 'split_house_number_appended_to_address_2'],
        lossy: false,
      })
    } else if (!colle) {
      // Pas de separation evidente, ou complement deja occupe : on ne tronque
      // PAS un numero de voie. Couper "3 au college" en "3 au colleg" ne
      // produirait rien d'utilisable, et perdrait une localisation reelle.
      audit.push({
        field: 'house_number',
        before_length: numeroBrut.length,
        after_length: numeroBrut.length,
        limit: limiteNumero,
        applied: [],
        lossy: true,
      })
      lossyFields.push('house_number')
    }
    strictest.delete('house_number')
  }

  for (const [field, max] of strictest) {
    const value = raw[field]
    if (typeof value !== 'string') continue

    // Sendcloud mesure la voie « combinee au numero » : la limite porte sur les
    // deux. On reserve donc la place du numero plutot que de produire une
    // valeur qui serait refusee une seconde fois.
    const houseNumber = field === 'address' ? (asText('house_number') ?? '') : ''
    const budget = houseNumber ? max - (houseNumber.length + 1) : max
    if (budget < 1 || value.length <= budget) continue

    // La ville subit le meme traitement que la voie : "Marseille,
    // Bouches-du-Rhone, France" doit devenir "Marseille", pas etre tronque a
    // trente caracteres au milieu d'un mot.
    let queue = field === 'city' || field === 'address_2'
      ? stripAdministrativeTail(value)
      : { value, applied: [] as string[] }

    // La repetition litterale touche la ville autant que la voie : releve le
    // 24/08 sur "Marolles sous lignieres sous lignieres". Sans perte, donc
    // avant tout le reste.
    const doublon = retirerRepetitionFinale(queue.value)
    if (doublon.value !== queue.value) {
      queue = { value: doublon.value, applied: [...queue.applied, ...doublon.applied] }
    }

    // Puis les doublons propres a la ville : code postal entre parentheses,
    // arrondissement deja porte par le code. Sans perte, donc avant toute
    // troncature — c'est ce qui evite un arbitrage humain inutile.
    if (field === 'city') {
      const propre = nettoyerVille(queue.value, asText('postal_code'))
      if (propre.applied.length > 0) {
        queue = { value: propre.value, applied: [...queue.applied, ...propre.applied] }
      }
    }

    // Le complement porte souvent une adresse entiere recopiee, code postal
    // compris : "9 RUE DE L HOP ST JEAN DE DIEU 59520" alors que 59520 a deja
    // son propre champ. Le retirer est sans perte et suffit souvent a tenir
    // dans la limite — releve le 24/08 sur la commande #553270, ou le moteur
    // tronquait a "9 RUE DE L HOP ST JEAN" en perdant "DE DIEU".
    //
    // La voie beneficiait deja de ce nettoyage ; le complement, non. On ne
    // l'applique PAS a la ville : y retirer le nom de la ville la viderait.
    if (field === 'address_2') {
      const sansDoublons = stripRedundantLocality(queue.value, {
        city: asText('city'),
        postalCode: asText('postal_code'),
      })
      if (sansDoublons.applied.length > 0) {
        queue = { value: sansDoublons.value, applied: [...queue.applied, ...sansDoublons.applied] }
      }
    }

    const result =
      field === 'address'
        ? shortenAddressWithContext(value, budget, {
            city: asText('city'),
            postalCode: asText('postal_code'),
            address2: asText('address_2'),
          })
        : queue.value !== value && queue.value.length <= budget
          ? { value: queue.value, lossy: false, applied: queue.applied }
          : shortenAddressField(queue.value, budget)
    if (result.value === value) continue

    patch[field] = result.value
    if (result.lossy) lossyFields.push(field)
    audit.push({
      field,
      before_length: value.length,
      after_length: result.value.length,
      limit: budget,
      applied: result.applied,
      lossy: result.lossy,
    })

    // Seule la branche `address` peut produire un deplacement de complement.
    const moved = field === 'address' ? (result as AddressContextResult).address2 : undefined
    if (moved && patch.address_2 === undefined) patch.address_2 = moved
  }

  if (audit.length === 0) {
    // « Je ne trouve rien a raccourcir » N'EST PAS « c'est deja resolu ».
    //
    // La confusion des deux a referme a tort la tache de la commande #553869,
    // definitivement : la cle d'operation empeche d'en recreer une, et la
    // detection continuait de voir l'erreur a chaque synchro sans pouvoir agir.
    //
    // On regarde donc si les champs contraints respectent VRAIMENT leur limite.
    // S'ils la depassent encore, le moteur n'a pas repare : il a renonce, et il
    // doit le dire.
    const encoreTropLong = [...strictest.entries()].some(
      ([champ, max]) => valeurMesuree(champ, raw).length > max,
    )
    return encoreTropLong
      ? { ready: false, patch: {}, lossyFields: [], audit: [], reason: 'no_repair_available' }
      : { ready: false, patch: {}, lossyFields: [], audit: [], reason: 'nothing_to_shorten' }
  }

  // Le patch est calcule meme quand il est refuse : l'operateur doit pouvoir
  // voir ce qui serait applique avant de trancher.
  if (lossyFields.length > 0) {
    return { ready: false, patch, lossyFields, audit, reason: 'lossy_shortening_requires_review' }
  }

  return { ready: true, patch, lossyFields, audit, reason: 'ok' }
}
