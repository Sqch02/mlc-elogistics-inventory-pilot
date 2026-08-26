import { describe, expect, it } from 'vitest'
import { planAddressShortening, nettoyerCodePostal } from './address'

/**
 * Commande #554363, relevee le 26/08 sur une capture d'ecran de Quentin.
 * Luxembourg, code postal "L3552", refus "Enter a valid zip code".
 *
 * La reparation existait et fonctionnait. Il lui manquait le PAYS : la
 * conversion de la commande vers l'adresse ne le transmettait pas, alors que
 * `nettoyerCodePostal` refuse d'agir sans lui — deliberement, pour ne jamais
 * amputer un code legitime dont le prefixe ne correspondrait pas au pays.
 *
 * Prive de cette donnee, le moteur ne reparait rien, produit un plan vide, et
 * referme la tache comme « deja resolue ». La fermeture est DEFINITIVE : la
 * cle d'operation empeche d'en recreer une. C'est le meme enchainement que
 * pour #553869 la veille, par une autre porte.
 */
describe('prefixe pays sur le code postal', () => {
  it('#554363 : retire le prefixe luxembourgeois', () => {
    const plan = planAddressShortening(
      {
        address: 'rue Nic Conrady', address_2: '', house_number: '12',
        city: 'Dudelange', postal_code: 'L3552', country_code: 'LU',
      },
      // La tache reelle ne portait AUCUNE limite : le refus visait la
      // validite du code, pas sa longueur.
      [],
    )

    expect(plan.patch.postal_code).toBe('3552')
    expect(plan.reason).toBe('ok')
    expect(plan.lossyFields).toEqual([])
  })

  it('sans le pays, la reparation s abstient — et c est voulu', () => {
    // La garde protege un code legitime commencant par une lettre dans un
    // pays qui n'utilise pas ce prefixe.
    expect(nettoyerCodePostal('L3552', undefined)).toBeNull()
    expect(nettoyerCodePostal('L3552', 'FR')).toBeNull()
    expect(nettoyerCodePostal('L3552', 'LU')).toEqual({ postal_code: '3552' })
  })

  it('la troncature ne recouvre jamais le code nettoye', () => {
    // Avec une limite de longueur, la boucle relisait la valeur ORIGINALE et
    // ecrivait "L355" par-dessus la reparation : un code postal qui n'existe
    // nulle part, a la place du bon.
    const plan = planAddressShortening(
      {
        address: 'rue Nic Conrady', address_2: '', house_number: '12',
        city: 'Dudelange', postal_code: 'L3552', country_code: 'LU',
      },
      [{ field: 'postal_code', max: 4 }],
    )

    expect(plan.patch.postal_code).toBe('3552')
    expect(plan.patch.postal_code).not.toBe('L355')
  })
})
