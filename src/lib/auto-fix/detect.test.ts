import { describe, expect, it } from 'vitest'
import { detectAutoFixCause } from './detect'

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
