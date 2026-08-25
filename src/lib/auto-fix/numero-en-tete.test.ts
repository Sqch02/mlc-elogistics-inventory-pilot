import { describe, expect, it } from 'vitest'
import { planAddressShortening } from './address'

/**
 * Commande #553869, relevee le 25/08 sur une capture d'ecran de Quentin.
 *
 * L'interface Sendcloud affichait deux champs :
 *     Nom de la rue     : "de la blanchonne"
 *     Numero de la voie : "401chemin"          <- refuse, 9 caracteres pour 8
 *
 * ...mais l'API v3, que le moteur interroge, renvoyait tout autre chose :
 *     address_line_1 : "401chemin de la blanchonne"
 *     house_number   : null
 *
 * Le moteur regardait donc un champ VIDE, concluait qu'il n'y avait rien a
 * raccourcir, et refermait la tache comme resolue — pendant que l'erreur
 * restait affichee. Sendcloud, lui, decoupe la ligne combinee au premier
 * espace : c'est la qu'il faut mesurer.
 */
describe('numero de voie endormi en tete du libelle', () => {
  it('#553869 : separe le numero du type de voie, sans perte', () => {
    const plan = planAddressShortening(
      {
        address: '401chemin de la blanchonne', address_2: '', house_number: '',
        city: 'St victor de malcap', postal_code: '30500',
      },
      [{ field: 'house_number', max: 8 }],
    )

    expect(plan.patch.house_number).toBe('401')
    expect(plan.patch.address).toBe('chemin de la blanchonne')
    expect(plan.lossyFields).toEqual([])
    expect(plan.ready).toBe(true)
  })

  it('ne recopie pas le jeton de tete dans la rue', () => {
    // Le piege du decoupage : passer le libelle ENTIER a la separation
    // produirait "chemin 401chemin de la blanchonne".
    const plan = planAddressShortening(
      { address: '401chemin de la blanchonne', address_2: '', house_number: '' },
      [{ field: 'house_number', max: 8 }],
    )
    expect(plan.patch.address).not.toContain('401chemin')
  })
})

/**
 * « Je ne trouve rien a raccourcir » n'est PAS « c'est deja resolu ».
 *
 * La confusion des deux a referme a tort la tache de #553869, et
 * DEFINITIVEMENT : la cle d'operation empeche d'en recreer une, si bien que la
 * detection continuait de voir l'erreur a chaque synchro sans pouvoir agir.
 */
describe('renoncer n est pas resoudre', () => {
  /**
   * La verification porte desormais sur les LIMITES REELLEMENT SATISFAITES, et
   * non sur « ai-je fait quelque chose ». `no_repair_available` est le filet
   * de securite de ce raisonnement : il ne se declenche qu'en l'absence totale
   * de reparation applicable, ce qui est rare — les cas essayes produisent
   * tous une escalade pour perte d'information, ce qui est deja correct.
   *
   * Ce qui se teste ici, c'est la propriete qui compte : un champ encore trop
   * long n'est JAMAIS annonce comme resolu.
   */
  it.each([
    ['401xyzabcd de la blanchonne', ''],
    ['de la blanchonne', '401XYZWQ12'],
    ['rue X', '123456789'],
  ])('rue="%s" numero="%s" n est jamais annonce comme resolu', (address, house_number) => {
    const plan = planAddressShortening(
      { address, address_2: '', house_number },
      [{ field: 'house_number', max: 8 }],
    )

    expect(plan.ready).toBe(false)
    // 'nothing_to_shorten' vaut acquittement : la tache se referme comme
    // resolue et la cle d'operation empeche d'en recreer une. Sur #553869,
    // c'est ce qui a rendu la fermeture definitive.
    expect(plan.reason).not.toBe('nothing_to_shorten')
  })

  it('conclut a une resolution reelle quand tout tient dans les limites', () => {
    const plan = planAddressShortening(
      { address: '12 rue des Lilas', address_2: '', house_number: '12',
        city: 'Paris', postal_code: '75001' },
      [{ field: 'house_number', max: 8 }],
    )

    expect(plan.reason).toBe('nothing_to_shorten')
  })
})
