import { describe, expect, it } from 'vitest'
import { retirerRepetitionFinale } from './address'

describe('repetition litterale en fin de champ', () => {
  it('retire une voie ecrite deux fois', () => {
    // Commande #552926, relevee chez Sendcloud le 24/08.
    expect(retirerRepetitionFinale('60 rue des cigognes 60 Rue des Cigognes').value)
      .toBe('60 rue des cigognes')
  })

  it('retire la fin d une ville repetee', () => {
    // Commande #553148. La repetition ne porte pas sur tout le champ mais sur
    // sa fin : une regle qui ne verrait que le doublement complet la raterait.
    expect(retirerRepetitionFinale('Marolles sous lignieres sous lignieres').value)
      .toBe('Marolles sous lignieres')
  })

  it('ignore accents, casse et ponctuation', () => {
    expect(retirerRepetitionFinale('12 Rue de la Gare, 12 rue de la gare').value)
      .toBe('12 Rue de la Gare,')
  })

  it('laisse intacte une adresse sans repetition', () => {
    for (const adresse of [
      '520 Ter rue Paul Langevin -La Maliniere',
      '7, la Mongie la Pommeraie sur Sevre',
      'Wingersheim les Quatre Bans',
      '6 Rue Laugel',
    ]) {
      expect(retirerRepetitionFinale(adresse).value).toBe(adresse)
    }
  })

  it('ne touche pas a un seul mot redouble', () => {
    // Un lieu-dit ou un nom compose peut legitimement redoubler un mot ; le
    // gain ne vaut pas le risque de mutiler une adresse valable.
    expect(retirerRepetitionFinale('Rue de la Fontaine Fontaine').value)
      .toBe('Rue de la Fontaine Fontaine')
  })

  it('ne vide jamais le champ', () => {
    expect(retirerRepetitionFinale('sous lignieres sous lignieres').value)
      .toBe('sous lignieres')
    expect(retirerRepetitionFinale('').value).toBe('')
  })
})

import { planAddressShortening, extractComplement } from './address'

/**
 * Les deux commandes qui dormaient dans la file manuelle le 24/08, telles
 * qu'elles sont chez Sendcloud. Le moteur les classait en « raccourcissement
 * avec perte, a valider » : Quentin devait donc trancher a la main sur des
 * adresses qui ne posaient aucun probleme reel.
 */
describe('les deux commandes reelles se resolvent sans arbitrage', () => {
  it('#552926 : la voie ecrite deux fois', () => {
    const plan = planAddressShortening(
      {
        address: '60 rue des cigognes 60 Rue des Cigognes',
        address_2: '', house_number: '',
        city: 'RAMONVILLE ST AGNE', postal_code: '31520', country_code: 'FR',
      },
      [{ field: 'address_1', max: 32 }],
    )

    expect(plan.patch.address).toBe('60 rue des cigognes')
    // Le point essentiel : plus aucune perte, donc plus aucune validation.
    expect(plan.lossyFields).toEqual([])
  })

  it('#553148 : la fin de la ville repetee', () => {
    const plan = planAddressShortening(
      {
        address: '1 bis route de marolles',
        address_2: 'Charrey', house_number: '',
        city: 'Marolles sous lignieres sous lignieres',
        postal_code: '10130', country_code: 'FR',
      },
      [{ field: 'city', max: 25 }],
    )

    expect(plan.patch.city).toBe('Marolles sous lignieres')
    expect(plan.lossyFields).toEqual([])
  })
})

/**
 * Un lieu-dit accroche a la voie par un tiret sans espace apres :
 * "520 Ter rue Paul Langevin -La Maliniere" (commande #553215). La regle
 * existante exigeait un espace des DEUX cotes du tiret, si bien que le moteur
 * tronquait au mot le plus proche et laissait un "-La" orphelin.
 *
 * L'espace reste exige AVANT le tiret : c'est ce qui distingue un lieu-dit
 * accole d'un nom compose, qui n'en a pas.
 */
describe('lieu-dit accroche par un tiret', () => {
  it('#553215 se resout sans perte', () => {
    const plan = planAddressShortening(
      {
        address: '520 Ter rue Paul Langevin -La Malinière',
        address_2: '', house_number: '',
        city: 'Houppeville', postal_code: '76770', country_code: 'FR',
      },
      [{ field: 'address_1', max: 32 }],
    )

    expect(plan.patch.address).toBe('520 Ter rue Paul Langevin')
    expect(plan.patch.address_2).toBe('La Malinière')
    expect(plan.lossyFields).toEqual([])
  })

  it('ne coupe jamais un nom compose', () => {
    expect(extractComplement('12 rue Jean-Jacques Rousseau')).toBeNull()
    expect(extractComplement('3 avenue Saint-Exupéry')).toBeNull()
    expect(extractComplement('8 place Franklin-Roosevelt')).toBeNull()
  })
})

/**
 * Le complement porte souvent une adresse entiere recopiee, code postal
 * compris. La voie beneficiait deja du nettoyage des doublons ; le complement,
 * non — il etait donc tronque au mot le plus proche.
 *
 * Commande #553270, arrivee le 24/08 : le moteur proposait
 * "9 RUE DE L HOP ST JEAN", perdant "DE DIEU", et demandait a un humain de
 * valider cette perte. Retirer le code postal, deja porte par son champ, suffit
 * a tenir dans la limite sans rien perdre.
 */
describe('code postal recopie dans le complement', () => {
  it('#553270 se resout sans perte', () => {
    const plan = planAddressShortening(
      {
        address: '9 Chemin du Gibet',
        address_2: '9 RUE DE L HOP ST JEAN DE DIEU 59520',
        house_number: '',
        city: 'Marquette-lez-Lille', postal_code: '59520', country_code: 'FR',
      },
      [{ field: 'address_2', max: 30 }],
    )

    expect(plan.patch.address_2).toBe('9 RUE DE L HOP ST JEAN DE DIEU')
    expect(plan.lossyFields).toEqual([])
  })

  it('ne vide jamais la ville de son propre nom', () => {
    // Le meme nettoyage applique au champ VILLE le supprimerait : la ville y
    // est evidemment "recopiee". On ne l'applique donc qu'au complement.
    const plan = planAddressShortening(
      {
        address: '1 rue des Lilas', address_2: '', house_number: '',
        city: 'Marquette-lez-Lille', postal_code: '59520', country_code: 'FR',
      },
      [{ field: 'city', max: 25 }],
    )

    expect(plan.patch.city ?? 'Marquette-lez-Lille').toContain('Marquette')
  })
})
