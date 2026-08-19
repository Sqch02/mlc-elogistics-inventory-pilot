import { describe, expect, it } from 'vitest'
import { shortenAddressField, planAddressShortening, nettoyerVille, recoverHouseNumberFromStreet, extraireOrganisation, retirerEntrepriseDupliquee, nettoyerCodePostal, extraireMentionChez, separerTypeDeVoieColle } from './address'

describe('shortenAddressField', () => {
  it('abbreviates known tokens without losing meaning', () => {
    const result = shortenAddressField('Saint-Rémy-de-Provence', 20)
    expect(result.value).toBe('St-Rémy-de-Provence')
    expect(result.value.length).toBeLessThanOrEqual(20)
    expect(result.lossy).toBe(false)
    expect(result.applied).toContain('abbreviate')
  })

  it('abbreviates street types too', () => {
    const result = shortenAddressField('123 Boulevard des Peupliers', 20)
    expect(result.value).toBe('123 Bd des Peupliers')
    expect(result.lossy).toBe(false)
  })

  it('collapses redundant whitespace before anything else', () => {
    const result = shortenAddressField('12   rue   des   Lilas', 18)
    expect(result.value).toBe('12 rue des Lilas')
    expect(result.lossy).toBe(false)
    expect(result.applied).toContain('collapse_whitespace')
  })

  it('leaves a value that already fits completely untouched', () => {
    const result = shortenAddressField('Lyon', 26)
    expect(result.value).toBe('Lyon')
    expect(result.applied).toEqual([])
    expect(result.lossy).toBe(false)
  })

  it('marks a word-boundary cut as lossy', () => {
    // Aucune abreviation possible : on perd de l'information.
    const result = shortenAddressField('Chambretaud Les Grands Champs', 20)
    expect(result.value.length).toBeLessThanOrEqual(20)
    expect(result.lossy).toBe(true)
    expect(result.applied).toContain('word_boundary')
  })

  it('hard-truncates a single oversized word as a last resort, still lossy', () => {
    const result = shortenAddressField('Bourgneufenmauges'.repeat(2), 20)
    expect(result.value.length).toBe(20)
    expect(result.lossy).toBe(true)
    expect(result.applied).toContain('truncate')
  })

  it('never returns an empty value', () => {
    const result = shortenAddressField('Villeneuve', 3)
    expect(result.value.length).toBeGreaterThan(0)
  })

  it('is idempotent: re-shortening an already-shortened value changes nothing', () => {
    const once = shortenAddressField('Saint-Rémy-de-Provence', 20)
    const twice = shortenAddressField(once.value, 20)
    expect(twice.value).toBe(once.value)
  })

  it('refuses a limit that makes no sense instead of inventing a value', () => {
    expect(shortenAddressField('Lyon', 0).value).toBe('Lyon')
    expect(shortenAddressField('Lyon', -1).value).toBe('Lyon')
  })
})

describe('planAddressShortening', () => {
  const raw = {
    city: 'Saint-Rémy-de-Provence',
    address: '123 Boulevard des Peupliers',
  }

  it('produces a concrete patch for every field over its limit', () => {
    const plan = planAddressShortening(raw, [
      { field: 'city', max: 20 },
      { field: 'address', max: 20 },
    ])

    expect(plan.ready).toBe(true)
    expect(plan.patch).toEqual({
      city: 'St-Rémy-de-Provence',
      address: '123 Bd des Peupliers',
    })
    expect(plan.lossyFields).toEqual([])
  })

  it('refuses automatic application when a field can only be cut, not abbreviated', () => {
    // Garde-fou central : tronquer une ville peut changer la destination.
    // On ne l'applique jamais tout seul, on demande une revue humaine.
    const plan = planAddressShortening(
      { city: 'Chambretaud Les Grands Champs' },
      [{ field: 'city', max: 20 }],
    )

    expect(plan.ready).toBe(false)
    expect(plan.lossyFields).toEqual(['city'])
    expect(plan.reason).toBe('lossy_shortening_requires_review')
    // Le patch reste calcule, pour que l'humain voie ce qui serait applique.
    expect(plan.patch.city).toBeDefined()
  })

  it('ignores a field that is already within its limit', () => {
    const plan = planAddressShortening({ city: 'Lyon' }, [{ field: 'city', max: 26 }])
    expect(plan.ready).toBe(false)
    expect(plan.reason).toBe('nothing_to_shorten')
    expect(plan.patch).toEqual({})
  })

  it('ignores a limit pointing at a field that is not an address field', () => {
    const plan = planAddressShortening(raw, [{ field: 'contract', max: 10 }])
    expect(plan.ready).toBe(false)
    expect(plan.reason).toBe('nothing_to_shorten')
  })

  it('ignores a limit pointing at a field absent from the parcel', () => {
    const plan = planAddressShortening({ city: 'Lyon' }, [{ field: 'address_2', max: 5 }])
    expect(plan.patch).toEqual({})
    expect(plan.ready).toBe(false)
  })

  it('keeps the most restrictive limit when a field is reported twice', () => {
    const plan = planAddressShortening(
      { city: 'Saint-Rémy-de-Provence' },
      [{ field: 'city', max: 26 }, { field: 'city', max: 19 }],
    )
    expect(plan.patch.city!.length).toBeLessThanOrEqual(19)
  })

  it('reports the before/after audit for every changed field', () => {
    const plan = planAddressShortening(raw, [{ field: 'city', max: 20 }])
    expect(plan.audit).toEqual([
      {
        field: 'city',
        before_length: 22,
        after_length: 19,
        limit: 20,
        applied: ['abbreviate'],
        lossy: false,
      },
    ])
  })
})

describe('villes refusees par Mondial Relay (captures du 09/08)', () => {
  // Valeurs copiees telles quelles depuis les commandes que l'exploitation a
  // corrigees a la main. Mondial Relay limite la ville a 26 caracteres, la ou
  // Chronopost accepte 30 : c'est ce qui explique le volume Mondial Relay.

  it('retire le code postal recopie entre parentheses (#547015)', () => {
    // "Ensure that city has at most 26 characters (it has 30)."
    // Le code postal est deja dans son champ : le retirer ne perd rien.
    const r = nettoyerVille('Villeneuve-Les-Sablons (60175)', '60175')
    expect(r.value).toBe('Villeneuve-Les-Sablons')
    expect(r.value.length).toBeLessThanOrEqual(26)
    expect(r.applied).toContain('drop_postal_code_in_city')
  })

  it('retire l arrondissement porte par le code postal (#546574)', () => {
    // "Marseille 12ème arrondissement" avec 13012 : les deux derniers
    // chiffres du code designent deja le 12e.
    const r = nettoyerVille('Marseille 12ème arrondissement', '13012')
    expect(r.value).toBe('Marseille')
    expect(r.applied).toContain('drop_arrondissement_in_city')
  })

  it('NE retire PAS un arrondissement que le code postal ne confirme pas', () => {
    // La retenue est le coeur du sujet : si les numeros divergent, ce n'est
    // plus un doublon mais une vraie information, et la supprimer changerait
    // la destination.
    const r = nettoyerVille('Marseille 12ème arrondissement', '13000')
    expect(r.value).toBe('Marseille 12ème arrondissement')
    expect(r.applied).toEqual([])
  })

  it('NE retire PAS une parenthese qui n est pas le code postal', () => {
    const r = nettoyerVille('Saint-Denis (La Reunion)', '97400')
    expect(r.value).toBe('Saint-Denis (La Reunion)')
    expect(r.applied).toEqual([])
  })

  it('corrige la ville sans perte dans le plan complet', () => {
    // Le test qui compte vraiment : ces commandes ne doivent plus partir en
    // arbitrage humain.
    const plan = planAddressShortening(
      {
        address: "rue de l'argilière", house_number: '39',
        city: 'Villeneuve-Les-Sablons (60175)', postal_code: '60175',
      },
      [{ field: 'city', max: 26 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.city).toBe('Villeneuve-Les-Sablons')
  })

  it('corrige Marseille sans perte dans le plan complet', () => {
    const plan = planAddressShortening(
      {
        address: 'AVENUE WILLIAM BOOTH', house_number: '153',
        city: 'Marseille 12ème arrondissement', postal_code: '13012',
      },
      [{ field: 'city', max: 26 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.city).toBe('Marseille')
  })
})

describe('numero de voie ecrit dans la rue (capture #546576)', () => {
  it('recupere le numero precede de son marqueur', () => {
    // Belgique, "Ce champ est obligatoire" sur le numero de voie alors que
    // la rue vaut "rue dieffiere n°13".
    const r = recoverHouseNumberFromStreet('', 'rue dieffiere n°13')
    expect(r).toEqual({ houseNumber: '13', street: 'rue dieffiere' })
  })

  it('NE devine PAS un numero sans marqueur', () => {
    // "rue du 8 mai 1945" se termine par un nombre qui n'est pas un numero de
    // voie. Se tromper enverrait le colis a une autre porte.
    expect(recoverHouseNumberFromStreet('', 'rue du 8 mai 1945')).toBeNull()
    expect(recoverHouseNumberFromStreet('', 'avenue du 11 novembre')).toBeNull()
  })

  it('ne touche a rien si le numero est deja renseigne', () => {
    expect(recoverHouseNumberFromStreet('7', 'rue dieffiere n°13')).toBeNull()
  })

  it('refuse de vider le libelle de rue', () => {
    expect(recoverHouseNumberFromStreet('', 'n°13')).toBeNull()
  })

  it('n agit que lorsque le refus porte sur le numero de voie', () => {
    // Sans refus sur ce champ, on ne touche pas : 100 commandes sur 100 ont un
    // numero vide sans que cela pose probleme.
    const sansRefus = planAddressShortening(
      { address: 'rue dieffiere n°13', house_number: '', city: 'maulde', postal_code: '7534' },
      [{ field: 'city', max: 26 }],
    )
    expect(sansRefus.patch.house_number).toBeUndefined()

    const avecRefus = planAddressShortening(
      { address: 'rue dieffiere n°13', house_number: '', city: 'maulde', postal_code: '7534' },
      [{ field: 'house_number', max: 20 }],
    )
    expect(avecRefus.patch.house_number).toBe('13')
    expect(avecRefus.patch.address).toBe('rue dieffiere')
    expect(avecRefus.lossyFields).toEqual([])
  })
})

describe('organisation collee au nom (capture #546632)', () => {
  it('bascule l organisation dans le champ entreprise', () => {
    // "Ensure that name has at most 32 characters (it has 36)."
    // L'exploitation corrige exactement ainsi, confirme par Quentin.
    const r = extraireOrganisation('Christine HEGY Croix-Rouge Française', '', 32)
    expect(r).toEqual({ name: 'Christine HEGY', company_name: 'Croix-Rouge Française' })
  })

  it('N ECRASE JAMAIS une entreprise deja renseignee', () => {
    expect(extraireOrganisation('Christine HEGY Croix-Rouge Française', 'Deja La', 32)).toBeNull()
  })

  it('ne touche pas un nom qui EST l organisation', () => {
    // Position 0 : il n'y a pas de personne a separer.
    expect(extraireOrganisation('Association des Amis du Vieux Moulin de Bray', '', 32)).toBeNull()
  })

  it('rend la main quand aucun marqueur n est reconnu', () => {
    // Sans marqueur on ne sait pas ou finit la personne. Deviner couperait le
    // nom qui sert a retirer le colis au point relais.
    expect(extraireOrganisation('Jean-Baptiste de La Rochefoucauld Montbel', '', 32)).toBeNull()
  })

  it('refuse si la personne seule depasse encore la limite', () => {
    const nom = 'Marie-Christine Vandenbroucke-Delatour Association Test'
    expect(extraireOrganisation(nom, '', 32)).toBeNull()
  })

  it('ne fait rien si le nom tient deja', () => {
    expect(extraireOrganisation('Paul Croix-Rouge', '', 32)).toBeNull()
  })

  it('corrige sans perte dans le plan complet', () => {
    const plan = planAddressShortening(
      {
        name: 'Christine HEGY Croix-Rouge Française', company_name: '',
        address: '3 rue crève cœur', city: 'Bourg-en-Bresse', postal_code: '01000',
      },
      [{ field: 'name', max: 32 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.name).toBe('Christine HEGY')
    expect(plan.patch.company_name).toBe('Croix-Rouge Française')
  })
})

describe('marqueurs accentues', () => {
  it('reconnait un marqueur porteur d accents', () => {
    // La liste des marqueurs est sans accents : c'est la normalisation qui
    // doit faire le rapprochement. Verifie ici plutot que suppose.
    expect(extraireOrganisation('Marie Dupont École Sainte-Anne', '', 20))
      .toEqual({ name: 'Marie Dupont', company_name: 'École Sainte-Anne' })
  })

  it('reconnait un marqueur en majuscules', () => {
    expect(extraireOrganisation('Paul Martin EHPAD Les Tilleuls', '', 20))
      .toEqual({ name: 'Paul Martin', company_name: 'EHPAD Les Tilleuls' })
  })
})

describe('entreprise recopiee en tete du nom (commandes reelles du 10/08)', () => {
  it('retire le doublon exact — #547242', () => {
    // nom 43 caracteres, entreprise deja renseignee et recopiee en tete.
    const r = retirerEntrepriseDupliquee(
      'Port de Gustavia Bateau Elios Angel Deborah', 'Port de Gustavia Bateau',
    )
    expect(r).toEqual({ name: 'Elios Angel Deborah' })
  })

  it('retire le doublon malgre les accents — #546396', () => {
    const r = retirerEntrepriseDupliquee(
      'Confiance obsèques Chevalier Karine', 'Confiance obsèques',
    )
    expect(r).toEqual({ name: 'Chevalier Karine' })
  })

  it('ne touche a rien si l entreprise n est pas en tete', () => {
    expect(retirerEntrepriseDupliquee('Karine Chevalier Confiance', 'Confiance')).toBeNull()
  })

  it('refuse de vider le nom quand il EST l entreprise', () => {
    // Le colis se retrouverait sans destinataire nomme.
    expect(retirerEntrepriseDupliquee('Confiance obsèques', 'Confiance obsèques')).toBeNull()
  })

  it('ne fait rien sans entreprise renseignee', () => {
    expect(retirerEntrepriseDupliquee('Christine HEGY Croix-Rouge', '')).toBeNull()
  })

  it('corrige sans perte dans le plan complet', () => {
    const plan = planAddressShortening(
      {
        name: 'Confiance obsèques Chevalier Karine',
        company_name: 'Confiance obsèques',
        address: '2 rue des Lilas', city: 'Nantes', postal_code: '44000',
      },
      [{ field: 'name', max: 32 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.name).toBe('Chevalier Karine')
    // L'entreprise n'est pas touchee : elle portait deja l'information.
    expect(plan.patch.company_name).toBeUndefined()
  })
})

describe('les cinq corrections manuelles du 10/08 au soir', () => {
  // Valeurs copiees telles quelles depuis les captures de l'exploitation.
  // Deux limites nouvelles y apparaissent : numero de voie a 8 caracteres
  // chez Mondial Relay, ville a 25 chez Colis Prive.

  it('#547678 separe un numero de voie de 13 caracteres', () => {
    const plan = planAddressShortening(
      { address: 'Lot', house_number: '4 les Emeries', address_2: '',
        city: 'La Fare-les-Oliviers', postal_code: '13580' },
      [{ field: 'house_number', max: 8 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.house_number).toBe('4')
    expect(plan.patch.address_2).toBe('les Emeries')
  })

  it('#547487 abrege Saint pour rentrer dans 25 caracteres', () => {
    const plan = planAddressShortening(
      { address: '221 Rue des Fanges', house_number: '', address_2: '',
        city: 'Saint-Symphorien-sur-Coise', postal_code: '69590' },
      [{ field: 'city', max: 25 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.city).toBe('St-Symphorien-sur-Coise')
  })

  it('#547643 abrege une commune de 27 caracteres', () => {
    const plan = planAddressShortening(
      { address: '575 Chemin de Fief Garnier', house_number: '', address_2: '',
        city: 'Saint-Thomas-de-Courcerieres', postal_code: '53160' },
      [{ field: 'city', max: 25 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.city).toBe('St-Thomas-de-Courcerieres')
  })

  it('#547802 ajoute au complement deja occupe au lieu de renoncer', () => {
    // Le moteur renoncait parce que le complement contenait "BT G1". Or les
    // deux tiennent ensemble : rien n'est perdu.
    const plan = planAddressShortening(
      { address: 'Le roy d espagne', house_number: '13 All Albeniz', address_2: 'BT G1',
        city: 'MARSEILLE', postal_code: '13008' },
      [{ field: 'house_number', max: 8 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.house_number).toBe('13')
    expect(plan.patch.address_2).toBe('BT G1 All Albeniz')
  })

  it('renonce si la fusion ne tient pas dans le complement', () => {
    // Le garde-fou : on n'ajoute que si le tout rentre.
    const plan = planAddressShortening(
      { address: 'rue X', house_number: '13 Allee des Grands Peupliers du Parc',
        address_2: 'Batiment C Escalier 4 Porte Gauche', city: 'Lyon', postal_code: '69000' },
      [{ field: 'house_number', max: 8 }],
    )
    expect(plan.lossyFields).toContain('house_number')
  })
})

describe('les six cas du 17/08 au soir', () => {
  it('#550791 separe la personne de la structure sur " - "', () => {
    // "AGNÈS BALLEREAU - CAPSTAN AVOCATS", 33 caracteres pour une limite de 32.
    // La liste de marqueurs ne connaissait pas "AVOCATS", et une liste de
    // metiers ne sera jamais close. Le separateur est generique.
    const r = extraireOrganisation('AGNÈS BALLEREAU - CAPSTAN AVOCATS', '', 32)
    expect(r).toEqual({ name: 'AGNÈS BALLEREAU', company_name: 'CAPSTAN AVOCATS' })
  })

  it('ne coupe PAS un patronyme compose', () => {
    // Un nom compose francais s'ecrit sans espaces autour du trait d'union.
    // Des espaces des deux cotes marquent une separation voulue.
    expect(extraireOrganisation('Jean-Baptiste Dupont-Durand-Lefevre-Martin', '', 32)).toBeNull()
  })

  it('#550601 retire le prefixe pays du code postal luxembourgeois', () => {
    // "Enter a valid zip code." Les codes luxembourgeois font quatre chiffres ;
    // le L est la convention d'ecriture du pays, pas une partie du code.
    expect(nettoyerCodePostal('L7333', 'LU')).toEqual({ postal_code: '7333' })
    expect(nettoyerCodePostal('L-7333', 'LU')).toEqual({ postal_code: '7333' })
  })

  it('NE retire PAS un prefixe qui ne correspond pas au pays declare', () => {
    // Retirer un B devant un code allemand changerait la destination.
    expect(nettoyerCodePostal('B7333', 'LU')).toBeNull()
    expect(nettoyerCodePostal('L7333', 'FR')).toBeNull()
  })

  it('ne touche pas a un code postal deja valide', () => {
    expect(nettoyerCodePostal('7333', 'LU')).toBeNull()
    expect(nettoyerCodePostal('38880', 'FR')).toBeNull()
  })

  it('#550824 abrege Route et rentre dans la limite combinee', () => {
    const plan = planAddressShortening(
      { address: 'Route de Finhan La Poste Nord', address_2: '',
        house_number: '562', city: 'Montech', postal_code: '82700' },
      [{ field: 'address_1', max: 32 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.address).toBe('Rte de Finhan La Poste Nord')
  })

  it('#550903 ajoute au complement occupe', () => {
    const plan = planAddressShortening(
      { address: 'Le petit bois', address_2: 'Appt A 18',
        house_number: '162 rue privat', city: 'Bessieres', postal_code: '31660' },
      [{ field: 'house_number', max: 8 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.house_number).toBe('162')
    expect(plan.patch.address_2).toBe('Appt A 18 rue privat')
  })
})

describe('code postal dans le plan complet', () => {
  it('#550601 corrige le code postal sans perte', () => {
    const plan = planAddressShortening(
      { address: 'rue des Prés', house_number: '39', address_2: '',
        city: 'Steinsel', postal_code: 'L7333', country_code: 'LU' },
      [{ field: 'postal_code', max: 10 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.postal_code).toBe('7333')
  })

  it('ne touche pas au code postal quand le pays ne correspond pas', () => {
    const plan = planAddressShortening(
      { address: 'rue des Prés', house_number: '39', address_2: '',
        city: 'Steinsel', postal_code: 'L7333', country_code: 'FR' },
      [{ field: 'postal_code', max: 10 }],
    )
    expect(plan.patch.postal_code).toBeUndefined()
  })
})

describe('mention chez dans le nom (capture #550968)', () => {
  it('deplace la mention vers le complement d adresse', () => {
    // "Florence Houbin chez Marie Noëlle HOUBIN", 40 caracteres pour 32.
    // Le moteur tronquait en "Florence Houbin chez Marie", qui ne designe
    // plus personne. La norme postale francaise place le point de remise sur
    // la ligne complement.
    const r = extraireMentionChez('Florence Houbin chez Marie Noëlle HOUBIN', '', 32)
    expect(r).toEqual({ name: 'Florence Houbin', address_2: 'chez Marie Noëlle HOUBIN' })
  })

  it('ne touche pas a un commerce nomme Chez quelque chose', () => {
    // "Chez Marcel" n'a pas de personne avant : rien a deplacer.
    expect(extraireMentionChez('Chez Marcel Restaurant du Port et des Halles', '', 32)).toBeNull()
  })

  it('refuse si le complement deborderait', () => {
    expect(extraireMentionChez(
      'Florence Houbin chez Marie Noëlle HOUBIN',
      'Batiment C Escalier 4 Porte Gauche', 32,
    )).toBeNull()
  })

  it('ajoute a un complement libre de place', () => {
    const r = extraireMentionChez('Florence Houbin chez Marie', 'Apt 3', 20, 30)
    expect(r).toEqual({ name: 'Florence Houbin', address_2: 'Apt 3 chez Marie' })
  })

  it('ne fait rien si le nom tient deja', () => {
    expect(extraireMentionChez('Paul chez Marie', '', 32)).toBeNull()
  })

  it('corrige sans perte dans le plan complet', () => {
    const plan = planAddressShortening(
      { name: 'Florence Houbin chez Marie Noëlle HOUBIN', company_name: '',
        address: '6 Grande Rue', address_2: '', house_number: '',
        city: 'Prâlon', postal_code: '21410', country_code: 'FR' },
      [{ field: 'name', max: 32 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.name).toBe('Florence Houbin')
    expect(plan.patch.address_2).toBe('chez Marie Noëlle HOUBIN')
  })
})

describe('propositions lisibles apres coupe (cas du 19/08)', () => {
  it('ne laisse pas une proposition finir par une conjonction', () => {
    // Releve en production : "10 Rue des Frères Eugène et". L'information est
    // deja perdue a ce stade, ce n'est pas ce qu'on repare. Mais une
    // suggestion qui a l'air cassee decredibilise toutes les autres.
    const r = shortenAddressField('10 Rue des Frères Eugène et Adrien Peugeot', 32)
    expect(r.lossy).toBe(true)
    expect(r.value).not.toMatch(/\s(et|de|des|du|la|le|les|aux?)$/i)
    expect(r.value).toBe('10 Rue des Frères Eugène')
  })

  it('ne laisse pas une proposition finir par un article', () => {
    const r = shortenAddressField('Av F Mitterrand Parc des Expositions Sud', 30)
    expect(r.value).not.toMatch(/\sdes$/i)
  })

  it('enchaine les liaisons quand il y en a plusieurs', () => {
    const r = shortenAddressField('Rue des Frères de la Concorde Nationale', 25)
    expect(r.value).not.toMatch(/\s(de|la)$/i)
  })

  it('ne mange pas un mot porteur de sens', () => {
    // "Lyon" n'est pas une liaison : on ne le retire pas.
    const r = shortenAddressField('Grande Avenue de la Ville de Lyon Nord', 34)
    expect(r.value).toContain('Lyon')
  })

  it('ne vide jamais la valeur', () => {
    const r = shortenAddressField('de la et des du', 8)
    expect(r.value.length).toBeGreaterThanOrEqual(3)
  })
})

describe('les deux cas du 19/08 au soir', () => {
  it('#551528 separe un numero colle a son type de voie', () => {
    // "376Avenue" pour une limite de 8. La vraie adresse est
    // "376 Avenue Du Lieutenant Giffault" : le type de voie appartient au
    // debut du libelle de rue, pas au complement.
    const plan = planAddressShortening(
      { address: 'Du Lieutenant Giffault', house_number: '376Avenue', address_2: '',
        city: 'Pays de Belvès', postal_code: '24170', country_code: 'FR' },
      [{ field: 'house_number', max: 8 }],
    )
    expect(plan.ready).toBe(true)
    expect(plan.lossyFields).toEqual([])
    expect(plan.patch.house_number).toBe('376')
    expect(plan.patch.address).toBe('Avenue Du Lieutenant Giffault')
  })

  it('ne coupe PAS un numero a suffixe comme 12B', () => {
    // Sans type de voie reconnu, on ne touche a rien : le B fait partie du
    // numero, et le colis irait a la mauvaise porte.
    expect(separerTypeDeVoieColle('12B', 'Rue des Lilas')).toBeNull()
    expect(separerTypeDeVoieColle('45bis', 'Rue des Lilas')).toBeNull()
  })

  it('reconnait les types de voie accentues', () => {
    expect(separerTypeDeVoieColle('12Allée', 'des Tilleuls'))
      .toEqual({ houseNumber: '12', address: 'Allée des Tilleuls' })
  })
})
