import { describe, expect, it } from 'vitest'
import { detectAutoFixCause } from './detect'
import { OBSERVED_RULES } from './validate'

describe('detectAutoFixCause', () => {
  it('does not infer a cause from On Hold, warnings or CHF data alone', () => {
    expect(detectAutoFixCause({
      shipment_uuid: 'uuid-1',
      order_status: { message: 'On Hold' },
      currency: 'CHF',
      warnings: ['Currency may be unsupported'],
    }, 'integration_shipment')).toBeNull()
  })

  it('does not treat status 1002 as an autonomous pattern', () => {
    expect(detectAutoFixCause({
      id: 42,
      status: { id: 1002, message: 'Announcement failed' },
    }, 'parcel')).toBeNull()
  })

  it('routes a 1002 parcel through its structured CHF cause', () => {
    const result = detectAutoFixCause({
      id: 42,
      status: { id: 1002, message: 'Announcement failed' },
      country: { iso_2: 'CH' },
      total_order_value_currency: 'CHF',
      total_order_value: '10.00',
      parcel_items: [
        { quantity: 2, value: '3.33' },
        { quantity: 1, value: '6.67' },
      ],
      errors: { non_field_errors: ['La devise CHF n’est pas prise en charge par ce contrat'] },
    }, 'parcel')

    expect(result?.primaryPattern).toBe('currency_chf')
    expect(result?.sourceSummary.status_context).toBe('announcement_failed_1002')
    expect(result?.detectedPatterns).not.toContain('announcement_failed_1002')
    expect(result?.sourceSummary.monetary).toEqual({
      total_order_value: '10.00',
      parcel_items: [
        { index: 0, quantity: 2, value: '3.33' },
        { index: 1, quantity: 1, value: '6.67' },
      ],
    })
  })

  it.each([
    [{ errors: { address_2: ['This field may contain at most 30 characters'] }, address_2: 'x'.repeat(38) }, 'address_too_long'],
    [{ errors: { parcel_items: { 0: { hs_code: ['This field is required'] } } }, parcel_items: [{ weight: '0.2' }] }, 'hs_code_missing'],
    [{ errors: { parcel_items: { 0: { weight: ['Weight must be greater than 0.001 kg'] } } }, parcel_items: [{ weight: '0.0005' }] }, 'weight_too_low'],
    [{ checkout_payload_errors: ['A service point selection is required'], to_service_point: null }, 'service_point_missing'],
    [{ errors: { sender_eori: ['EORI is required'] } }, 'sender_eori_missing'],
  ] as const)('classifies a structured error as %s', (raw, pattern) => {
    expect(detectAutoFixCause(raw, 'integration_shipment')?.detectedPatterns).toContain(pattern)
  })

  /**
   * Commande reelle du 23/08 : elle est arrivee en « cause inconnue ».
   *
   * Le piege est que le message ne vient PAS d'un refus Sendcloud mais de
   * notre propre regle anticipee — sa formulation est donc la notre, et un
   * classement ecrit contre la phrase de Sendcloud ne l'aurait jamais
   * reconnue. C'est la sixieme fois que ce piege se presente : on teste donc
   * la phrase telle qu'elle est produite, pas une phrase plausible.
   */
  it('names a non-EUR currency instead of leaving it unexplained', () => {
    const result = detectAutoFixCause({
      id: 77,
      currency: 'GBP',
      total_order_value: '48.00',
      country: { iso_2: 'GB' },
      address: 'Baker Street',
      house_number: '221',
      city: 'London',
      postal_code: 'NW1 6XE',
      parcel_items: [{ quantity: 1, value: '48.00', weight: '0.400', hs_code: '610910', origin_country: 'FR' }],
    }, 'integration_shipment', { latentRules: OBSERVED_RULES })

    expect(result?.primaryPattern).toBe('currency_unsupported')
    expect(result?.primaryPattern).not.toBe('unknown')
  })

  it('does not swallow the Swiss franc, which has its own conversion', () => {
    const result = detectAutoFixCause({
      id: 78,
      currency: 'CHF',
      country: { iso_2: 'CH' },
      total_order_value: '10.00',
      parcel_items: [{ quantity: 1, value: '10.00' }],
      errors: { currency: ['La devise CHF n’est pas prise en charge par ce contrat'] },
    }, 'integration_shipment')

    expect(result?.primaryPattern).toBe('currency_chf')
  })

  it('keeps multiple causes in deterministic priority order in one detection', () => {
    const result = detectAutoFixCause({
      country: 'CH',
      currency: 'CHF',
      address_2: 'x'.repeat(40),
      errors: {
        address_2: ['Address is too long, maximum 30 characters'],
        currency: ['Currency CHF is not supported by contract'],
        sender_eori: ['EORI is required'],
      },
    }, 'integration_shipment')

    expect(result?.detectedPatterns).toEqual([
      'sender_eori_missing',
      'currency_chf',
      'address_too_long',
    ])
    expect(result?.primaryPattern).toBe('sender_eori_missing')
    expect(result?.sourceSummary.address_lengths).toEqual({ address_2: 40 })
  })

  it('creates an unknown review cause only for a real structured error', () => {
    const result = detectAutoFixCause({ errors: { mystery: ['Carrier rejected foo'] } }, 'parcel')
    expect(result?.detectedPatterns).toEqual(['unknown'])
    expect(result?.sourceSummary).not.toHaveProperty('monetary')
  })

  it('fingerprints error content changes without retaining clear-text evidence', () => {
    const first = detectAutoFixCause({ errors: { address: ['Address too long, max 30 characters'] } }, 'parcel')!
    const second = detectAutoFixCause({ errors: { address: ['Address too long, max 35 characters'] } }, 'parcel')!

    expect(first.sourceFingerprint).not.toBe(second.sourceFingerprint)
    expect(first.evidence[0].messageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.evidence[0]).not.toHaveProperty('message')
  })

  it('fingerprints CHF amount changes so a recalculation creates a new simulated operation', () => {
    const raw = {
      total_order_value_currency: 'CHF',
      total_order_value: '10.00',
      parcel_items: [{ quantity: 1, value: '10.00' }],
      errors: { currency: ['Currency CHF is not supported'] },
    }
    const first = detectAutoFixCause(raw, 'parcel')!
    const second = detectAutoFixCause({
      ...raw,
      total_order_value: '11.00',
      parcel_items: [{ quantity: 1, value: '11.00' }],
    }, 'parcel')!

    expect(first.sourceFingerprint).not.toBe(second.sourceFingerprint)
  })

  it('ignore un colis deja annonce : son etiquette est partie', () => {
    // Mesure sur une journee : treize taches creees puis refusees pour ce seul
    // motif. Le bruit dans le tableau coute plus que le calcul economise.
    const parti = {
      errors: { city: ['Ensure this field has no more than 30 characters.'] },
      date_announced: '2026-07-30T10:00:00Z',
      status: { id: 91 },
    }
    expect(detectAutoFixCause(parti, 'parcel')).toBeNull()
  })

  it('garde un colis en echec d annonce : il reste modifiable', () => {
    const echec = {
      errors: { city: ['Ensure this field has no more than 30 characters.'] },
      date_announced: '2026-07-30T10:00:00Z',
      status: { id: 1002 },
    }
    expect(detectAutoFixCause(echec, 'parcel')).not.toBeNull()
  })

  it('ne filtre pas les commandes importees, qui n ont pas d annonce', () => {
    const commande = {
      errors: { city: ['Ensure this field has no more than 30 characters.'] },
      date_announced: '2026-07-30T10:00:00Z',
    }
    expect(detectAutoFixCause(commande, 'integration_shipment')).not.toBeNull()
  })
})

describe('cas releves en production le 07/08', () => {
  // Tous les libelles ci-dessous sont copies tels quels depuis la base : ce
  // sont les messages que Sendcloud a reellement renvoyes, pas des exemples
  // reconstitues. C'etait la faille — les regles etaient ecrites contre des
  // formulations supposees.

  const PANNES_TRANSPORTEUR = [
    // Huitieme formulation, relevee le 11/08 : elle parle de connexion et
    // non d'indisponibilite. Quatre taches attendaient dans la file manuelle
    // parce que le test initial ne couvrait que la premiere idee.
    'Problème de connexion au serveur du transporteur ; vérifiez la page de statut de Sendcloud ou du transporteur si cela persiste.',
    'Erreur du transporteur : service indisponible, veuillez réessayer plus tard ou contacter le transporteur pour assistance.',
    'Le transporteur a renvoyé une erreur : service indisponible. Veuillez réessayer plus tard ou contacter le transporteur pour obtenir de l\'aide.',
    'Le transporteur a renvoyé une erreur, service indisponible, veuillez réessayer plus tard ou contacter le support.',
    'Le transporteur a renvoyé une erreur, service indisponible. Veuillez vérifier le site Web du transporteur pour plus d\'informations.',
  ]

  it.each(PANNES_TRANSPORTEUR)('ne cree aucune tache pour une panne passagere : %s', (message) => {
    // 47 occurrences en production, premier motif de la file manuelle. Rien
    // n'y est corrigeable : ce travail n'appartient pas a l'exploitation.
    expect(detectAutoFixCause({
      id: 1,
      status: { id: 1002, message: 'Announcement failed' },
      errors: { uncategorized: { non_field_errors: [message] } },
    }, 'parcel')).toBeNull()
  })

  it('garde le vrai defaut quand il accompagne une panne passagere', () => {
    // Sinon le filtre masquerait une correction reellement due.
    const result = detectAutoFixCause({
      id: 2,
      status: { id: 1002, message: 'Announcement failed' },
      to_service_point: 42,
      errors: {
        uncategorized: { non_field_errors: ['Le transporteur a renvoyé une erreur, service indisponible.'] },
        to_service_point: ['Service point no longer operational'],
      },
    }, 'parcel')
    expect(result?.detectedPatterns).toContain('service_point_missing')
  })

  it('reconnait un point relais ferme', () => {
    // 17 occurrences classees "cause inconnue" : le motif exigeait un mot
    // comme "missing" ou "invalid", or le relais n'est pas absent, il a ferme.
    const result = detectAutoFixCause({
      id: 3,
      status: { id: 1002, message: 'Announcement failed' },
      to_service_point: 11627787,
      errors: { to_service_point: ['Service point no longer operational'] },
    }, 'parcel')
    expect(result?.detectedPatterns).toContain('service_point_missing')
  })
})

describe('numero de voie exige (releve du 09/08)', () => {
  it('classe un numero de voie obligatoire avec les corrections d adresse', () => {
    // Sans cette classification la tache restait en "cause inconnue" et
    // n'etait jamais planifiee : la reparation existait mais ne tournait
    // jamais. C'est le meme plan qui sait recuperer le numero.
    const result = detectAutoFixCause({
      shipment_uuid: 'u1',
      address: 'rue dieffiere n°13',
      house_number: '',
      errors: { house_number: ['Ce champ est obligatoire.'] },
    }, 'integration_shipment')
    expect(result?.detectedPatterns).toContain('address_too_long')
  })

  it('classe aussi la variante anglaise', () => {
    const result = detectAutoFixCause({
      shipment_uuid: 'u2',
      address: 'rue dieffiere n°13',
      house_number: '',
      errors: { house_number: ['This field is required.'] },
    }, 'integration_shipment')
    expect(result?.detectedPatterns).toContain('address_too_long')
  })

  it('ne classe pas un autre champ obligatoire comme une adresse trop longue', () => {
    const result = detectAutoFixCause({
      shipment_uuid: 'u3',
      errors: { shipping_method: ['This field is required.'] },
    }, 'integration_shipment')
    expect(result?.detectedPatterns).not.toContain('address_too_long')
  })
})

describe('nom du destinataire trop long (capture #546632)', () => {
  it('classe le refus sur le nom avec les corrections d adresse', () => {
    // Sans cette classification, la limite arrivait bien depuis le refus mais
    // le plan ne tournait jamais : meme piege que le numero de voie.
    const result = detectAutoFixCause({
      shipment_uuid: 'n1',
      name: 'Christine HEGY Croix-Rouge Française',
      company_name: '',
      errors: { name: ['Ensure that name has at most 32 characters (it has 36).'] },
    }, 'integration_shipment')
    expect(result?.detectedPatterns).toContain('address_too_long')
  })

  it('remonte la limite exacte lue dans le refus', () => {
    // La limite varie selon le transporteur : 32 chez Colis Prive, 35
    // ailleurs. Elle doit venir du message, jamais d'une constante.
    const result = detectAutoFixCause({
      shipment_uuid: 'n2',
      name: 'Un nom vraiment tres long pour le test ici',
      errors: { name: ['Ensure that name has at most 35 characters (it has 41).'] },
    }, 'integration_shipment')
    const limites = (result?.sourceSummary as { address_limits?: Array<{ field: string; max: number }> })
      ?.address_limits ?? []
    expect(limites.some((l) => l.field === 'name' && l.max === 35)).toBe(true)
  })
})

describe('etiquette deja produite (mesure du 10/08)', () => {
  const REGLES = {
    addressCombinedMax: 32, cityMax: 30, address2Max: 30, houseNumberMax: 20,
    companyNameMax: 50, recipientNameMax: 32, requireAddress: true, requireParcelItems: false,
    acceptedCurrencies: null,
  }

  const colisEtiquete = {
    id: 1,
    status: { id: 1000, message: 'Ready to send' },
    date_announced: '2026-08-10T06:12:00Z',
    tracking_number: '6A21000123456',
    address: 'une adresse vraiment beaucoup trop longue pour la limite',
    house_number: '12', city: 'Paris', postal_code: '75001',
    parcel_items: [{ quantity: 1 }],
  }

  it('ne signale plus une adresse que le transporteur a acceptee', () => {
    // 6 des 7 escalades de la nuit venaient de la : des colis etiquetes, avec
    // numero de suivi, signales pour une adresse deja acceptee. Du travail
    // manuel fabrique de toutes pieces.
    expect(detectAutoFixCause(colisEtiquete, 'parcel', { latentRules: REGLES })).toBeNull()
  })

  it('signale toujours la meme adresse tant qu aucune etiquette n existe', () => {
    // La detection anticipee garde tout son sens AVANT l'etiquette.
    const avant = { ...colisEtiquete, date_announced: null, tracking_number: '' }
    const r = detectAutoFixCause(avant, 'parcel', { latentRules: REGLES })
    expect(r?.detectedPatterns).toContain('address_too_long')
  })

  it('garde une erreur REELLEMENT rapportee malgre l etiquette', () => {
    // Si le transporteur se plaint apres coup, c'est un vrai probleme.
    const r = detectAutoFixCause(
      { ...colisEtiquete, errors: { address: ['Ensure that address 1 has at most 32 characters.'] } },
      'parcel', { latentRules: REGLES },
    )
    expect(r?.detectedPatterns).toContain('address_too_long')
  })

  it('ne change rien pour les commandes importees', () => {
    // Une commande n'a pas d'etiquette : la regle ne la concerne pas.
    const commande = {
      shipment_uuid: 'u1',
      address: 'une adresse vraiment beaucoup trop longue pour la limite',
      house_number: '12', city: 'Paris', postal_code: '75001',
      date_announced: '2026-08-10T06:12:00Z',
      parcel_items: [{ quantity: 1 }],
    }
    const r = detectAutoFixCause(commande, 'integration_shipment', { latentRules: REGLES })
    expect(r?.detectedPatterns).toContain('address_too_long')
  })
})

describe('les seuils resserres declenchent bien la detection', () => {
  // Le maillon qui manquait : verifier que la tache est CREEE, et pas
  // seulement que le plan saurait corriger. Trois fois aujourd'hui, une
  // reparation existait sans jamais etre atteinte.
  const REGLES = OBSERVED_RULES

  it('signale une ville de 26 caracteres (refusee a 25 par Colis Prive)', () => {
    const r = detectAutoFixCause({
      shipment_uuid: 'v1',
      address: '221 Rue des Fanges', house_number: '',
      city: 'Saint-Symphorien-sur-Coise', postal_code: '69590',
      parcel_items: [{ quantity: 1 }],
    }, 'integration_shipment', { latentRules: REGLES })
    expect(r?.detectedPatterns).toContain('address_too_long')
  })

  it('signale un numero de voie de 13 caracteres (refuse a 8 par Mondial Relay)', () => {
    const r = detectAutoFixCause({
      shipment_uuid: 'v2',
      address: 'Lot', house_number: '4 les Emeries',
      city: 'La Fare-les-Oliviers', postal_code: '13580',
      parcel_items: [{ quantity: 1 }],
    }, 'integration_shipment', { latentRules: REGLES })
    expect(r?.detectedPatterns).toContain('address_too_long')
  })

  it('ne signale pas une adresse qui tient dans les limites les plus strictes', () => {
    // Le garde-fou contre l'avalanche : ce qui rentre partout reste muet.
    const r = detectAutoFixCause({
      shipment_uuid: 'v3',
      address: '12 rue des Lilas', house_number: '12',
      city: 'Nantes', postal_code: '44000',
      parcel_items: [{ quantity: 1 }],
    }, 'integration_shipment', { latentRules: REGLES })
    expect(r).toBeNull()
  })
})

describe('nom du destinataire trop long, anticipe', () => {
  // Signale par l'exploitation le 17/08. Le moteur SAVAIT deja traiter ce cas,
  // mais il arrivait toujours apres : sans regle anticipee, le refus
  // n'apparaissait qu'a la tentative d'etiquette, c'est-a-dire au moment ou
  // l'exploitation le corrigeait elle-meme.
  //
  // Savoir corriger ne sert a rien si on arrive apres celui qu'on voulait
  // soulager.
  it('signale un nom de 36 caracteres AVANT toute tentative', () => {
    const r = detectAutoFixCause({
      shipment_uuid: 'n1',
      name: 'Christine HEGY Croix-Rouge Française',
      company_name: '',
      address: '3 rue creve coeur', house_number: '3',
      city: 'Bourg-en-Bresse', postal_code: '01000',
      parcel_items: [{ quantity: 1 }],
    }, 'integration_shipment', { latentRules: OBSERVED_RULES })
    expect(r?.detectedPatterns).toContain('address_too_long')
  })

  it('ne signale pas un nom qui tient', () => {
    const r = detectAutoFixCause({
      shipment_uuid: 'n2',
      name: 'Christine Hegy', company_name: '',
      address: '3 rue creve coeur', house_number: '3',
      city: 'Bourg-en-Bresse', postal_code: '01000',
      parcel_items: [{ quantity: 1 }],
    }, 'integration_shipment', { latentRules: OBSERVED_RULES })
    expect(r).toBeNull()
  })
})

describe('code postal refuse (capture #550601)', () => {
  it('classe un code postal invalide avec les corrections d adresse', () => {
    // "Enter a valid zip code." sur "L7333" au Luxembourg. Sans cette
    // classification, la reparation existerait sans jamais tourner — le piege
    // le plus recurrent de ce projet.
    const r = detectAutoFixCause({
      shipment_uuid: 'cp1',
      address: 'rue des Prés', house_number: '39',
      city: 'Steinsel', postal_code: 'L7333', country_code: 'LU',
      errors: { postal_code: ['Enter a valid zip code.'] },
    }, 'integration_shipment')
    expect(r?.detectedPatterns).toContain('address_too_long')
  })
})

describe('code postal a prefixe pays, anticipe (cas du 19/08)', () => {
  it('signale AVANT toute tentative d etiquette', () => {
    // La reparation existait depuis la veille, mais le refus n'apparaissait
    // qu'a la tentative — donc au moment ou l'exploitation le corrigeait
    // elle-meme. Deuxieme fois que je tombe sur ce piege.
    const r = detectAutoFixCause({
      shipment_uuid: 'lu1',
      address: 'rue de Steinfort', house_number: '41',
      city: 'KLEINBETTINGEN', postal_code: 'L8381', country_code: 'LU',
      parcel_items: [{ quantity: 1 }],
    }, 'integration_shipment', { latentRules: OBSERVED_RULES })
    expect(r?.detectedPatterns).toContain('address_too_long')
  })

  it('ne signale pas un code postal deja valide', () => {
    const r = detectAutoFixCause({
      shipment_uuid: 'lu2',
      address: 'rue de Steinfort', house_number: '41',
      city: 'KLEINBETTINGEN', postal_code: '8381', country_code: 'LU',
      parcel_items: [{ quantity: 1 }],
    }, 'integration_shipment', { latentRules: OBSERVED_RULES })
    expect(r).toBeNull()
  })
})

describe('rue vide (cas du 20/08)', () => {
  it('nomme la cause au lieu de la laisser inconnue', () => {
    // Rien a corriger automatiquement : la rue est vide et le complement
    // aussi. Mais "cause inconnue" n'aide pas l'exploitation, alors que
    // "adresse absente" lui dit exactement quoi faire.
    const r = detectAutoFixCause({
      shipment_uuid: 'v1',
      address: '', address_2: '', house_number: '12',
      city: 'Nantes', postal_code: '44000',
      errors: { address_1: ['Ce champ est obligatoire.'] },
    }, 'integration_shipment')
    expect(r?.detectedPatterns).toContain('address_missing')
    expect(r?.detectedPatterns).not.toContain('unknown')
  })

  it('ne confond pas avec un complement d adresse vide', () => {
    // Un complement vide est normal, ce n'est pas une adresse manquante.
    const r = detectAutoFixCause({
      shipment_uuid: 'v2',
      address: '12 rue des Lilas', address_2: '', house_number: '12',
      city: 'Nantes', postal_code: '44000',
      errors: { address_2: ['Ce champ est obligatoire.'] },
    }, 'integration_shipment')
    expect(r?.detectedPatterns ?? []).not.toContain('address_missing')
  })
})
