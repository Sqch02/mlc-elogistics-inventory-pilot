import { describe, it, expect } from 'vitest'
import { planAddressShortening, stripRedundantLocality, extractComplement, stripAdministrativeTail, recoverHouseNumber } from './address'

// Motifs releves sur les commandes reellement refusees par Sendcloud (limite de
// 32 caracteres sur la voie combinee au numero). Les libelles sont reecrits :
// on conserve la FORME du defaut, jamais l'adresse d'un destinataire.
//
// Sur l'echantillon d'origine, 15 commandes sur 600 depassaient la limite ;
// l'abreviation seule n'en reglait que 6, les strategies contextuelles portent
// ce chiffre a 13. Les 2 restantes sont ici aussi, pour figer le fait qu'elles
// DOIVENT partir en revue humaine.

const LIMIT = 32

function planFor(raw: Record<string, unknown>) {
  return planAddressShortening(raw, [{ field: 'address_1', max: LIMIT }])
}

describe('strategies contextuelles sans perte', () => {
  it('retire le code postal recopie dans la voie', () => {
    const plan = planFor({
      address: '76 grande rue du Moulin Verlac 44410',
      postal_code: '44410',
      city: 'Verlac',
      address_2: '',
    })
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toBe('76 grande rue du Moulin')
    expect(plan.audit[0].applied).toContain('drop_redundant_postal_code')
    expect(plan.audit[0].lossy).toBe(false)
  })

  it('retire la ville recopiee en fin de voie malgre accents et Saint/St', () => {
    const plan = planFor({
      address: '106 B Rue de la Richelandiere 42100 St Etienne',
      postal_code: '42100',
      city: 'Saint-Étienne',
      address_2: '',
    })
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toBe('106 B Rue de la Richelandiere')
  })

  it('ne retire PAS la ville quand elle est au milieu de la voie', () => {
    // "rue de Saint Cybard" a Saint Cybard : le nom fait partie de la voie.
    const result = stripRedundantLocality('12 rue de Saint Cybard et des Vignes', {
      city: 'Saint Cybard',
      postalCode: '24520',
    })
    expect(result.value).toBe('12 rue de Saint Cybard et des Vignes')
    expect(result.applied).toEqual([])
  })

  it('retire le numero de voie recopie en fin', () => {
    const result = stripRedundantLocality('515 route la fontaine des oiseaux 515', {})
    expect(result.value).toBe('515 route la fontaine des oiseaux')
    expect(result.applied).toContain('drop_duplicated_house_number')
  })

  it('deplace un lieu-dit entre parentheses vers un address_2 vide', () => {
    const plan = planFor({
      address: '27 Rue du Soleil Levant (Landemare)',
      postal_code: '49270',
      city: 'Oree du Bois',
      address_2: '',
    })
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toBe('27 Rue du Soleil Levant')
    expect(plan.patch.address_2).toBe('Landemare')
    expect(plan.audit[0].lossy).toBe(false)
  })

  it('deplace un lieu-dit introduit par un tiret', () => {
    const plan = planFor({
      address: "6 rue de la borderie - l'Aubertais",
      postal_code: '17220',
      city: 'St Medard',
      address_2: '',
    })
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toBe('6 rue de la borderie')
    expect(plan.patch.address_2).toBe("l'Aubertais")
  })

  it("n'ecrase JAMAIS un address_2 deja renseigne", () => {
    // Meme motif que le precedent, mais le destinataire a saisi un complement :
    // le deplacer detruirait son information. La revue humaine est le bon choix.
    const plan = planFor({
      address: 'IMM limbourg 69 rue Albert lamotel',
      postal_code: '76370',
      city: 'Neuville',
      address_2: '5',
    })
    expect(plan.patch.address_2).toBeUndefined()
    expect(plan.ready).toBe(false)
    expect(plan.reason).toBe('lossy_shortening_requires_review')
  })

  it('isole un complement de tete quand address_2 est libre', () => {
    const split = extractComplement('IMM limbourg 69 rue Albert lamotel')
    expect(split).toEqual({ address: '69 rue Albert lamotel', complement: 'IMM limbourg' })
  })

  it('abrege les titres usuels de voie', () => {
    const plan = planFor({
      address: '10 rue Marechal delatour de Tassignac',
      postal_code: '59152',
      city: 'Cherenc',
      address_2: '',
    })
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toBe('10 rue Mal delatour de Tassignac')
  })

  it('laisse en revue humaine ce qui ne peut etre que coupe', () => {
    const plan = planFor({
      address: '43 RUE LE VOSGES LES JARDINS DE LOUIS',
      postal_code: '13110',
      city: 'Port de Bouc',
      address_2: '',
    })
    expect(plan.ready).toBe(false)
    expect(plan.reason).toBe('lossy_shortening_requires_review')
    // Le patch est tout de meme calcule, pour que l'operateur voie la proposition.
    expect(plan.patch.address).toBeDefined()
  })
})

describe('limite Sendcloud portant sur la voie combinee au numero', () => {
  it('reserve la place du numero de voie dans le budget', () => {
    // Sendcloud mesure address + house_number : 26 + 1 + 5 = 32, donc la voie
    // seule ne dispose que de 26 caracteres.
    const plan = planFor({
      address: 'bis Avenue du President Wilsonn',
      house_number: '27',
      postal_code: '76290',
      city: 'Montvilliers',
      address_2: '',
    })
    expect(plan.ready).toBe(true)
    expect((plan.patch.address ?? '').length + 1 + '27'.length).toBeLessThanOrEqual(LIMIT)
  })

  it.each([
    ['address_add2', 'la deuxieme ligne, nommee ainsi par certains transporteurs'],
    ['uncategorized.address_add2', 'la meme, imbriquee sous sa categorie'],
    ['address2', 'variante sans separateur'],
  ])('reconnait %s comme deuxieme ligne d adresse (%s)', (champ) => {
    // Observe en production : un depassement de sept caracteres n'avait produit
    // AUCUN changement, parce que la limite signalee sous ce nom ne trouvait
    // aucune valeur a raccourcir. Le plan sortait vide en silence.
    const plan = planAddressShortening(
      { address_2: 'Residence des Grands Chenes Batiment C', city: 'Poitiers', postal_code: '86000' },
      [{ field: champ, max: 30 }],
    )
    expect(plan.audit.length).toBeGreaterThan(0)
    expect(plan.audit[0].field).toBe('address_2')
  })

  it('reconnait le nom de champ address_1 employe par les messages Sendcloud', () => {
    const plan = planAddressShortening(
      { address: '454 Avenue des Collines de Tamaris', postal_code: '83500', city: 'La Seyne' },
      [{ field: 'address_1', max: LIMIT }],
    )
    expect(plan.patch.address).toBe('454 Av des Collines de Tamaris')
  })

})

describe('numero de voie contenant du texte d adresse', () => {
  const planNumero = (raw: Record<string, unknown>) =>
    planAddressShortening(raw, [{ field: 'house_number', max: 20 }])

  it('rend a chaque champ ce qui lui revient', () => {
    // Cas reel, le plus frequent releve sur une soiree : le client a reparti
    // son adresse entre le nom de rue et le numero de voie.
    const plan = planNumero({
      address: 'Villa',
      house_number: '3 au college Pierre Gassendi',
      address_2: '',
      city: 'Rocbaron',
      postal_code: '83136',
    })

    expect(plan.ready).toBe(true)
    expect(plan.patch.house_number).toBe('3')
    expect(plan.patch.address_2).toBe('au college Pierre Gassendi')
    expect(plan.audit[0].lossy).toBe(false)
  })

  it('reconnait un indice de voie', () => {
    const plan = planNumero({ address: 'rue Haute', house_number: '12 bis allee des Peupliers', address_2: '' })
    expect(plan.patch.house_number).toBe('12 bis')
    expect(plan.patch.address_2).toBe('allee des Peupliers')
  })

  it('n ecrase JAMAIS un complement deja renseigne', () => {
    // Le destinataire a saisi une precision : la remplacer serait detruire son
    // information pour en placer une autre.
    const plan = planNumero({
      address: 'Villa',
      house_number: '3 au college Pierre Gassendi',
      address_2: 'Batiment C',
    })
    expect(plan.ready).toBe(false)
    expect(plan.patch.address_2).toBeUndefined()
  })

  it('ne tronque PAS un numero qu on ne sait pas separer', () => {
    // Couper "au college Pierre Gassendi" a vingt caracteres ne produirait
    // rien d'utilisable, et perdrait une localisation reelle.
    const plan = planNumero({ address: 'Villa', house_number: 'au college Pierre Gassendi', address_2: '' })
    expect(plan.ready).toBe(false)
    expect(plan.patch.house_number).toBeUndefined()
  })

  it('laisse tranquille un numero normal', () => {
    const plan = planNumero({ address: 'rue des Lilas', house_number: '956', address_2: '' })
    expect(plan.reason).toBe('nothing_to_shorten')
  })
})

describe('queue administrative recopiee par la boutique', () => {
  it('retire departement et pays d une ville', () => {
    // Cas reel : la boutique recopie l'adresse formatee complete alors que
    // chaque element a deja son champ.
    const plan = planAddressShortening(
      { city: 'Marseille, Bouches-du-Rhône, France', postal_code: '13001' },
      [{ field: 'city', max: 30 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.patch.city).toBe('Marseille')
    expect(plan.audit[0].lossy).toBe(false)
  })

  it('retire ville et pays d un libelle de voie', () => {
    const plan = planAddressShortening(
      { address: '60 Rue de Bien Assis, Clermont-Ferrand, France', city: 'Clermont-Ferrand', address_2: '' },
      [{ field: 'address_1', max: 32 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toBe('60 Rue de Bien Assis')
  })

  it('ne coupe qu a une virgule, jamais au milieu d un segment', () => {
    const plan = planAddressShortening(
      { city: 'Saint-Remy-de-Provence-les-Alpilles' },
      [{ field: 'city', max: 30 }],
    )
    // Aucune virgule : on retombe sur les strategies classiques, et la coupe
    // exige une revue humaine.
    expect(plan.ready).toBe(false)
  })

  it('refuse un premier segment trop court pour etre une adresse', () => {
    const r = stripAdministrativeTail('A, Bouches-du-Rhone, France')
    expect(r.value).toBe('A, Bouches-du-Rhone, France')
    expect(r.applied).toEqual([])
  })
})

describe('adresses composites saisies dans un seul champ', () => {
  it('separe un complement introduit par un numero pointe', () => {
    const r = extractComplement('245 bd de la Litorne .n°3 les Terres Marines')
    expect(r).toEqual({ address: '245 bd de la Litorne', complement: 'n°3 les Terres Marines' })
  })

  it('separe un nom de residence place avant la voie', () => {
    const r = extractComplement('Le grand monarque 23 rue jean giono')
    expect(r).toEqual({ address: '23 rue jean giono', complement: 'Le grand monarque' })
  })

  it('NE COUPE PAS une voie dont le nom contient un nombre', () => {
    // "rue du 8 mai 1945" est une voie entiere : la couper avant le nombre
    // produirait "rue du" et enverrait le colis nulle part.
    expect(extractComplement('rue du 8 mai 1945')).toBeNull()
    expect(extractComplement('avenue des 4 chemins')).toBeNull()
  })

  it('abrege un type de voie colle au numero', () => {
    // "70chemins des vignes" : sans frontiere de mot entre le chiffre et la
    // lettre, l'abreviation classique ne s'appliquait pas.
    const plan = planAddressShortening(
      { address: '70chemins des vignes bouvard dessus', address_2: '', city: 'X' },
      [{ field: 'address_1', max: 32 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toContain('Ch')
    expect((plan.patch.address ?? '').length).toBeLessThanOrEqual(32)
  })
})

describe('numero de voie manquant', () => {
  it('recupere le numero endormi dans le complement', () => {
    // Cas reel : le client remplit les champs a l'envers.
    //   nom de la rue        "Rez De Chaussé"
    //   numero de voie       vide -> refuse
    //   complement           "22 Rue Des Carrieres"
    expect(recoverHouseNumber('', '22 Rue Des Carrieres')).toEqual({ houseNumber: '22', source: 'address_2' })
    expect(recoverHouseNumber(undefined, '12 bis allee des Peupliers')).toMatchObject({ houseNumber: '12 bis' })
  })

  it('ne touche a rien quand un numero existe deja', () => {
    expect(recoverHouseNumber('7', '22 Rue Des Carrieres')).toBeNull()
  })

  it('n invente pas un numero a partir d un complement ordinaire', () => {
    // Un etage, un batiment ou un code postal ne sont pas des numeros de voie.
    expect(recoverHouseNumber('', 'Batiment C')).toBeNull()
    expect(recoverHouseNumber('', '3eme etage')).toBeNull()
    expect(recoverHouseNumber('', '75014')).toBeNull()
    expect(recoverHouseNumber('', '')).toBeNull()
  })

  it('remet la voie en premiere ligne quand les deux champs sont intervertis', () => {
    // "22 Rue Des Carrieres" doit rester imprime sur l'etiquette : c'est lui
    // qui permet au facteur de trouver.
    //
    // ATTENDU MODIFIE LE 25/08. Ce test exigeait auparavant qu'on ne touche a
    // rien : le complement restait en seconde ligne et on se contentait d'en
    // extraire le numero. C'etait une protection, pas une correction — le
    // champ voie gardait "Rez De Chausse", qui ne mene nulle part.
    //
    // Le moteur redresse desormais les deux lignes. La voie remonte en
    // premiere ligne, l'etage passe en seconde, et RIEN n'est perdu : c'est
    // strictement mieux au regard de l'intention d'origine.
    const plan = planAddressShortening(
      { address: 'Rez De Chaussé', house_number: '', address_2: '22 Rue Des Carrieres', city: 'Luxembourg' },
      [{ field: 'address_1', max: 32 }],
    )
    expect(plan.patch.address).toBe('22 Rue Des Carrieres')
    expect(plan.patch.address_2).toBe('Rez De Chaussé')
    expect(plan.lossyFields).toEqual([])
  })
})
