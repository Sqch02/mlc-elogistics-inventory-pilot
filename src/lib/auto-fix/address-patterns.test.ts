import { describe, it, expect } from 'vitest'
import { planAddressShortening, stripRedundantLocality, extractComplement } from './address'

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
